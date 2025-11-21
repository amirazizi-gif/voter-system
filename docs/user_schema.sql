-- =====================================================
-- VOTER DATABASE - AUTHENTICATION & ACCESS CONTROL
-- =====================================================

-- 1. CREATE USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'candidate', 'candidate_assistant', 'super_user', 'pdm')),
  dun VARCHAR(50), -- NULL for super_admin, required for others
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  CONSTRAINT users_dun_check CHECK (
    (role = 'super_admin' AND dun IS NULL) OR 
    (role != 'super_admin' AND dun IS NOT NULL)
  )
);

-- Create index for faster lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_dun ON users(dun);
CREATE INDEX idx_users_active ON users(is_active);

-- 2. ADD DUN COLUMN TO VOTERS TABLE (if not exists)
-- =====================================================
ALTER TABLE voters 
ADD COLUMN IF NOT EXISTS dun VARCHAR(50);

-- Create index for DUN filtering
CREATE INDEX IF NOT EXISTS idx_voters_dun ON voters(dun);

-- 3. CREATE AUDIT LOG TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- 'login', 'logout', 'update_tag', 'export', 'view'
  table_name VARCHAR(50),
  record_id BIGINT,
  old_value JSONB,
  new_value JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);

-- 4. CREATE SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

-- 5. ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on voters table
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on audit_log table
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 6. CREATE RLS POLICIES FOR VOTERS TABLE
-- =====================================================

-- Policy: Super Admin can see all voters
CREATE POLICY "super_admin_all_access" ON voters
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin' 
      AND users.is_active = true
    )
  );

-- Policy: Users can only see voters from their DUN
CREATE POLICY "dun_based_select" ON voters
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.dun = voters.dun 
      AND users.is_active = true
    )
  );

-- Policy: Only Candidates, Super Users, and PDMs can update voters
CREATE POLICY "authorized_update" ON voters
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.dun = voters.dun 
      AND users.role IN ('candidate', 'super_user', 'pdm')
      AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.dun = voters.dun 
      AND users.role IN ('candidate', 'super_user', 'pdm')
      AND users.is_active = true
    )
  );

-- 7. CREATE RLS POLICIES FOR USERS TABLE
-- =====================================================

-- Policy: Users can view their own profile
CREATE POLICY "users_view_own_profile" ON users
  FOR SELECT
  USING (id = auth.uid() OR role = 'super_admin');

-- Policy: Only super_admin can manage users
CREATE POLICY "super_admin_manage_users" ON users
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
      AND users.is_active = true
    )
  );

-- 8. CREATE RLS POLICIES FOR AUDIT LOG
-- =====================================================

-- Policy: Users can view their own audit logs
CREATE POLICY "users_view_own_audit" ON audit_log
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'super_admin'
    )
  );

-- Policy: System can insert audit logs
CREATE POLICY "system_insert_audit" ON audit_log
  FOR INSERT
  WITH CHECK (true);

