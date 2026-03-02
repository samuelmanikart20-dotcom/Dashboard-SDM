// Unit Kerja to Region mapping based on SPMT locations
const UNIT_KERJA_REGION_MAPPING: { [key: string]: { id: number, nama: string, kode: string } } = {
  // Region 1 - Kantor Pusat (KP)
  'SPMT-KANTOR PUSAT': { id: 1, nama: 'Kantor Pusat', kode: 'KP' },
  'JAKARTA': { id: 1, nama: 'Kantor Pusat', kode: 'KP' },
  'KANTOR PUSAT': { id: 1, nama: 'Kantor Pusat', kode: 'KP' },

  // Region 2 - Belawan (BBLW)
  'SPMT-BELAWAN': { id: 2, nama: 'Belawan', kode: 'BBLW' },
  'BELAWAN': { id: 2, nama: 'Belawan', kode: 'BBLW' },

  // Region 3 - Dumai (BDMI)
  'SPMT-DUMAI': { id: 3, nama: 'Dumai', kode: 'BDMI' },
  'DUMAI': { id: 3, nama: 'Dumai', kode: 'BDMI' },

  // Region 4 - Tanjung Intan (BTJI)
  'SPMT-TANJUNG INTAN': { id: 4, nama: 'Tanjung Intan', kode: 'BTJI' },
  'TANJUNG INTAN': { id: 4, nama: 'Tanjung Intan', kode: 'BTJI' },

  // Region 5 - Bumiharjo Batam (BBHG)
  'SPMT-BUMIHARJO BA': { id: 5, nama: 'Bumiharjo Batam', kode: 'BBHG' },
  'SPMT-BUMIHARJO BATAM': { id: 5, nama: 'Bumiharjo Batam', kode: 'BBHG' },
  'BUMIHARJO': { id: 5, nama: 'Bumiharjo Batam', kode: 'BBHG' },

  // Region 6 - Tanjung Wangi (BTJW)
  'SPMT-TANJUNG WANGI': { id: 6, nama: 'Tanjung Wangi', kode: 'BTJW' },
  'TANJUNG WANGI': { id: 6, nama: 'Tanjung Wangi', kode: 'BTJW' },

  // Region 7 - Makassar (BMKS)
  'SPMT-MAKASSAR': { id: 7, nama: 'Makassar', kode: 'BMKS' },
  'MAKASSAR': { id: 7, nama: 'Makassar', kode: 'BMKS' },

  // Region 8 - Balikpapan (BBLP)
  'SPMT-BALIKPAPAN': { id: 8, nama: 'Balikpapan', kode: 'BBLP' },
  'BALIKPAPAN': { id: 8, nama: 'Balikpapan', kode: 'BBLP' },

  // Region 9 - Jamrud Nilam (BJMR)
  'SPMT-JAMRUD NILAM': { id: 9, nama: 'Jamrud Nilam', kode: 'BJMR' },
  'JAMRUD NILAM': { id: 9, nama: 'Jamrud Nilam', kode: 'BJMR' },

  // Region 10 - Trisakti (BTRI)
  'SPMT-TRISAKTI': { id: 10, nama: 'Trisakti', kode: 'BTRI' },
  'TRISAKTI': { id: 10, nama: 'Trisakti', kode: 'BTRI' },

  // Region 11 - Pare-Pare (BPRE)
  'SPMT-PARE-PARE': { id: 11, nama: 'Pare-Pare', kode: 'BPRE' },
  'PARE-PARE': { id: 11, nama: 'Pare-Pare', kode: 'BPRE' },

  // Region 12 - Tanjung Emas (BTJE)
  'SPMT-TANJUNG EMAS': { id: 12, nama: 'Tanjung Emas', kode: 'BTJE' },
  'TANJUNG EMAS': { id: 12, nama: 'Tanjung Emas', kode: 'BTJE' },

  // Region 13 - Lembar (BLMB)
  'SPMT-LEMBAR': { id: 13, nama: 'Lembar', kode: 'BLMB' },
  'LEMBAR': { id: 13, nama: 'Lembar', kode: 'BLMB' },

  // Region 14 - Gresik (BGRS)
  'SPMT-GRESIK': { id: 14, nama: 'Gresik', kode: 'BGRS' },
  'GRESIK': { id: 14, nama: 'Gresik', kode: 'BGRS' },

  // Region 15 - Malahayati (BMLH)
  'SPMT-MALAHAYATI': { id: 15, nama: 'Malahayati', kode: 'BMLH' },
  'MALAHAYATI': { id: 15, nama: 'Malahayati', kode: 'BMLH' },

  // Region 16 - Lhokseumawe (BLHW)
  'SPMT-LHOKSEUMAWE': { id: 16, nama: 'Lhokseumawe', kode: 'BLHW' },
  'LHOKSEUMAWE': { id: 16, nama: 'Lhokseumawe', kode: 'BLHW' },

  // Region 17 - Benoa (BNOA)
  'SPMT-BENOA': { id: 17, nama: 'Benoa', kode: 'BNOA' },
  'BENOA': { id: 17, nama: 'Benoa', kode: 'BNOA' },

  // Region 18 - Sibolga (BSBG)
  'SPMT-SIBOLGA': { id: 18, nama: 'Sibolga', kode: 'BSBG' },
  'SIBOLGA': { id: 18, nama: 'Sibolga', kode: 'BSBG' },

  // Region 19 - Tanjung Balai Karimun (BTBK)
  'SPMT-TANJUNG BALAI': { id: 19, nama: 'Tanjung Balai Karimun', kode: 'BTBK' },
  'SPMT-TANJUNG BALAI KARIMUN': { id: 19, nama: 'Tanjung Balai Karimun', kode: 'BTBK' },
  'TANJUNG BALAI': { id: 19, nama: 'Tanjung Balai Karimun', kode: 'BTBK' },

  // Region 20 - Tanjung Pinang (BTPI)
  'SPMT-TANJUNG PINANG': { id: 20, nama: 'Tanjung Pinang', kode: 'BTPI' },
  'TANJUNG PINANG': { id: 20, nama: 'Tanjung Pinang', kode: 'BTPI' },

  // Region 21 - Bima Badas (BBMB)
  'SPMT-BIMA BADAS': { id: 21, nama: 'Bima Badas', kode: 'BBMB' },
  'BIMA BADAS': { id: 21, nama: 'Bima Badas', kode: 'BBMB' },
};

