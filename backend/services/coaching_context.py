from typing import Dict, Optional, Tuple

from sqlalchemy.orm import Session

import models
from domain.enums import GoalStatus, SessionStatus
from domain.value_objects import WeekPeriod
from services.weekly_stats import (
    get_achievement_rate_vs_last_week,
    get_weekly_stats,
)
from utils.security import sanitize_user_input, truncate

SYSTEM_PROMPT_TEMPLATE = """あなたはプロのライフコーチです。認知科学コーチングの原則に基づき、以下を厳守してください。

【絶対に守るルール】
1. 答え・アドバイス・解決策を与えない
2. 1回のメッセージで問いかけは必ず1つだけ
3. ユーザーの言葉をそのまま使って深掘りする
4. 判断・評価・共感の押しつけをしない
5. ユーザーの内側にある答えを引き出すことだけに集中する

【セッション構造（厳守）】
このセッションは必ず3ターンで完結させる。
Turn1: 前回コミットのフォローアップ または 今週のパターンへの問い
Turn2: Turn1の回答を1回だけ深掘り
Turn3: 「来週変えることを1つだけ教えてください」でコミットを引き出す

【深掘りレベル（コンテキストのdepth_levelに従う）】
- surface: 今週の状況を安心して話せる問いかけ。初期ユーザーは信頼関係の構築が優先。
- pattern: 複数週にわたるパターンを探索。「〇週連続で〜が出ていますね」と具体的に指摘する。
- core: 行動の背景にある価値観・動機を探る。「なぜそれがあなたにとって大切なのか」を問う。

【前回コミットのフォローアップ（Turn1の優先ルール）】
前回セッションのcommitがある場合、必ずTurn1で以下のように扱う:

達成率が上がった場合（vs_last_weekがプラス）:
  「先週『{commit}』と決めましたね。今週は達成率が{vs}上がっています。何か変えましたか？」

達成率が下がった、または変わらない場合:
  「先週『{commit}』と決めましたね。実際どうでしたか？」
  ※責めない。状況を聞くだけ。

【連続未達成パターンの対応】
consecutive_similar_commitsがtrueの場合、Turn2またはTurn3で:
「このコミットが3週続いていますね。もう少し小さくするとしたらどうなりますか？」
というリフレーミングの問いかけを必ず入れる。

【NGフレーズ】
「〇〇した方がいいと思います」「それは△△が原因ですね」「素晴らしいですね」「大変でしたね」

現在のコンテキスト:
{context}"""


def _calc_depth_level(session_count: int) -> Tuple[str, str]:
    """セッション回数から深掘りレベルと指示文を計算する"""
    if session_count <= 2:
        return (
            "surface",
            "表面的な気づきを促す問いかけをしてください。初期ユーザーなので安心感を大切に。",
        )
    elif session_count <= 6:
        return (
            "pattern",
            "複数週にわたるパターンを探索する問いかけをしてください。"
            "繰り返し出てくるテーマに注目してください。",
        )
    else:
        return (
            "core",
            "根本的な価値観や動機を探る問いかけをしてください。"
            "表面的な行動の背景にある本質に迫ってください。",
        )


