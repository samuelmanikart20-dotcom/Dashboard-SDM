-- Migration script to add 'bulan' column to existing rkap_sdm table
-- Run this if you already have rkap_sdm table without 'bulan' column

-- Check if column exists, if not add it
ALTER TABLE rkap_sdm 
ADD COLUMN IF NOT EXISTS bulan INT NOT NULL DEFAULT 1 AFTER kategori;

-- Update existing records to have bulan = 1 (default for existing data)
UPDATE rkap_sdm SET bulan = 1 WHERE bulan IS NULL OR bulan = 0;

-- Drop old unique key if exists
ALTER TABLE rkap_sdm DROP INDEX IF EXISTS unique_kategori_tahun;

-- Add new unique key with bulan
ALTER TABLE rkap_sdm 
ADD UNIQUE KEY unique_kategori_bulan_tahun (kategori, bulan, tahun);

-- Add index for bulan_tahun
ALTER TABLE rkap_sdm 
ADD INDEX IF NOT EXISTS idx_bulan_tahun (bulan, tahun);