// Function to get region from unit_kerja
export function getRegionFromUnitKerja(unitKerja: string): { id: number, nama: string, kode: string } | null {
  if (!unitKerja) return null;
  
  const upperUnitKerja = unitKerja.toUpperCase().trim();
  
  // Direct match
  if (UNIT_KERJA_REGION_MAPPING[upperUnitKerja]) {
    return UNIT_KERJA_REGION_MAPPING[upperUnitKerja];
  }
  
  // Partial match for cases with truncated names
  for (const [key, region] of Object.entries(UNIT_KERJA_REGION_MAPPING)) {
    if (upperUnitKerja.includes(key) || key.includes(upperUnitKerja)) {
      return region;
    }
  }
  
  // Additional fuzzy matching for common variations
  if (upperUnitKerja.includes('TANJUNG WANGI') || upperUnitKerja.includes('TW')) {
    return { id: 6, nama: 'Tanjung Wangi', kode: 'BTJW' };
  }
  if (upperUnitKerja.includes('BUMIHARJO') || upperUnitKerja.includes('BHB')) {
    return { id: 5, nama: 'Bumiharjo Batam', kode: 'BBHG' };
  }
  if (upperUnitKerja.includes('BIMA BADAS') || upperUnitKerja.includes('BMB')) {
    return { id: 21, nama: 'Bima Badas', kode: 'BBMB' };
  }
  
  return null;
}

// Export the mapping for use in route handlers
export { UNIT_KERJA_REGION_MAPPING };


