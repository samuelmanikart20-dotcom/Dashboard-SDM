-- Create PTP data table
-- This script creates the ptpdata table for PTP employee data

CREATE TABLE IF NOT EXISTS ptpdata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  npp VARCHAR(50),
  nama VARCHAR(255),
  tanggal_lahir VARCHAR(50),
  jabatan VARCHAR(255),
  entitas VARCHAR(255),
  unit_kerja VARCHAR(255),
  kategori VARCHAR(255),
  jenis_kelamin VARCHAR(10),
  organik_non_organik VARCHAR(50),
  pusat_pelayanan VARCHAR(255),
  non_operasional VARCHAR(255),
  status_laporan VARCHAR(255),
  bulan INT DEFAULT NULL,
  tahun INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_jenis_kelamin (jenis_kelamin),
  INDEX idx_entitas (entitas),
  INDEX idx_jabatan (jabatan),
  INDEX idx_organik_non_organik (organik_non_organik),
  INDEX idx_bulan_tahun (bulan, tahun),
  INDEX idx_npp (npp),
  INDEX idx_unit_kerja (unit_kerja)
);

-- Insert sample PTP data for testing
INSERT IGNORE INTO ptpdata (
  npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
  kategori, jenis_kelamin, organik_non_organik,
  pusat_pelayanan, non_operasional, status_laporan
) VALUES 
('100607', 'sianu', '2/12/2012', 'Sr. Asst. Officer Keuangan, Administrasi, SDM & Umum', 'Bagian Keu. Administrasi, SDM & Umum', 'PTP CABANG BANTEN',
 'ORGANIK (PTP)', 'P', 'ORGANIK', 'OPERASI TIDAK LANGSUNG', 'OPERASIONAL', 'ORGANIK PELINDO'),
('100782', 'bebas', '1/20/2024', 'Junior Officer', 'Branch Banten', 'PTP CABANG BANTEN',
 'ORGANIK (PTP)', 'L', 'ORGANIK', 'OPERASI LANGSUNG', 'OPERASIONAL', 'ORGANIK PELINDO');
