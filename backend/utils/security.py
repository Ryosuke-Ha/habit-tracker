import html
from datetime import date
from typing import Dict, Tuple

# ---------------------------------------------------------------------------
# Input sanitization
# ---------------------------------------------------------------------------

_TEMPLATE_PLACEHOLDER_TABLE = str.maketrans({"{": "&#123;", "}": "&#125;"})


def sanitize_user_input(text: str) -> str:
    """Sanitize user-provided text for safe embedding in XML-based AI prompts.

    Applies two layers of protection:
    1. XML-escape special characters (&, <, >, ", ')
    2. Escape { } to prevent template placeholder injection
    """
    if not text:
        return text
    text = html.escape(str(text), quote=True)
    text = text.translate(_TEMPLATE_PLACEHOLDER_TABLE)
    return text


def truncate(text: str, max_chars: int) -> str:
    """Truncate text to max_chars characters."""
    if not text:
        return text
    return str(text)[:max_chars]


# ---------------------------------------------------------------------------
# In-memory rate limiter (per-user, daily window)
# ---------------------------------------------------------------------------

# Stores (call_count, last_reset_date) keyed by user_id
_rate_limit_store: Dict[str, Tuple[int, date]] = {}


class ClaudeRateLimiter:
    """Simple in-memory daily rate limiter for Claude API calls per user."""

    def __init__(self, max_calls_per_day: int = 30):
        self.max_calls_per_day = max_calls_per_day

    def is_allowed(self, user_id: str) -> bool:
        """Return True if the user is within their daily limit."""
        today = date.today()
        count, last_date = _rate_limit_store.get(user_id, (0, today))
        if last_date < today:
            count = 0
        if count >= self.max_calls_per_day:
            return False
        _rate_limit_store[user_id] = (count + 1, today)
        return True

    def reset(self, user_id: str) -> None:
        """Reset the counter for a user (test helper)."""
        _rate_limit_store.pop(user_id, None)

    def reset_all(self) -> None:
        """Reset all counters (test helper)."""
        _rate_limit_store.clear()


# Singleton used across the application
claude_rate_limiter = ClaudeRateLimiter(max_calls_per_day=30)
