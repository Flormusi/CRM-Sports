"""add clients and activities tables

Revision ID: add_clients_activities
Revises: initial_schema
Create Date: 2024-02-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from app.models import DealStage

revision = 'add_clients_activities'
down_revision = 'initial_schema'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Create clients table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS clients (
            id SERIAL PRIMARY KEY,
            name VARCHAR NOT NULL,
            email VARCHAR UNIQUE,
            phone VARCHAR,
            company VARCHAR,
            owner_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )
    """)

    # Create activities table if it doesn't exist
    op.execute("""
        CREATE TABLE IF NOT EXISTS activities (
            id SERIAL PRIMARY KEY,
            deal_id INTEGER REFERENCES deals(id),
            type VARCHAR,
            description VARCHAR,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        )
    """)

def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS activities")
    op.execute("DROP TABLE IF EXISTS clients")