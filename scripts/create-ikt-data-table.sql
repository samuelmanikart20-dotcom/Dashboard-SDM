-- Create IKT data table for employee data storage
CREATE TABLE IF NOT EXISTS iktdata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  npp VARCHAR(50) NOT NULL,
  nama VARCHAR(255) NOT NULL,
  tanggal_lahir DATE,
  jabatan VARCHAR(255),
  entitas VARCHAR(255),
  unit_kerja VARCHAR(255),
  kategori VARCHAR(100),
  jenis_kelamin ENUM('Laki-laki', 'Perempuan'),
  organik_non_organik ENUM('Organik', 'Non Organik'),
  pusat_pelayanan ENUM('Operasional', 'Non Operasional'),
  non_operasional VARCHAR(255),
  status_laporan VARCHAR(100),
  bulan INT NOT NULL,
  tahun INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for better performance
  INDEX idx_bulan_tahun (bulan, tahun),
  INDEX idx_unit_kerja (unit_kerja),
  INDEX idx_organik (organik_non_organik),
  INDEX idx_pelayanan (pusat_pelayanan)
);
