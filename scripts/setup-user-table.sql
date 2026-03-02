-- Setup database untuk tabel user (singular) dengan fitur kelola akun
USE spmt_pelindo;

-- Drop existing user table if exists
DROP TABLE IF EXISTS user;

-- Create user table with new fields
CREATE TABLE user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_is_active (is_active)
);

-- Insert default admin and user accounts
-- Password: admin123 (hashed with bcrypt)
INSERT INTO user (name, email, password, role, is_active) VALUES 
('Admin SPMT', 'admin@spmt.com', '$2a$10$n.6nlyhd.Gr05O3lbUPybODSm/GRPOHbKCvaarYHKWI3xVSmLAdFa', 'admin', TRUE),
('User SPMT', 'user@spmt.com', '$2a$10$n.6nlyhd.Gr05O3lbUPybODSm/GRPOHbKCvaarYHKWI3xVSmLAdFa', 'user', TRUE),
('Manager Pelindo', 'manager@pelindo.com', '$2a$10$n.6nlyhd.Gr05O3lbUPybODSm/GRPOHbKCvaarYHKWI3xVSmLAdFa', 'user', TRUE),
('Staff Operasional', 'staff@pelindo.com', '$2a$10$n.6nlyhd.Gr05O3lbUPybODSm/GRPOHbKCvaarYHKWI3xVSmLAdFa', 'user', TRUE),
('Supervisor', 'supervisor@pelindo.com', '$2a$10$n.6nlyhd.Gr05O3lbUPybODSm/GRPOHbKCvaarYHKWI3xVSmLAdFa', 'user', FALSE);

-- Verify table creation
DESCRIBE user;

-- Show sample data
SELECT id, name, email, role, is_active, created_at, last_login FROM user;

-- Show user statistics
SELECT 
  role,
  COUNT(*) as total_users,
  SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_users,
  SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_users
FROM user 
GROUP BY role;







