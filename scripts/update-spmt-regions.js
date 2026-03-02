const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

async function updateSpmtRegions() {
  try {
    console.log('Starting SPMT regions update...');
    
    // Clear existing data
    console.log('Clearing existing regions...');
    await prisma.daerah.deleteMany();
    
    // SPMT regions data
    const spmtRegions = [
      { nama: 'SPMT Kantor Pusat', kode: 'KP' },
      { nama: 'SPMT Belawan', kode: 'BLW' },
      { nama: 'SPMT Dumai', kode: 'DMI' },
      { nama: 'SPMT Tanjung Intan', kode: 'TI' },
      { nama: 'SPMT Bumiharjo Bagendang', kode: 'BHB' },
      { nama: 'SPMT Tanjung Wangi', kode: 'TW' },
      { nama: 'SPMT Makassar', kode: 'MKS' },
      { nama: 'SPMT Balikpapan', kode: 'BPP' },
      { nama: 'SPMT Jamrud Nilam Merah', kode: 'JNM' },
      { nama: 'SPMT Trisakti', kode: 'TSK' },
      { nama: 'SPMT Parepare', kode: 'PPR' },
      { nama: 'SPMT Tanjung Emas', kode: 'TE' },
      { nama: 'SPMT Lembar', kode: 'LMB' },
      { nama: 'SPMT Gresik', kode: 'GRS' },
      { nama: 'SPMT Malahayati', kode: 'MLH' },
      { nama: 'SPMT Lhokseumawe', kode: 'LHS' },
      { nama: 'SPMT Benoa', kode: 'BNO' },
      { nama: 'SPMT Sibolga', kode: 'SBG' },
      { nama: 'SPMT Tanjung Balai Karimun', kode: 'TBK' },
      { nama: 'SPMT Tanjung Pinang', kode: 'TPG' },
      { nama: 'SPMT Bima Badas', kode: 'BMB' }
    ];
    
    // Insert all SPMT regions
    console.log('Inserting SPMT regions...');
    await prisma.daerah.createMany({
      data: spmtRegions
    });
    
    console.log(`Successfully updated database with ${spmtRegions.length} SPMT regions!`);
    
    // Verify the update
    const count = await prisma.daerah.count();
    console.log(`Total regions in database: ${count}`);
    
  } catch (error) {
    console.error('Error updating SPMT regions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateSpmtRegions();
