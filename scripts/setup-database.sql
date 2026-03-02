-- Setup Database untuk SPMT System
-- Jalankan script ini di MySQL client atau phpMyAdmin

-- 1. Buat database jika belum ada
CREATE DATABASE IF NOT EXISTS spmt_pelindo;
USE spmt_pelindo;

-- 2. Drop tabel lama jika ada untuk menghindari konflik
DROP TABLE IF EXISTS spmtdata;

-- 3. Buat tabel spmtdata dengan field bulan dan tahun
CREATE TABLE spmtdata (
  id INT AUTO_INCREMENT PRIMARY KEY,
  no VARCHAR(50) NULL,
  npp VARCHAR(50) NULL,
  nama VARCHAR(255) NULL,
  tanggal_lahir VARCHAR(50) NULL,
  nama_jabatan VARCHAR(255) NULL,
  entitas VARCHAR(255) NULL,
  ja_kantor_pusat VARCHAR(255) NULL,
  kategori VARCHAR(255) NULL,
  jenis_kelamin VARCHAR(50) NULL,
  jenis_pekerja VARCHAR(255) NULL,
  pusat_pelayanan VARCHAR(255) NULL,
  status_laporan_rakomdir VARCHAR(255) NULL,
  bulan INT NOT NULL,
  tahun INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bulan_tahun (bulan, tahun),
  INDEX idx_npp (npp)
);

-- 4. Buat tabel users untuk login
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'USER') DEFAULT 'USER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Insert default admin user (password: password123)
INSERT INTO users (email, password, name, role) VALUES 
('admin@example.com', '$2a$10$rQZ9K8J2mN3vB4xL5wQ6eR7sT8uV9wX0yZ1aB2cD3eF4gH5iJ6kL7mN8oP9', 'Admin', 'ADMIN')
ON DUPLICATE KEY UPDATE id=id;

-- 6. Insert default user (password: password123)
INSERT INTO users (email, password, name, role) VALUES 
('user@example.com', '$2a$10$rQZ9K8J2mN3vB4xL5wQ6eR7sT8uV9wX0yZ1aB2cD3eF4gH5iJ6kL7mN8oP9', 'User', 'USER')
ON DUPLICATE KEY UPDATE id=id;

-- 7. Insert sample SPMT data untuk beberapa bulan
-- Januari 2024
INSERT INTO spmtdata (no, npp, nama, tanggal_lahir, nama_jabatan, entitas, ja_kantor_pusat, kategori, jenis_kelamin, jenis_pekerja, pusat_pelayanan, status_laporan_rakomdir, bulan, tahun) VALUES
('1', '12345', 'John Doe', '1990-01-01', 'Manager', 'IT', 'JA Pusat', 'Karyawan Tetap', 'Laki-laki', 'Organik', 'Operasional', 'Aktif', 1, 2024),
('2', '12346', 'Jane Smith', '1992-05-15', 'Staff', 'HR', 'JA Pusat', 'Karyawan Tetap', 'Perempuan', 'Organik', 'Operasional', 'Aktif', 1, 2024),
('3', '12347', 'Bob Johnson', '1988-12-20', 'Supervisor', 'Finance', 'JA Pusat', 'Karyawan Kontrak', 'Laki-laki', 'Non Organik', 'Non Operasional', 'Aktif', 1, 2024);

-- Februari 2024
INSERT INTO spmtdata (no, npp, nama, tanggal_lahir, nama_jabatan, entitas, ja_kantor_pusat, kategori, jenis_kelamin, jenis_pekerja, pusat_pelayanan, status_laporan_rakomdir, bulan, tahun) VALUES
('4', '12348', 'Alice Brown', '1995-08-10', 'Analyst', 'Marketing', 'JA Pusat', 'Karyawan Tetap', 'Perempuan', 'Organik', 'Operasional', 'Aktif', 2, 2024),
('5', '12349', 'Charlie Wilson', '1991-03-25', 'Coordinator', 'Operations', 'JA Pusat', 'Karyawan Kontrak', 'Laki-laki', 'Non Organik', 'Operasional', 'Aktif', 2, 2024);

-- Maret 2024
INSERT INTO spmtdata (no, npp, nama, tanggal_lahir, nama_jabatan, entitas, ja_kantor_pusat, kategori, jenis_kelamin, jenis_pekerja, pusat_pelayanan, status_laporan_rakomdir, bulan, tahun) VALUES
('6', '12350', 'Diana Lee', '1993-07-12', 'Manager', 'Sales', 'JA Pusat', 'Karyawan Tetap', 'Perempuan', 'Organik', 'Operasional', 'Aktif', 3, 2024),
('7', '12351', 'Edward Chen', '1989-11-30', 'Staff', 'Legal', 'JA Pusat', 'Karyawan Tetap', 'Laki-laki', 'Organik', 'Non Operasional', 'Aktif', 3, 2024);

-- 8. Tampilkan struktur tabel
DESCRIBE spmtdata;
DESCRIBE users;

-- 9. Tampilkan sample data
SELECT bulan, tahun, COUNT(*) as total_data FROM spmtdata GROUP BY bulan, tahun ORDER BY tahun, bulan;
SELECT * FROM spmtdata LIMIT 5;
SELECT * FROM users;