-- 9. CREATE FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log voter updates
CREATE OR REPLACE FUNCTION log_voter_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, table_name, record_id, old_value, new_value)
  VALUES (
    auth.uid(),
    'update_tag',
    'voters',
    NEW.id,
    jsonb_build_object('tag', OLD.tag),
    jsonb_build_object('tag', NEW.tag)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 10. CREATE TRIGGERS
-- =====================================================

-- Trigger for users updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for voters updated_at
DROP TRIGGER IF EXISTS update_voters_updated_at ON voters;
CREATE TRIGGER update_voters_updated_at
  BEFORE UPDATE ON voters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for audit logging on voter updates
DROP TRIGGER IF EXISTS audit_voter_updates ON voters;
CREATE TRIGGER audit_voter_updates
  AFTER UPDATE ON voters
  FOR EACH ROW
  WHEN (OLD.tag IS DISTINCT FROM NEW.tag)
  EXECUTE FUNCTION log_voter_update();

-- 11. INSERT DEFAULT SUPER ADMIN (CHANGE PASSWORD IMMEDIATELY!)
-- =====================================================
-- Password: 'Admin123!' (CHANGE THIS IMMEDIATELY!)
-- This is a bcrypt hash, you'll need to hash your actual password

INSERT INTO users (username, password_hash, full_name, role, is_active)
VALUES ('superadmin', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Super Administrator', 'super_admin', true)
ON CONFLICT (username) DO NOTHING;

-- 12. GRANT PERMISSIONS
-- =====================================================

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON voters TO authenticated;
GRANT SELECT ON users TO authenticated;
GRANT INSERT ON audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_sessions TO authenticated;

-- Grant sequence permissions
GRANT USAGE ON SEQUENCE audit_log_id_seq TO authenticated;

-- 13. SAMPLE USER DATA (FOR TESTING - REMOVE IN PRODUCTION)
-- =====================================================
-- All passwords are: 'Test123!' (CHANGE IN PRODUCTION!)

-- Pantai Manis Users
INSERT INTO users (username, password_hash, full_name, role, dun, created_by)
VALUES 
  -- Candidates
  ('candidate1_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Candidate 1 Pantai Manis', 'candidate', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  ('candidate2_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Candidate 2 Pantai Manis', 'candidate', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  ('candidate3_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Candidate 3 Pantai Manis', 'candidate', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  
  -- Candidate Assistants
  ('assistant1_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Assistant 1 Pantai Manis', 'candidate_assistant', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  ('assistant2_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Assistant 2 Pantai Manis', 'candidate_assistant', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  ('assistant3_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Assistant 3 Pantai Manis', 'candidate_assistant', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  
  -- Super Users
  ('superuser1_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Super User 1 Pantai Manis', 'super_user', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  ('superuser2_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Super User 2 Pantai Manis', 'super_user', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  
  -- PDMs (5 for Pantai Manis)
  ('pdm1_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 1 Pantai Manis', 'pdm', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm2_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 2 Pantai Manis', 'pdm', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm3_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 3 Pantai Manis', 'pdm', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm4_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 4 Pantai Manis', 'pdm', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm5_pm', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 5 Pantai Manis', 'pdm', 'Pantai Manis', (SELECT id FROM users WHERE username = 'superadmin'))
ON CONFLICT (username) DO NOTHING;

-- Kawang Users (similar structure)
INSERT INTO users (username, password_hash, full_name, role, dun, created_by)
VALUES 
  ('candidate1_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Candidate 1 Kawang', 'candidate', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('candidate2_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Candidate 2 Kawang', 'candidate', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('candidate3_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Candidate 3 Kawang', 'candidate', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('assistant1_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Assistant 1 Kawang', 'candidate_assistant', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('assistant2_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Assistant 2 Kawang', 'candidate_assistant', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('assistant3_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Assistant 3 Kawang', 'candidate_assistant', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('superuser1_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Super User 1 Kawang', 'super_user', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('superuser2_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Super User 2 Kawang', 'super_user', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm1_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 1 Kawang', 'pdm', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm2_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 2 Kawang', 'pdm', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm3_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 3 Kawang', 'pdm', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm4_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 4 Kawang', 'pdm', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm5_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 5 Kawang', 'pdm', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm6_kw', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 6 Kawang', 'pdm', 'Kawang', (SELECT id FROM users WHERE username = 'superadmin'))
ON CONFLICT (username) DO NOTHING;

-- Limbahau Users
INSERT INTO users (username, password_hash, full_name, role, dun, created_by)
VALUES 
  ('candidate1_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Candidate 1 Limbahau', 'candidate', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('candidate2_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Candidate 2 Limbahau', 'candidate', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('candidate3_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Candidate 3 Limbahau', 'candidate', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('assistant1_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Assistant 1 Limbahau', 'candidate_assistant', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('assistant2_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Assistant 2 Limbahau', 'candidate_assistant', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('assistant3_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Assistant 3 Limbahau', 'candidate_assistant', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('superuser1_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Super User 1 Limbahau', 'super_user', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('superuser2_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'Super User 2 Limbahau', 'super_user', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm1_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 1 Limbahau', 'pdm', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm2_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 2 Limbahau', 'pdm', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm3_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 3 Limbahau', 'pdm', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm4_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 4 Limbahau', 'pdm', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm5_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 5 Limbahau', 'pdm', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm6_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 6 Limbahau', 'pdm', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm7_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 7 Limbahau', 'pdm', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm8_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 8 Limbahau', 'pdm', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin')),
  ('pdm9_lb', '$2b$10$rNc8KlGXy3Xs4A4x4LwMqOfqKb8BZpAG0SjFyMdp8FPXwY3KFqHBi', 'PDM 9 Limbahau', 'pdm', 'Limbahau', (SELECT id FROM users WHERE username = 'superadmin'))
ON CONFLICT (username) DO NOTHING;

-- =====================================================
-- SETUP COMPLETE
-- =====================================================

-- View all users
SELECT username, role, dun, is_active FROM users ORDER BY dun, role;