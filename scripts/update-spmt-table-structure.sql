-- Update spmt_data table structure to remove kantor_pusat_branch column
-- This script will modify the existing table structure

-- Drop the kantor_pusat_branch column if it exists
ALTER TABLE spmt_data DROP COLUMN IF EXISTS kantor_pusat_branch;