def build_coaching_context(
    user_id: str, db: Session
) -> Tuple[str, Optional[str], Dict]:
    """Gather and pre-process coaching context.

    Returns:
        (context_xml, prev_commit, meta) where meta contains
        session_count, vs_last_week, and achievement_rate.
    """
    week_period = WeekPeriod.current()
    week_start = week_period.start

    stats = get_weekly_stats(week_start, db)
    achievement_rate = stats["achievement_rate"]
    checked = stats["checked_habits"]
    total = stats["total_habits"]
    weakest_habit: Optional[str] = stats.get("weakest_habit")
    strongest_habit: Optional[str] = stats.get("strongest_habit")
    vs_last_week = (
        get_achievement_rate_vs_last_week(week_start, achievement_rate, db)
        or "データなし"
    )

    review = (
        db.query(models.WeeklyReview)
        .filter_by(user_id=user_id, week_start_date=week_start)
        .first()
    )
    keep_items: list = []
    problem_items: list = []
    try_items: list = []
    if review:
        for item in review.kpt_items:
            if item.type == "keep" and len(keep_items) < 3:
                keep_items.append(sanitize_user_input(item.content))
            elif item.type == "problem" and len(problem_items) < 3:
                problem_items.append(sanitize_user_input(item.content))
            elif item.type == "try" and len(try_items) < 3:
                try_items.append(sanitize_user_input(item.content))

    prev_week_start = WeekPeriod.previous().start
    prev_review = (
        db.query(models.WeeklyReview)
        .filter_by(user_id=user_id, week_start_date=prev_week_start)
        .first()
    )
    last_week_try_items: list = []
    if prev_review:
        prev_try_kpt = [i for i in prev_review.kpt_items if i.type == "try"][:3]
        last_week_try_items = [
            f"{sanitize_user_input(i.content)}（{'達成' if i.is_completed else '未達成'}）"
            for i in prev_try_kpt
        ]
        completed = sum(1 for i in prev_try_kpt if i.is_completed)
        last_week_try_completion = f"{completed}/{len(prev_try_kpt)}"
    else:
        last_week_try_completion = "なし"

    active_goals = (
        db.query(models.CoachingGoal)
        .filter_by(user_id=user_id, status=GoalStatus.ACTIVE)
        .limit(3)
        .all()
    )
    goals_data = [{"title": sanitize_user_input(g.title)} for g in active_goals]

    # 過去の完了セッションを取得（直近4件: session_count + recent_commits用）
    past_sessions = (
        db.query(models.CoachingSession)
        .filter_by(user_id=user_id, status=SessionStatus.COMPLETED)
        .order_by(models.CoachingSession.created_at.desc())
        .limit(4)
        .all()
    )
    session_count = len(past_sessions)
    depth_level, depth_instruction = _calc_depth_level(session_count)

    # 直近3セッションのコミット履歴
    recent_commits = []
    for s in past_sessions[:3]:
        if s.commit_content:
            recent_commits.append({
                "date": (
                    s.session_date.isoformat()
                    if hasattr(s.session_date, "isoformat")
                    else str(s.session_date)
                ),
                "commit": sanitize_user_input(truncate(s.commit_content, 100)),
            })

    # 直近3週で同じようなコミットが繰り返されているか（3件以上ある場合を検出）
    consecutive_similar = len(recent_commits) >= 3

    prev_session = past_sessions[0] if past_sessions else None
    raw_summary: Optional[str] = prev_session.summary if prev_session else None
    prev_summary: Optional[str] = (
        sanitize_user_input(truncate(raw_summary, 300)) if raw_summary else None
    )
    prev_commit: Optional[str] = (
        sanitize_user_input(prev_session.commit_content) if prev_session else None
    )

    nl = chr(10)
    context_xml = f"""<coaching_context>
  <session_meta>
    <session_count>{session_count}</session_count>
    <depth_level>{depth_level}</depth_level>
    <depth_instruction>{depth_instruction}</depth_instruction>
    <consecutive_similar_commits>{str(consecutive_similar).lower()}</consecutive_similar_commits>
  </session_meta>
  <achievement>
    <this_week_rate>{achievement_rate}%</this_week_rate>
    <vs_last_week>{vs_last_week}</vs_last_week>
    <weakest_habit>{weakest_habit or "なし"}</weakest_habit>
    <strongest_habit>{strongest_habit or "なし"}</strongest_habit>
    <checked>{checked}</checked>
    <total>{total}</total>
  </achievement>
  <kpt>
    <problem>{nl.join(f"- {i}" for i in problem_items) or "なし"}</problem>
    <try>{nl.join(f"- {i}" for i in try_items) or "なし"}</try>
    <keep>{nl.join(f"- {i}" for i in keep_items) or "なし"}</keep>
  </kpt>
  <last_week_try>
    <completion>{last_week_try_completion}</completion>
    <items>{nl.join(f"- {i}" for i in last_week_try_items) or "なし"}</items>
  </last_week_try>
  <active_goals>
    {nl.join(f"- {g['title']}" for g in goals_data) or "なし"}
  </active_goals>
  <recent_commits>
    {nl.join(f'<commit date="{c["date"]}">{c["commit"]}</commit>' for c in recent_commits) or "<commit>なし</commit>"}
  </recent_commits>
  <previous_session>
    <summary>{prev_summary or "なし"}</summary>
    <commit>{prev_commit or "なし"}</commit>
  </previous_session>
</coaching_context>"""

    meta: Dict = {
        "session_count": session_count,
        "vs_last_week": vs_last_week,
        "achievement_rate": achievement_rate,
    }
    return context_xml, prev_commit, meta


def build_system_prompt(context: str) -> str:
    """Build the full system prompt from XML context string."""
    return SYSTEM_PROMPT_TEMPLATE.replace("{context}", context)


def build_message_context(session, messages: list, max_recent: int = 5) -> tuple:
    """Return (system_prompt, recent_messages) limiting to last max_recent messages."""
    context_xml = session.context or ""
    system = build_system_prompt(context_xml)
    recent = messages[-max_recent:] if len(messages) > max_recent else messages
    return system, recent
