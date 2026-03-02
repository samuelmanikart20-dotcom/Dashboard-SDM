-- Fix BOPO IKT Foreign Key
-- Script untuk mengubah foreign key bopo_ikt dari daerah(id) ke ikt_daerah(id)
-- Jalankan script ini jika tabel bopo_ikt sudah ada dan perlu diupdate foreign key-nya

USE spmt_pelindo;

-- 1. Drop existing foreign key constraint if exists
SET @fk_name = (
  SELECT CONSTRAINT_NAME 
  FROM information_schema.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'bopo_ikt' 
    AND COLUMN_NAME = 'daerah_id' 
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);

SET @sql = IF(@fk_name IS NOT NULL, 
  CONCAT('ALTER TABLE bopo_ikt DROP FOREIGN KEY ', @fk_name), 
  'SELECT "No foreign key found" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Ensure ikt_daerah table exists (should already exist from create-ikt-daerah-table.sql)
-- If not, create it first by running create-ikt-daerah-table.sql

-- 3. Add new foreign key to ikt_daerah
ALTER TABLE bopo_ikt 
ADD CONSTRAINT fk_bopo_ikt_ikt_daerah 
FOREIGN KEY (daerah_id) REFERENCES ikt_daerah(id) ON DELETE CASCADE;

-- 4. Verify the change
SELECT 
  CONSTRAINT_NAME,
  TABLE_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'bopo_ikt'
  AND COLUMN_NAME = 'daerah_id'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

SELECT 'Foreign key updated successfully!' as status;




















