-- database/init.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Channels
CREATE TABLE channels (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500),
    description TEXT,
    members_count INTEGER DEFAULT 0,
    photo_url TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error', 'deleted')),
    parse_frequency INTEGER DEFAULT 300,
    last_parsed_at TIMESTAMP,
    last_message_date TIMESTAMP,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Messages
CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    message_id BIGINT NOT NULL,
    text TEXT,
    date TIMESTAMP NOT NULL,
    views INTEGER DEFAULT 0,
    forwards INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    reactions JSONB,
    edit_date TIMESTAMP,
    media_type VARCHAR(50),
    media_url TEXT,
    media_metadata JSONB,
    author_id BIGINT,
    author_name VARCHAR(255),
    is_forwarded BOOLEAN DEFAULT FALSE,
    forward_from JSONB,
    reply_to_msg_id BIGINT,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, message_id)
);

-- Workers
CREATE TABLE workers (
    id SERIAL PRIMARY KEY,
    worker_id VARCHAR(255) UNIQUE NOT NULL,
    worker_name VARCHAR(255),
    hostname VARCHAR(255),
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'idle', 'busy', 'offline', 'error')),
    last_heartbeat TIMESTAMP,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    jobs_completed INTEGER DEFAULT 0,
    jobs_failed INTEGER DEFAULT 0,
    messages_processed INTEGER DEFAULT 0,
    version VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    job_uuid UUID DEFAULT uuid_generate_v4() UNIQUE,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    worker_id VARCHAR(255) REFERENCES workers(worker_id),
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('initial', 'update', 'full_sync', 'manual')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'running', 'completed', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 5,
    messages_collected INTEGER DEFAULT 0,
    messages_target INTEGER,
    progress_percent DECIMAL(5,2) DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Message Queue (для отслеживания обработки)
CREATE TABLE message_queue (
    id BIGSERIAL PRIMARY KEY,
    batch_id UUID DEFAULT uuid_generate_v4(),
    worker_id VARCHAR(255) NOT NULL,
    channel_id INTEGER NOT NULL,
    messages_count INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    error_message TEXT
);

-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Metrics
CREATE TABLE system_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2),
    labels JSONB,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_messages_channel_date ON messages(channel_id, date DESC);
CREATE INDEX idx_messages_date ON messages(date DESC);
CREATE INDEX idx_messages_text_search ON messages USING gin(to_tsvector('russian', text));
CREATE INDEX idx_messages_author ON messages(author_id) WHERE author_id IS NOT NULL;

CREATE INDEX idx_jobs_status_priority ON jobs(status, priority DESC, created_at);
CREATE INDEX idx_jobs_channel ON jobs(channel_id, status);
CREATE INDEX idx_jobs_worker ON jobs(worker_id) WHERE worker_id IS NOT NULL;

CREATE INDEX idx_channels_status ON channels(status) WHERE status = 'active';
CREATE INDEX idx_channels_username ON channels(username);

CREATE INDEX idx_workers_status ON workers(status, last_heartbeat DESC);
CREATE INDEX idx_workers_worker_id ON workers(worker_id);

CREATE INDEX idx_message_queue_status ON message_queue(status, received_at);

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_channels_updated_at 
    BEFORE UPDATE ON channels
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean old metrics
CREATE OR REPLACE FUNCTION clean_old_metrics()
RETURNS void AS $$
BEGIN
    DELETE FROM system_metrics 
    WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Views
CREATE VIEW channel_statistics AS
SELECT 
    c.id,
    c.username,
    c.title,
    c.status,
    COUNT(DISTINCT m.id) as total_messages,
    AVG(m.views) as avg_views,
    MAX(m.date) as last_message_date,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'completed') as completed_jobs,
    COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'failed') as failed_jobs
FROM channels c
LEFT JOIN messages m ON c.id = m.channel_id
LEFT JOIN jobs j ON c.id = j.channel_id
GROUP BY c.id, c.username, c.title, c.status;

CREATE VIEW worker_statistics AS
SELECT 
    w.worker_id,
    w.worker_name,
    w.status,
    w.last_heartbeat,
    w.jobs_completed,
    w.jobs_failed,
    w.messages_processed,
    COUNT(j.id) FILTER (WHERE j.status = 'running') as active_jobs,
    EXTRACT(EPOCH FROM (NOW() - w.last_heartbeat)) as seconds_since_heartbeat
FROM workers w
LEFT JOIN jobs j ON w.worker_id = j.worker_id
GROUP BY w.worker_id, w.worker_name, w.status, w.last_heartbeat, 
         w.jobs_completed, w.jobs_failed, w.messages_processed;
