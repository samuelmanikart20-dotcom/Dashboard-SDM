/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require("../../src/generated/prisma");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const passwordHash = bcrypt.hashSync("password123", 10);

  // Upsert a default admin user
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      password: passwordHash,
      role: "ADMIN",
    },
  });

  // Upsert a default regular user
  await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      email: "user@example.com",
      name: "User",
      password: passwordHash,
      role: "USER",
    },
  });

  // Add initial SPMT data
  const spmtData = [
    {
      no: "1",
      npp: "12345",
      nama: "John Doe",
      tanggalLahir: "1990-01-01",
      namaJabatan: "Manager",
      entitas: "IT",
      jaKantorPusat: "JA Pusat",
      kategori: "Karyawan Tetap",
      jenisKelamin: "Laki-laki",
      jenisPekerja: "Organik",
      pusatPelayanan: "Operasional",
      statusLaporanRakomdir: "Aktif"
    },
    {
      no: "2",
      npp: "12346",
      nama: "Jane Smith",
      tanggalLahir: "1992-05-15",
      namaJabatan: "Staff",
      entitas: "HR",
      jaKantorPusat: "JA Pusat",
      kategori: "Karyawan Tetap",
      jenisKelamin: "Perempuan",
      jenisPekerja: "Organik",
      pusatPelayanan: "Operasional",
      statusLaporanRakomdir: "Aktif"
    },
    {
      no: "3",
      npp: "12347",
      nama: "Bob Johnson",
      tanggalLahir: "1988-12-20",
      namaJabatan: "Supervisor",
      entitas: "Finance",
      jaKantorPusat: "JA Pusat",
      kategori: "Karyawan Kontrak",
      jenisKelamin: "Laki-laki",
      jenisPekerja: "Non Organik",
      pusatPelayanan: "Non Operasional",
      statusLaporanRakomdir: "Aktif"
    }
  ];

  // Clear existing SPMT data and insert new
  await prisma.spmtData.deleteMany({});
  
  for (const data of spmtData) {
    await prisma.spmtData.create({
      data: data
    });
  }

  console.log("Seed selesai: pengguna default dan data SPMT awal dibuat.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


