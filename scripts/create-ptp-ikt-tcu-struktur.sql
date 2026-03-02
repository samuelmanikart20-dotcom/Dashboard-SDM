-- Create query untuk tabel struktur organisasi PTP, IKT, dan TCU
-- Script untuk membuat tabel-tabel struktur organisasi dengan kolom lengkap

USE spmt_pelindo;

-- ============================================
-- Struktur PTP
-- ============================================
CREATE TABLE IF NOT EXISTS struktur_organisasi_ptp (
  id_posisi_sap VARCHAR(64) NOT NULL,
  id_posisi_atasan VARCHAR(64) NULL,
  daerah_id INT NOT NULL,
  nama VARCHAR(255) NULL,
  jabatan VARCHAR(255) NULL,
  unit_kerja VARCHAR(255) NULL,
  nipp VARCHAR(64) NULL,
  direktorat VARCHAR(255) NULL,
  photo_url VARCHAR(512) NULL,
  no_hp VARCHAR(64) NULL,
  tmt_jabatan DATE NULL,
  periode_jabatan VARCHAR(128) NULL,
  kj_individu VARCHAR(64) NULL,
  kj_posisi VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daerah_id_sap_ptp (daerah_id, id_posisi_sap),
  KEY idx_daerah_ptp (daerah_id),
  KEY idx_nipp_ptp (nipp),
  CONSTRAINT fk_org_nodes_daerah_ptp FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Struktur IKT
-- ============================================
CREATE TABLE IF NOT EXISTS struktur_organisasi_ikt (
  id_posisi_sap VARCHAR(64) NOT NULL,
  id_posisi_atasan VARCHAR(64) NULL,
  daerah_id INT NOT NULL,
  nama VARCHAR(255) NULL,
  jabatan VARCHAR(255) NULL,
  unit_kerja VARCHAR(255) NULL,
  nipp VARCHAR(64) NULL,
  direktorat VARCHAR(255) NULL,
  photo_url VARCHAR(512) NULL,
  no_hp VARCHAR(64) NULL,
  tmt_jabatan DATE NULL,
  periode_jabatan VARCHAR(128) NULL,
  kj_individu VARCHAR(64) NULL,
  kj_posisi VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daerah_id_sap_ikt (daerah_id, id_posisi_sap),
  KEY idx_daerah_ikt (daerah_id),
  KEY idx_nipp_ikt (nipp),
  CONSTRAINT fk_org_nodes_daerah_ikt FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Struktur TCU
-- ============================================
CREATE TABLE IF NOT EXISTS struktur_organisasi_tcu (
  id_posisi_sap VARCHAR(64) NOT NULL,
  id_posisi_atasan VARCHAR(64) NULL,
  daerah_id INT NOT NULL,
  nama VARCHAR(255) NULL,
  jabatan VARCHAR(255) NULL,
  unit_kerja VARCHAR(255) NULL,
  nipp VARCHAR(64) NULL,
  direktorat VARCHAR(255) NULL,
  photo_url VARCHAR(512) NULL,
  no_hp VARCHAR(64) NULL,
  tmt_jabatan DATE NULL,
  periode_jabatan VARCHAR(128) NULL,
  kj_individu VARCHAR(64) NULL,
  kj_posisi VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daerah_id_sap_tcu (daerah_id, id_posisi_sap),
  KEY idx_daerah_tcu (daerah_id),
  KEY idx_nipp_tcu (nipp),
  CONSTRAINT fk_org_nodes_daerah_tcu FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Verifikasi tabel yang dibuat
-- ============================================
DESCRIBE struktur_organisasi_ptp;
DESCRIBE struktur_organisasi_ikt;
DESCRIBE struktur_organisasi_tcu;

-- ============================================
-- Catatan:
-- - Semua tabel menggunakan foreign key ke tabel daerah(id)
-- - Unique constraint pada kombinasi daerah_id dan id_posisi_sap
-- - Index pada daerah_id dan nipp untuk performa query yang lebih baik
-- - Kolom tambahan: no_hp, tmt_jabatan, periode_jabatan, kj_individu, kj_posisi
-- ============================================










































