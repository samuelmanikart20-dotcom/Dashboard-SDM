-- Drop the old spmt_data table and create new spmtdata table
-- This script will completely remove spmt_data and create spmtdata with the same structure

-- Drop the old table
DROP TABLE IF EXISTS spmt_data;

-- Create new spmtdata table with status_laporan_rakomdir and pendidikan columns
CREATE TABLE IF NOT EXISTS spmtdata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  npp VARCHAR(50),
  nama VARCHAR(255),
  tanggal_lahir VARCHAR(50),
  jabatan VARCHAR(255),
  entitas VARCHAR(255),
  unit_kerja VARCHAR(255),
  kategori VARCHAR(255),
  jenis_kelamin VARCHAR(50),
  pendidikan VARCHAR(50) NULL,
  organik_non_organik VARCHAR(50),
  pusat_pelayanan VARCHAR(255),
  non_operasional VARCHAR(255),
  status_laporan_rakomdir VARCHAR(255),
  bulan INT DEFAULT NULL,
  tahun INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_jenis_kelamin (jenis_kelamin),
  INDEX idx_entitas (entitas),
  INDEX idx_jabatan (jabatan),
  INDEX idx_organik_non_organik (organik_non_organik),
  INDEX idx_bulan_tahun (bulan, tahun),
  INDEX idx_npp (npp)
);

-- Insert sample data for testing (optional)
-- This data matches the format from your Excel image
INSERT IGNORE INTO spmtdata (
  npp, nama, tanggal_lahir, jabatan, entitas, unit_kerja,
  kategori, jenis_kelamin, organik_non_organik,
  pusat_pelayanan, non_operasional, status_laporan
) VALUES 
('874745', 'Margana Dongoran', '13-Apr-19', 'Manager SPMT', 'SPMT-TANJUNG WANGI', 'NON ORG P',
 'PENGELOLAAN OPERASIONAL ORGANIK PELINDO', 'L', 'ORGANIK', 'OPERASIONAL', 'NON OPERASIONAL', 'AKTIF'),
('802324', 'Pranawa Kusmana', '11-Jan-19', 'Supervisor SPMT', 'SPMT-BIMA BADAS', 'ORGANIK',
 'OPERASIONAL NON OPERASIONAL ORGANIK', 'L', 'ORGANIK', 'OPERASIONAL', 'NON OPERASIONAL', 'AKTIF'),
('753858', 'Dodo Ramadan', '19-Dec-19', 'Manager SPMT', 'SPMT-TANJUNG INTAN', 'ORGANIK',
 'OPERASIONAL NON OPERASIONAL NON ORGANIK', 'L', 'NON ORGANIK', 'OPERASIONAL', 'NON OPERASIONAL', 'AKTIF'),
('771529', 'Kemba Sihombing', '17-Dec-19', 'Koordinator SPMT', 'SPMT-LHOKSEUMAWE', 'NON ORG',
 'OPERASIONAL OPERASIONAL ORGANIK PELINDO', 'L', 'ORGANIK', 'OPERASIONAL', 'OPERASIONAL', 'AKTIF'),
('354627', 'Cengkal Nugroho', '19-Mar-19', 'SVP Mana SPMT', 'SPMT-BENOA', 'NON ORG',
 'PENGELOLAAN OPERASIONAL ORGANIK PELINDO', 'L', 'ORGANIK', 'OPERASIONAL', 'NON OPERASIONAL', 'AKTIF'),
('912122', 'Wahyu Wahyudin', '17-Jan-18', 'Staf SDM SPMT', 'SPMT-BUMIHARJO BA...', 'ORGANIK',
 'PENGELOLAAN PENGELOLAAN OPERASIONAL PELINDO', 'P', 'ORGANIK', 'OPERASIONAL', 'NON OPERASIONAL', 'AKTIF'),
('173631', 'Ir. Kurnia Lestari', '18-Mar-19', 'Supervisor SPMT', 'SPMT-TANJUNG WANGI', 'ORGANIK',
 'PENGELOLAAN NON OPERASIONAL NON ORGANIK', 'P', 'NON ORGANIK', 'NON OPERASIONAL', 'NON OPERASIONAL', 'AKTIF'),
('883383', 'Victoria Aryani', '30-Jan-19', 'SVP Mana SPMT', 'SPMT-LEMBAR', 'NON ORG',
 'OPERASIONAL NON OPERASIONAL ORGANIK PELINDO', 'P', 'ORGANIK', 'OPERASIONAL', 'NON OPERASIONAL', 'AKTIF'),
('836767', 'Tania Lestari', '29-Mar-19', 'Staf Adm SPMT', 'SPMT-BENOA', 'NON ORG',
 'OPERASIONAL OPERASIONAL ORGANIK PELINDO', 'P', 'ORGANIK', 'OPERASIONAL', 'OPERASIONAL', 'AKTIF');
