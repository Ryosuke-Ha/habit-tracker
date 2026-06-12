from typing import Optional

from sqlalchemy.orm import Session

import models
from domain.enums import GoalStatus, SessionStatus
from domain.value_objects import WeekPeriod
from services.weekly_stats import (
    get_achievement_rate_vs_last_week,
    get_weekly_stats,
)

SYSTEM_PROMPT_TEMPLATE = """あなたはプロのライフコーチです。認知科学コーチングの原則に基づき、以下を厳守してください。

【絶対に守るルール】
1. 答え・アドバイス・解決策を与えない
2. 1回のメッセージで問いかけは必ず1つだけ
3. ユーザーの言葉をそのまま使って深掘りする
4. 判断・評価・共感の押しつけをしない
5. ユーザーの内側にある答えを引き出すことだけに集中する
6. 習慣データを参照して具体的・パーソナルな問いかけをする

【NGフレーズ】
「〇〇した方がいいと思います」
「それは△△が原因ですね」
「素晴らしいですね」（評価しない）
「大変でしたね」（共感の押しつけ）

【OKフレーズ】
「今週の達成率が{rate}%でしたね。それについてどう感じていますか？」
「『ユーザーの言葉』とおっしゃいましたが、もう少し教えてもらえますか？」
「もしその状況が変わったとしたら、何が違うと思いますか？」
「それはあなたにとってどんな意味がありますか？」

【セッションの流れ】
Step1: チェックイン（今週の状態・気持ちを聞く）
Step2: 習慣データへの気づきを深掘り
Step3: 課題・障害の探索（Problemを深掘り）
Step4: 目標・アクションの言語化（Tryを具体化）
Step5: セッションのまとめ・来週への問いかけ

現在のコンテキスト:
{context}"""


def build_coaching_context(user_id: str, db: Session) -> str:
    """Gather and pre-process coaching context, returning XML-structured string."""
    week_period = WeekPeriod.current()
    week_start = week_period.start

    stats = get_weekly_stats(week_start, db)
    achievement_rate = stats["achievement_rate"]
    checked = stats["checked_habits"]
    total = stats["total_habits"]
    weakest_habit: Optional[str] = stats.get("weakest_habit")
    strongest_habit: Optional[str] = stats.get("strongest_habit")
    vs_last_week = get_achievement_rate_vs_last_week(week_start, achievement_rate, db) or "データなし"

    review = db.query(models.WeeklyReview).filter_by(user_id=user_id, week_start_date=week_start).first()
    keep_items: list = []
    problem_items: list = []
    try_items: list = []
    if review:
        for item in review.kpt_items:
            if item.type == "keep" and len(keep_items) < 3:
                keep_items.append(item.content)
            elif item.type == "problem" and len(problem_items) < 3:
                problem_items.append(item.content)
            elif item.type == "try" and len(try_items) < 3:
                try_items.append(item.content)

    prev_week_start = WeekPeriod.previous().start
    prev_review = db.query(models.WeeklyReview).filter_by(user_id=user_id, week_start_date=prev_week_start).first()
    last_week_try_items: list = []
    if prev_review:
        prev_try_kpt = [i for i in prev_review.kpt_items if i.type == "try"][:3]
        last_week_try_items = [
            f"{i.content}（{'達成' if i.is_completed else '未達成'}）"
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
    goals_data = [{"title": g.title} for g in active_goals]

    prev_session = (
        db.query(models.CoachingSession)
        .filter_by(user_id=user_id, status=SessionStatus.COMPLETED)
        .order_by(models.CoachingSession.created_at.desc())
        .first()
    )
    raw_summary: Optional[str] = prev_session.summary if prev_session else None
    prev_summary: Optional[str] = raw_summary[:300] if raw_summary else None

    nl = chr(10)
    return f"""<coaching_context>
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
  <previous_session>
    {prev_summary or "なし"}
  </previous_session>
</coaching_context>"""


def build_system_prompt(context: str) -> str:
    """Build the full system prompt from XML context string."""
    return SYSTEM_PROMPT_TEMPLATE.replace("{context}", context)


def build_message_context(session, messages: list, max_recent: int = 5) -> tuple:
    """Return (system_prompt, recent_messages) limiting to last max_recent messages."""
    context_xml = session.context or ""
    system = build_system_prompt(context_xml)
    recent = messages[-max_recent:] if len(messages) > max_recent else messages
    return system, recent
