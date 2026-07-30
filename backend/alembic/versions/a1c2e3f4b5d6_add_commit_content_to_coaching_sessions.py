"""add commit_content to coaching_sessions

Revision ID: a1c2e3f4b5d6
Revises: 54db6a889795
Create Date: 2026-06-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c2e3f4b5d6'
down_revision: Union[str, None] = '54db6a889795'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('coaching_sessions',
                  sa.Column('commit_content', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('coaching_sessions', 'commit_content')
