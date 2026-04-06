-- Create IKT Daerah Table
-- Script untuk membuat tabel ikt_daerah dan mengisi data 8 cabang IKT

USE spmt_pelindo_revisi;

-- 1. Create ikt_daerah table for IKT regions/cabang
CREATE TABLE IF NOT EXISTS ikt_daerah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  kode VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Insert IKT 8 cabang data dengan ID eksplisit untuk konsistensi
INSERT INTO ikt_daerah (id, nama, kode) VALUES
(1, 'BALIKPAPAN', 'IKT-BPP'),
(2, 'BANJARMASIN', 'IKT-BJM'),
(3, 'BELAWAN', 'IKT-BLW'),
(4, 'Branch Jakarta', 'IKT-JKT'),
(5, 'KANTOR PUSAT', 'IKT-KP'),
(6, 'MAKASSAR', 'IKT-MKS'),
(7, 'PONTIANAK', 'IKT-PTK'),
(8, 'TANJUNG PRIOK', 'IKT-TPK')
ON DUPLICATE KEY UPDATE 
  nama=VALUES(nama),
  kode=VALUES(kode);

-- 3. Show created table structure
DESCRIBE ikt_daerah;

-- 4. Show inserted data
SELECT * FROM ikt_daerah ORDER BY id;

