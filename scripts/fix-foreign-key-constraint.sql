-- Script untuk memperbaiki foreign key constraint error pada org_position_nodes
-- Error: Cannot add or update a child row: a foreign key constraint fails
-- 
-- Masalah: Ada data di org_position_nodes dengan daerah_id yang tidak ada di tabel daerah
-- Solusi: 
-- 1. Membuat tabel daerah jika belum ada
-- 2. Memeriksa dan memperbaiki data yang tidak valid
-- 3. Memastikan semua daerah_id yang digunakan ada di tabel daerah

USE spmt_pelindo;

-- ============================================
-- 1. Buat tabel daerah jika belum ada
-- ============================================
CREATE TABLE IF NOT EXISTS daerah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(255) NOT NULL,
  kode VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_kode (kode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. Insert data daerah SPMT jika belum ada
-- ============================================
-- Menggunakan INSERT dengan ID eksplisit untuk memastikan ID 3 ada
INSERT INTO daerah (id, nama, kode) VALUES
(1, 'SPMT Kantor Pusat', 'KP'),
(2, 'SPMT Belawan', 'BLW'),
(3, 'SPMT Dumai', 'DMI'),
(4, 'SPMT Tanjung Intan', 'TI'),
(5, 'SPMT Bumiharjo Bagendang', 'BHB'),
(6, 'SPMT Tanjung Wangi', 'TW'),
(7, 'SPMT Makassar', 'MKS'),
(8, 'SPMT Balikpapan', 'BPP'),
(9, 'SPMT Jamrud Nilam Merah', 'JNM'),
(10, 'SPMT Trisakti', 'TSK'),
(11, 'SPMT Parepare', 'PPR'),
(12, 'SPMT Tanjung Emas', 'TE'),
(13, 'SPMT Lembar', 'LMB'),
(14, 'SPMT Gresik', 'GRS'),
(15, 'SPMT Malahayati', 'MLH'),
(16, 'SPMT Lhokseumawe', 'LHS'),
(17, 'SPMT Benoa', 'BNO'),
(18, 'SPMT Sibolga', 'SBG'),
(19, 'SPMT Tanjung Balai Karimun', 'TBK'),
(20, 'SPMT Tanjung Pinang', 'TPG'),
(21, 'SPMT Bima Badas', 'BMB')
ON DUPLICATE KEY UPDATE nama=VALUES(nama), kode=VALUES(kode);

-- ============================================
-- 3. Cek data yang tidak valid di semua tabel struktur organisasi
-- ============================================
-- Query ini akan menampilkan daerah_id yang tidak ada di tabel daerah

-- Cek di org_position_nodes
SELECT 'org_position_nodes' as tabel, opn.daerah_id, COUNT(*) as jumlah
FROM org_position_nodes opn
LEFT JOIN daerah d ON opn.daerah_id = d.id
WHERE d.id IS NULL
GROUP BY opn.daerah_id;

-- Cek di struktur_organisasi_ptp
SELECT 'struktur_organisasi_ptp' as tabel, sop.daerah_id, COUNT(*) as jumlah
FROM struktur_organisasi_ptp sop
LEFT JOIN daerah d ON sop.daerah_id = d.id
WHERE d.id IS NULL
GROUP BY sop.daerah_id;

-- Cek di struktur_organisasi_ikt
SELECT 'struktur_organisasi_ikt' as tabel, soi.daerah_id, COUNT(*) as jumlah
FROM struktur_organisasi_ikt soi
LEFT JOIN daerah d ON soi.daerah_id = d.id
WHERE d.id IS NULL
GROUP BY soi.daerah_id;

-- Cek di struktur_organisasi_tcu
SELECT 'struktur_organisasi_tcu' as tabel, sot.daerah_id, COUNT(*) as jumlah
FROM struktur_organisasi_tcu sot
LEFT JOIN daerah d ON sot.daerah_id = d.id
WHERE d.id IS NULL
GROUP BY sot.daerah_id;

-- ============================================
-- 4. OPSI A: Hapus data yang tidak valid (HATI-HATI!)
-- ============================================
-- Uncomment baris di bawah ini jika ingin menghapus data yang tidak valid
-- DELETE opn FROM org_position_nodes opn
-- LEFT JOIN daerah d ON opn.daerah_id = d.id
-- WHERE d.id IS NULL;
-- 
-- DELETE sop FROM struktur_organisasi_ptp sop
-- LEFT JOIN daerah d ON sop.daerah_id = d.id
-- WHERE d.id IS NULL;
-- 
-- DELETE soi FROM struktur_organisasi_ikt soi
-- LEFT JOIN daerah d ON soi.daerah_id = d.id
-- WHERE d.id IS NULL;
-- 
-- DELETE sot FROM struktur_organisasi_tcu sot
-- LEFT JOIN daerah d ON sot.daerah_id = d.id
-- WHERE d.id IS NULL;

-- ============================================
-- 5. OPSI B: Buat daerah dummy untuk data yang tidak valid
-- ============================================
-- Jika ada daerah_id yang tidak valid, buat record dummy di tabel daerah
-- Contoh: jika ada daerah_id = 999 yang tidak ada, buat:
-- INSERT INTO daerah (id, nama, kode) VALUES (999, 'Daerah Tidak Diketahui', 'UNK')
-- ON DUPLICATE KEY UPDATE nama=VALUES(nama);

-- Script untuk membuat daerah dummy otomatis untuk semua daerah_id yang tidak valid
-- HATI-HATI: Ini akan membuat banyak daerah dummy jika ada banyak data tidak valid
-- Menggabungkan semua daerah_id yang tidak valid dari semua tabel

INSERT INTO daerah (id, nama, kode)
SELECT DISTINCT 
  daerah_id,
  CONCAT('Daerah Tidak Diketahui (ID: ', daerah_id, ')') as nama,
  CONCAT('UNK', daerah_id) as kode
FROM (
  SELECT DISTINCT daerah_id FROM org_position_nodes
  WHERE daerah_id NOT IN (SELECT id FROM daerah)
  UNION
  SELECT DISTINCT daerah_id FROM struktur_organisasi_ptp
  WHERE daerah_id NOT IN (SELECT id FROM daerah)
  UNION
  SELECT DISTINCT daerah_id FROM struktur_organisasi_ikt
  WHERE daerah_id NOT IN (SELECT id FROM daerah)
  UNION
  SELECT DISTINCT daerah_id FROM struktur_organisasi_tcu
  WHERE daerah_id NOT IN (SELECT id FROM daerah)
) AS missing_daerah
ON DUPLICATE KEY UPDATE nama=VALUES(nama);

-- ============================================
-- 6. Verifikasi: Pastikan tidak ada lagi data yang tidak valid
-- ============================================
SELECT 
  'org_position_nodes - Data tidak valid' as status,
  COUNT(*) as jumlah
FROM org_position_nodes opn
LEFT JOIN daerah d ON opn.daerah_id = d.id
WHERE d.id IS NULL

UNION ALL

SELECT 
  'struktur_organisasi_ptp - Data tidak valid' as status,
  COUNT(*) as jumlah
FROM struktur_organisasi_ptp sop
LEFT JOIN daerah d ON sop.daerah_id = d.id
WHERE d.id IS NULL

UNION ALL

SELECT 
  'struktur_organisasi_ikt - Data tidak valid' as status,
  COUNT(*) as jumlah
FROM struktur_organisasi_ikt soi
LEFT JOIN daerah d ON soi.daerah_id = d.id
WHERE d.id IS NULL

UNION ALL

SELECT 
  'struktur_organisasi_tcu - Data tidak valid' as status,
  COUNT(*) as jumlah
FROM struktur_organisasi_tcu sot
LEFT JOIN daerah d ON sot.daerah_id = d.id
WHERE d.id IS NULL;

-- Jika semua hasilnya 0, berarti semua data sudah valid
-- Jika masih ada, perlu diperbaiki manual atau menggunakan OPSI A/B di atas

-- ============================================
-- 7. Tampilkan ringkasan
-- ============================================
SELECT 
  'Total daerah' as info,
  COUNT(*) as jumlah
FROM daerah;

SELECT 
  'Total org_position_nodes' as info,
  COUNT(*) as jumlah
FROM org_position_nodes;

SELECT 
  'Total struktur_organisasi_ptp' as info,
  COUNT(*) as jumlah
FROM struktur_organisasi_ptp;

SELECT 
  'Total struktur_organisasi_ikt' as info,
  COUNT(*) as jumlah
FROM struktur_organisasi_ikt;

SELECT 
  'Total struktur_organisasi_tcu' as info,
  COUNT(*) as jumlah
FROM struktur_organisasi_tcu;

-- Verifikasi data valid
SELECT 
  'org_position_nodes dengan daerah valid' as info,
  COUNT(*) as jumlah
FROM org_position_nodes opn
INNER JOIN daerah d ON opn.daerah_id = d.id

UNION ALL

SELECT 
  'struktur_organisasi_ptp dengan daerah valid' as info,
  COUNT(*) as jumlah
FROM struktur_organisasi_ptp sop
INNER JOIN daerah d ON sop.daerah_id = d.id

UNION ALL

SELECT 
  'struktur_organisasi_ikt dengan daerah valid' as info,
  COUNT(*) as jumlah
FROM struktur_organisasi_ikt soi
INNER JOIN daerah d ON soi.daerah_id = d.id

UNION ALL

SELECT 
  'struktur_organisasi_tcu dengan daerah valid' as info,
  COUNT(*) as jumlah
FROM struktur_organisasi_tcu sot
INNER JOIN daerah d ON sot.daerah_id = d.id;

-- ============================================
-- 8. Catatan Penting
-- ============================================
-- Setelah menjalankan script ini:
-- 1. Pastikan semua data sudah valid (query di step 6 harus return 0)
-- 2. Jika masih ada error, periksa apakah ada constraint lain yang bermasalah
-- 3. Jika perlu, restart MySQL service untuk memastikan constraint ter-update
-- ============================================

