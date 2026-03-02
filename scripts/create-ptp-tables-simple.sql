-- Create PTP Database Tables (Simplified)
-- Script untuk membuat tabel-tabel yang diperlukan untuk sistem PTP

USE spmt_pelindo;

-- 1. Create ptp_daerah table for PTP regions
DROP TABLE IF EXISTS ptp_struktur_organisasi;
DROP TABLE IF EXISTS ptp_daerah;

CREATE TABLE ptp_daerah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  kode VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Create ptp_struktur_organisasi table for organizational structure images
CREATE TABLE ptp_struktur_organisasi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ptp_daerah_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ptp_daerah_id (ptp_daerah_id)
);

-- 3. Insert PTP regions data
INSERT INTO ptp_daerah (id, nama, kode) VALUES
(1, 'PTP Kantor Pusat Jakarta', 'Jakarta'),
(2, 'PTP Cabang Tanjung Priok', 'TPK'),
(3, 'PTP Cabang Banten', 'BTN'),
(4, 'PTP Cabang Cirebon', 'CRB'),
(5, 'PTP Cabang Pangka Balam', 'PKB'),
(6, 'PTP Cabang Tanjung Balam', 'TJB'),
(7, 'PTP Cabang Palembang', 'PLB'),
(8, 'PTP Cabang Teluk Bayur', 'TBY'),
(9, 'PTP Cabang Panjang', 'PJG'),
(10, 'PTP Cabang Bengkulu', 'BKL'),
(11, 'PTP Cabang Jambi', 'JMB'),
(12, 'PTP Cabang Pontianak', 'PTK');

-- 4. Show created tables
SELECT 'ptp_daerah table created' as status;
SELECT * FROM ptp_daerah ORDER BY id;

SELECT 'ptp_struktur_organisasi table created' as status;
DESCRIBE ptp_struktur_organisasi;
