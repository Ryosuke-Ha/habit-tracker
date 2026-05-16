import datetime
import json
from datetime import timedelta
from typing import Optional

from sqlalchemy.orm import Session

import models
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
{context}

前回のセッション内容:
{previous_session}"""


def build_coaching_context(user_id: str, db: Session) -> dict:
    """Gather and pre-process all coaching context data for the current week."""
    today = datetime.date.today()
    days_since_sunday = (today.weekday() + 1) % 7
    week_start = today - datetime.timedelta(days=days_since_sunday)
    week_end = week_start + timedelta(days=6)

    stats = get_weekly_stats(week_start, db)
    vs_last_week = get_achievement_rate_vs_last_week(week_start, stats["achievement_rate"], db)

    review = db.query(models.WeeklyReview).filter_by(user_id=user_id, week_start_date=week_start).first()
    kpt_data: dict = {"keep": [], "problem": [], "try": []}
    if review:
        for item in review.kpt_items:
            if len(kpt_data[item.type]) < 3:
                kpt_data[item.type].append(item.content)

    prev_week_start = week_start - timedelta(days=7)
    prev_review = db.query(models.WeeklyReview).filter_by(user_id=user_id, week_start_date=prev_week_start).first()
    prev_try_items: list = []
    if prev_review:
        prev_try_items = [
            {"content": i.content, "is_completed": i.is_completed}
            for i in prev_review.kpt_items if i.type == "try"
        ][:3]

    active_goals = db.query(models.CoachingGoal).filter_by(user_id=user_id, status="active").all()
    goals_data = [{"id": g.id, "title": g.title} for g in active_goals]

    prev_session = (
        db.query(models.CoachingSession)
        .filter_by(user_id=user_id, status="completed")
        .order_by(models.CoachingSession.created_at.desc())
        .first()
    )
    prev_summary: Optional[str] = prev_session.summary if prev_session else None

    return {
        "achievement": {
            "this_week_rate": stats["achievement_rate"],
            "vs_last_week": vs_last_week,
            "weakest_habit": stats.get("weakest_habit"),
            "strongest_habit": stats.get("strongest_habit"),
        },
        "kpt": kpt_data,
        "prev_try_items": prev_try_items,
        "active_goals": goals_data,
        "prev_session_summary": prev_summary,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
    }


def _format_context_str(context_data: dict) -> str:
    """Format coaching context data into a readable string for Claude."""
    achievement = context_data.get("achievement", {})
    rate = achievement.get("this_week_rate", 0)
    vs_last = achievement.get("vs_last_week")
    weakest = achievement.get("weakest_habit")
    strongest = achievement.get("strongest_habit")
    kpt = context_data.get("kpt", {})
    prev_try = context_data.get("prev_try_items", [])
    goals = context_data.get("active_goals", [])
    week_start = context_data.get("week_start", "")
    week_end = context_data.get("week_end", "")

    rate_line = f"【今週の習慣達成率】{rate}%"
    if vs_last:
        rate_line += f"（先週比 {vs_last}）"

    lines = [
        f"【今週】{week_start} 〜 {week_end}",
        rate_line,
    ]
    if strongest:
        lines.append(f"【最も達成できた習慣】{strongest}")
    if weakest:
        lines.append(f"【最も苦手な習慣】{weakest}")
    if kpt.get("keep"):
        lines.append("【Keep】" + "、".join(kpt["keep"]))
    if kpt.get("problem"):
        lines.append("【Problem】" + "、".join(kpt["problem"]))
    if kpt.get("try"):
        lines.append("【Try（今週の目標）】" + "、".join(kpt["try"]))
    if prev_try:
        parts = [f"{i['content']}（{'達成' if i['is_completed'] else '未達成'}）" for i in prev_try]
        lines.append("【先週のTry】" + "、".join(parts))
    else:
        lines.append("【先週のTry】なし")
    if goals:
        lines.append("【アクティブなゴール】" + "、".join(g["title"] for g in goals))
    else:
        lines.append("【アクティブなゴール】なし")
    return "\n".join(lines)


def build_system_prompt(context_data: dict) -> str:
    """Build the full system prompt from context data."""
    context_str = _format_context_str(context_data)
    prev_summary = context_data.get("prev_session_summary") or "（前回のセッションなし）"
    return (
        SYSTEM_PROMPT_TEMPLATE
        .replace("{context}", context_str)
        .replace("{previous_session}", prev_summary)
    )


def build_message_context(session, messages: list, max_recent: int = 5) -> tuple:
    """Return (system_prompt, recent_messages) limiting to last max_recent messages."""
    context_data = json.loads(session.context) if session.context else {}
    system = build_system_prompt(context_data)
    recent = messages[-max_recent:] if len(messages) > max_recent else messages
    return system, recent
