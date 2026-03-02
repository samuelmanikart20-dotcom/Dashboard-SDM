-- Create PTP Database Tables
-- Script untuk membuat tabel-tabel yang diperlukan untuk sistem PTP

USE spmt_pelindo;

-- 1. Create ptp_daerah table for PTP regions
CREATE TABLE IF NOT EXISTS ptp_daerah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  kode VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Create ptp_struktur_organisasi table for organizational structure images
CREATE TABLE IF NOT EXISTS ptp_struktur_organisasi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ptp_daerah_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ptp_daerah_id) REFERENCES ptp_daerah(id) ON DELETE CASCADE,
  INDEX idx_ptp_daerah_id (ptp_daerah_id)
);

-- 3. Insert PTP regions data
INSERT INTO ptp_daerah (nama, kode) VALUES
('PTP Kantor Pusat Jakarta', 'Jakarta'),
('PTP Cabang Tanjung Priok', 'TPK'),
('PTP Cabang Banten', 'BTN'),
('PTP Cabang Cirebon', 'CRB'),
('PTP Cabang Pangka Balam', 'PKB'),
('PTP Cabang Tanjung Balam', 'TJB'),
('PTP Cabang Palembang', 'PLB'),
('PTP Cabang Teluk Bayur', 'TBY'),
('PTP Cabang Panjang', 'PJG'),
('PTP Cabang Bengkulu', 'BKL'),
('PTP Cabang Jambi', 'JMB'),
('PTP Cabang Pontianak', 'PTK')
ON DUPLICATE KEY UPDATE nama=VALUES(nama);

-- 4. Show created tables
DESCRIBE ptp_daerah;
DESCRIBE ptp_struktur_organisasi;

-- 5. Show inserted data
SELECT * FROM ptp_daerah ORDER BY nama;
