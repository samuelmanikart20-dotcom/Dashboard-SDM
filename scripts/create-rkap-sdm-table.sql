-- Create RKAP SDM table for storing manual RKAP values per category per month and year
CREATE TABLE IF NOT EXISTS rkap_sdm (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kategori VARCHAR(255) NOT NULL,
  bulan INT NOT NULL,
  tahun INT NOT NULL,
  nilai INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_kategori_bulan_tahun (kategori, bulan, tahun),
  INDEX idx_tahun (tahun),
  INDEX idx_bulan_tahun (bulan, tahun),
  INDEX idx_kategori (kategori)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



