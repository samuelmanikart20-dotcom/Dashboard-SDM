-- Update PTP Kode from JKT to KP
-- Script untuk mengubah kode PTP Kantor Pusat dari JKT ke KP

USE spmt_pelindo;

-- 1. Check current ptp_daerah data for Kantor Pusat
SELECT '=== Current PTP Daerah Data ===' as info;
SELECT id, nama, kode FROM ptp_daerah WHERE nama LIKE '%Pusat%' OR kode IN ('JKT', 'KP') ORDER BY id;

-- 2. Update kode from JKT to KP for Kantor Pusat
UPDATE ptp_daerah 
SET kode = 'KP' 
WHERE nama = 'PTP Kantor Pusat' AND kode = 'JKT';

-- 3. Show affected rows
SELECT '=== Update Results ===' as info;
SELECT ROW_COUNT() as rows_affected;

-- 4. Verify the update
SELECT '=== Updated PTP Daerah Data ===' as info;
SELECT id, nama, kode FROM ptp_daerah WHERE nama LIKE '%Pusat%' OR kode IN ('JKT', 'KP') ORDER BY id;

-- 5. Check if there are any other references to JKT in the system
SELECT '=== Check for Other JKT References ===' as info;
SELECT 'ptp_daerah table:' as table_name, COUNT(*) as jkt_count FROM ptp_daerah WHERE kode = 'JKT'
UNION ALL
SELECT 'ptp_struktur_organisasi table:' as table_name, COUNT(*) as jkt_count FROM ptp_struktur_organisasi WHERE ptp_daerah_id IN (SELECT id FROM ptp_daerah WHERE kode = 'JKT');

-- 6. Show all PTP daerah data for reference
SELECT '=== All PTP Daerah Data ===' as info;
SELECT id, nama, kode FROM ptp_daerah ORDER BY id;
