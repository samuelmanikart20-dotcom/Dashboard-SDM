-- Organizational structure nodes for Excel-driven org chart
CREATE TABLE IF NOT EXISTS org_position_nodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  daerah_id INT NOT NULL,
  id_posisi_sap VARCHAR(64) NOT NULL,
  id_posisi_atasan VARCHAR(64) NULL,
  nama_posisi VARCHAR(255) NULL,
  nama_jabatan_sap VARCHAR(255) NULL,
  unit_kerja VARCHAR(255) NULL,
  nipp VARCHAR(64) NULL,
  nama VARCHAR(255) NULL,
  tingkatan VARCHAR(128) NULL,
  direktorat VARCHAR(255) NULL,
  photo_url VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daerah_id_sap (daerah_id, id_posisi_sap),
  KEY idx_daerah (daerah_id),
  CONSTRAINT fk_org_nodes_daerah FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Struktur SPMT
CREATE TABLE struktur_organisasi_spmt (
  id_posisi_sap VARCHAR(64) NOT NULL,
  id_posisi_atasan VARCHAR(64) NULL,
  daerah_id INT NOT NULL,
  nama VARCHAR(255) NULL,
  jabatan VARCHAR(255) NULL,
  unit_kerja VARCHAR(255) NULL,
  nipp VARCHAR(64) NULL,
  direktorat VARCHAR(255) NULL,
  photo_url VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daerah_id_sap_spmt (daerah_id, id_posisi_sap),
  KEY idx_daerah_spmt (daerah_id),
  CONSTRAINT fk_org_nodes_daerah_spmt FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Struktur PTP
CREATE TABLE struktur_organisasi_ptp (
  id_posisi_sap VARCHAR(64) NOT NULL,
  id_posisi_atasan VARCHAR(64) NULL,
  daerah_id INT NOT NULL,
  nama VARCHAR(255) NULL,
  jabatan VARCHAR(255) NULL,
  unit_kerja VARCHAR(255) NULL,
  nipp VARCHAR(64) NULL,
  direktorat VARCHAR(255) NULL,
  photo_url VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daerah_id_sap_ptp (daerah_id, id_posisi_sap),
  KEY idx_daerah_ptp (daerah_id),
  CONSTRAINT fk_org_nodes_daerah_ptp FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Struktur IKT
CREATE TABLE struktur_organisasi_ikt (
  id_posisi_sap VARCHAR(64) NOT NULL,
  id_posisi_atasan VARCHAR(64) NULL,
  daerah_id INT NOT NULL,
  nama VARCHAR(255) NULL,
  jabatan VARCHAR(255) NULL,
  unit_kerja VARCHAR(255) NULL,
  nipp VARCHAR(64) NULL,
  direktorat VARCHAR(255) NULL,
  photo_url VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daerah_id_sap_ikt (daerah_id, id_posisi_sap),
  KEY idx_daerah_ikt (daerah_id),
  CONSTRAINT fk_org_nodes_daerah_ikt FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Struktur TCU
CREATE TABLE struktur_organisasi_tcu (
  id_posisi_sap VARCHAR(64) NOT NULL,
  id_posisi_atasan VARCHAR(64) NULL,
  daerah_id INT NOT NULL,
  nama VARCHAR(255) NULL,
  jabatan VARCHAR(255) NULL,
  unit_kerja VARCHAR(255) NULL,
  nipp VARCHAR(64) NULL,
  direktorat VARCHAR(255) NULL,
  photo_url VARCHAR(512) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_daerah_id_sap_tcu (daerah_id, id_posisi_sap),
  KEY idx_daerah_tcu (daerah_id),
  CONSTRAINT fk_org_nodes_daerah_tcu FOREIGN KEY (daerah_id) REFERENCES daerah(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

