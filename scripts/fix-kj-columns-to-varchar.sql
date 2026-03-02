-- Script untuk mengubah kolom kj_individu dan kj_posisi dari DECIMAL ke VARCHAR
-- JALANKAN SCRIPT INI DI DATABASE ANDA SEKARANG!

-- Untuk tabel org_position_nodes (SPMT)
-- Ubah dari DECIMAL ke VARCHAR untuk mendukung huruf dan angka
ALTER TABLE org_position_nodes 
  MODIFY COLUMN kj_individu VARCHAR(64) NULL,
  MODIFY COLUMN kj_posisi VARCHAR(64) NULL;

-- Untuk tabel struktur_organisasi_ptp (PTP)
-- Ubah dari DECIMAL ke VARCHAR untuk mendukung huruf dan angka
ALTER TABLE struktur_organisasi_ptp 
  MODIFY COLUMN kj_individu VARCHAR(64) NULL,
  MODIFY COLUMN kj_posisi VARCHAR(64) NULL;

-- Verifikasi: Cek tipe data kolom setelah diubah
-- SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = 'spmt_pelindo' 
--   AND TABLE_NAME IN ('org_position_nodes', 'struktur_organisasi_ptp')
--   AND COLUMN_NAME IN ('kj_individu', 'kj_posisi');



















