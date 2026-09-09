"""fix1_corrective_columns

Revision ID: a23fc7194cf4
Revises: 86f933fb6f9c
Create Date: 2026-09-09 10:46:40.929456

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a23fc7194cf4'
down_revision: Union[str, Sequence[str], None] = '86f933fb6f9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - safely add model_path and model_sha256 to inference_runs."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = [c['name'] for c in inspector.get_columns('inference_runs')]

    with op.batch_alter_table('inference_runs', schema=None) as batch_op:
        if 'model_path' not in existing_cols:
            batch_op.add_column(sa.Column('model_path', sa.String(), nullable=True))
        if 'model_sha256' not in existing_cols:
            batch_op.add_column(sa.Column('model_sha256', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_cols = [c['name'] for c in inspector.get_columns('inference_runs')]

    with op.batch_alter_table('inference_runs', schema=None) as batch_op:
        if 'model_sha256' in existing_cols:
            batch_op.drop_column('model_sha256')
        if 'model_path' in existing_cols:
            batch_op.drop_column('model_path')
