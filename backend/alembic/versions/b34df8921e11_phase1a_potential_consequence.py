"""phase1a_potential_consequence

Revision ID: b34df8921e11
Revises: a23fc7194cf4
Create Date: 2026-09-09 11:01:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b34df8921e11'
down_revision: Union[str, Sequence[str], None] = 'a23fc7194cf4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - safely add potential_consequence and risk_factors_json columns."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # 1. Update events table
    event_cols = [c['name'] for c in inspector.get_columns('events')]
    with op.batch_alter_table('events', schema=None) as batch_op:
        if 'potential_consequence' not in event_cols:
            batch_op.add_column(sa.Column('potential_consequence', sa.Text(), nullable=True))
        if 'risk_factors_json' not in event_cols:
            batch_op.add_column(sa.Column('risk_factors_json', sa.Text(), nullable=True))

    # 2. Update risk_assessments table
    ra_cols = [c['name'] for c in inspector.get_columns('risk_assessments')]
    with op.batch_alter_table('risk_assessments', schema=None) as batch_op:
        if 'potential_consequence' not in ra_cols:
            batch_op.add_column(sa.Column('potential_consequence', sa.Text(), nullable=True))
        if 'risk_factors_json' not in ra_cols:
            batch_op.add_column(sa.Column('risk_factors_json', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    event_cols = [c['name'] for c in inspector.get_columns('events')]
    with op.batch_alter_table('events', schema=None) as batch_op:
        if 'risk_factors_json' in event_cols:
            batch_op.drop_column('risk_factors_json')
        if 'potential_consequence' in event_cols:
            batch_op.drop_column('potential_consequence')

    ra_cols = [c['name'] for c in inspector.get_columns('risk_assessments')]
    with op.batch_alter_table('risk_assessments', schema=None) as batch_op:
        if 'potential_consequence' in ra_cols:
            batch_op.drop_column('potential_consequence')
