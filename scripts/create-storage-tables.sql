-- Generic Storage tables for arbitrary-column datasets
-- Run this once to create supporting tables

CREATE TABLE IF NOT EXISTS storage_datasets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NULL,
  columns_json TEXT NOT NULL,
  total_rows INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS storage_records (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  dataset_id INT NOT NULL,
  data_json LONGTEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dataset_id (dataset_id),
  CONSTRAINT fk_storage_records_dataset
    FOREIGN KEY (dataset_id) REFERENCES storage_datasets(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
