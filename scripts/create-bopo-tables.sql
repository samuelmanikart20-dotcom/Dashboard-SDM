-- Create BOPO tables with proper data types for large numbers
-- This script creates separate BOPO tables for each unit with DECIMAL(15,2) to support values up to 1 billion

-- Drop existing tables if they exist
DROP TABLE IF EXISTS bopo_spmt;
DROP TABLE IF EXISTS bopo_ptp;
DROP TABLE IF EXISTS bopo_ikt;
DROP TABLE IF EXISTS bopo_tcu;

-- Create BOPO SPMT table
CREATE TABLE bopo_spmt (
  id INT AUTO_INCREMENT PRIMARY KEY,
  daerah_id INT NOT NULL,
  bopo_ratio DECIMAL(10,4) NULL,
  produktivitas_efisiensi DECIMAL(15,2) NULL,  -- Changed to support up to 1 billion
  rasio_beban_penghasilan_usaha DECIMAL(10,4) NULL,
  bulan INT NOT NULL,
  tahun INT NOT NULL,
  keterangan TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (daerah_id) REFERENCES daerah(id),
  UNIQUE KEY unique_daerah_bulan_tahun (daerah_id, bulan, tahun),
  INDEX idx_daerah_bulan_tahun (daerah_id, bulan, tahun)
);

-- Create BOPO PTP table
CREATE TABLE bopo_ptp (
  id INT AUTO_INCREMENT PRIMARY KEY,
  daerah_id INT NOT NULL,
  bopo_ratio DECIMAL(10,4) NULL,
  produktivitas_efisiensi DECIMAL(15,2) NULL,  -- Changed to support up to 1 billion
  rasio_beban_penghasilan_usaha DECIMAL(10,4) NULL,
  bulan INT NOT NULL,
  tahun INT NOT NULL,
  keterangan TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (daerah_id) REFERENCES ptp_daerah(id),
  UNIQUE KEY unique_daerah_bulan_tahun (daerah_id, bulan, tahun),
  INDEX idx_daerah_bulan_tahun (daerah_id, bulan, tahun)
);

-- Create BOPO IKT table
-- Note: daerah_id references ikt_daerah(id), not daerah(id)
-- This is because IKT has its own daerah table (ikt_daerah) with 8 cabang
CREATE TABLE bopo_ikt (
  id INT AUTO_INCREMENT PRIMARY KEY,
  daerah_id INT NOT NULL,
  bopo_ratio DECIMAL(10,4) NULL,
  produktivitas_efisiensi DECIMAL(15,2) NULL,  -- Changed to support up to 1 billion
  rasio_beban_penghasilan_usaha DECIMAL(10,4) NULL,
  bulan INT NOT NULL,
  tahun INT NOT NULL,
  keterangan TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (daerah_id) REFERENCES ikt_daerah(id) ON DELETE CASCADE,
  UNIQUE KEY unique_daerah_bulan_tahun (daerah_id, bulan, tahun),
  INDEX idx_daerah_bulan_tahun (daerah_id, bulan, tahun)
);

-- Create BOPO TCU table
CREATE TABLE bopo_tcu (
  id INT AUTO_INCREMENT PRIMARY KEY,
  daerah_id INT NOT NULL,
  bopo_ratio DECIMAL(10,4) NULL,
  produktivitas_efisiensi DECIMAL(15,2) NULL,  -- Changed to support up to 1 billion
  rasio_beban_penghasilan_usaha DECIMAL(10,4) NULL,
  bulan INT NOT NULL,
  tahun INT NOT NULL,
  keterangan TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (daerah_id) REFERENCES daerah(id),
  UNIQUE KEY unique_daerah_bulan_tahun (daerah_id, bulan, tahun),
  INDEX idx_daerah_bulan_tahun (daerah_id, bulan, tahun)
);

-- Insert sample data for testing (optional)
-- You can remove this section if you don't need sample data
INSERT IGNORE INTO bopo_spmt (daerah_id, produktivitas_efisiensi, bulan, tahun, keterangan) VALUES
(1, 1000000000.00, 1, 2024, 'Sample 1 billion data'),
(1, 500000000.50, 2, 2024, 'Sample 500 million data'),
(2, 750000000.75, 1, 2024, 'Sample 750 million data');
