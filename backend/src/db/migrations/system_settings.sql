CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO system_settings (key, value) VALUES
    ('email_config', '{"smtp_host": "smtp.example.com", "smtp_port": 587, "smtp_secure": true}'),
    ('backup_config', '{"auto_backup": true, "backup_frequency": "daily", "retention_days": 30}'),
    ('notification_settings', '{"email_notifications": true, "push_notifications": false}')
ON CONFLICT (key) DO NOTHING;