from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = 'add_mercadolibre_tables'
down_revision = None  # Update this with your previous migration
branch_labels = None
depends_on = None

def upgrade():
    # Add meli_item_id to products table
    op.add_column('products', sa.Column('meli_item_id', sa.String(50), nullable=True))
    op.create_index('idx_meli_item_id', 'products', ['meli_item_id'])

    # Create MeLi sync log table
    op.create_table(
        'meli_sync_log',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('product_id', sa.Integer, sa.ForeignKey('products.id', ondelete='CASCADE')),
        sa.Column('meli_item_id', sa.String(50), nullable=False),
        sa.Column('success', sa.Boolean, nullable=False),
        sa.Column('error_details', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, default=datetime.utcnow),
    )
    op.create_index('idx_meli_sync_product', 'meli_sync_log', ['product_id'])
    op.create_index('idx_meli_sync_created', 'meli_sync_log', ['created_at'])

    # Create MeLi token storage table
    op.create_table(
        'meli_tokens',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('access_token', sa.String(255), nullable=False),
        sa.Column('refresh_token', sa.String(255), nullable=False),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime, nullable=False, default=datetime.utcnow)
    )

def downgrade():
    op.drop_column('products', 'meli_item_id')
    op.drop_table('meli_sync_log')
    op.drop_table('meli_tokens')