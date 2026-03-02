-- Remove kantor_pusat_branch and rakomdir columns from spmtdata table
ALTER TABLE spmtdata 
DROP COLUMN IF EXISTS kantor_pusat_branch,
DROP COLUMN IF EXISTS rakomdir;
