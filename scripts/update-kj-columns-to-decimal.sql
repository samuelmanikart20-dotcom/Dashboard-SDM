-- Script untuk memastikan kolom kj_individu dan kj_posisi sebagai VARCHAR (mendukung huruf dan angka)
-- Jalankan script ini di database Anda jika kolom sudah diubah ke DECIMAL sebelumnya

-- Untuk tabel org_position_nodes (SPMT)
-- Ubah kembali ke VARCHAR jika sudah diubah ke DECIMAL
ALTER TABLE org_position_nodes 
  MODIFY COLUMN kj_individu VARCHAR(64) NULL,
  MODIFY COLUMN kj_posisi VARCHAR(64) NULL;

-- Jika kolom belum ada, gunakan query ini:
-- ALTER TABLE org_position_nodes 
--   ADD COLUMN kj_individu VARCHAR(64) NULL,
--   ADD COLUMN kj_posisi VARCHAR(64) NULL;

-- Untuk tabel struktur_organisasi_ptp (PTP)
-- Ubah kembali ke VARCHAR jika sudah diubah ke DECIMAL
ALTER TABLE struktur_organisasi_ptp 
  MODIFY COLUMN kj_individu VARCHAR(64) NULL,
  MODIFY COLUMN kj_posisi VARCHAR(64) NULL;

-- Jika kolom belum ada, gunakan query ini:
-- ALTER TABLE struktur_organisasi_ptp 
--   ADD COLUMN kj_individu VARCHAR(64) NULL,
--   ADD COLUMN kj_posisi VARCHAR(64) NULL;

-- Query untuk menghapus data (jika diperlukan)
-- Hapus semua data struktur organisasi SPMT
-- DELETE FROM org_position_nodes;

-- Hapus data untuk periode tertentu
-- DELETE FROM org_position_nodes WHERE bulan = 1 AND tahun = 2024;

-- Hapus data untuk daerah tertentu
-- DELETE FROM org_position_nodes WHERE daerah_id = 213;

-- Hapus data untuk daerah dan periode tertentu
-- DELETE FROM org_position_nodes WHERE daerah_id = 213 AND bulan = 1 AND tahun = 2024;

-- Hapus semua data struktur organisasi PTP
-- DELETE FROM struktur_organisasi_ptp;

-- Hapus data PTP untuk periode tertentu
-- DELETE FROM struktur_organisasi_ptp WHERE bulan = 1 AND tahun = 2024;

