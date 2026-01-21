"""add owner_id to clients

Revision ID: add_owner_id_to_clients
Revises: add_clients_activities
Create Date: 2024-02-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision = 'add_owner_id_to_clients'
down_revision = 'add_clients_activities'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add owner_id column to clients table
    op.execute("""
        ALTER TABLE clients 
        ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id)
    """)

def downgrade() -> None:
    op.execute("""
        ALTER TABLE clients 
        DROP COLUMN IF EXISTS owner_id
    """)