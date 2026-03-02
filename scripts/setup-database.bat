@echo off
echo ========================================
echo Setup Database SPMT System
echo ========================================
echo.

echo Pastikan MySQL server sudah berjalan!
echo.

echo 1. Buat file .env di root project dengan konfigurasi:
echo    DB_HOST=localhost
echo    DB_USER=root
echo    DB_PASSWORD=your_password_here
echo    DB_NAME=spmt_pelindo
echo    DB_PORT=3306
echo.

echo 2. Jalankan script SQL di MySQL:
echo    - Buka MySQL client atau phpMyAdmin
echo    - Jalankan file: scripts/setup-database.sql
echo    - Script akan otomatis drop dan recreate tabel spmt_data
echo.

echo 3. Atau jalankan perintah berikut di MySQL:
echo    CREATE DATABASE IF NOT EXISTS spmt_pelindo;
echo    USE spmt_pelindo;
echo    SOURCE scripts/setup-database.sql;
echo.

echo 4. Jalankan aplikasi:
echo    npm run dev
echo.

echo 5. Login dengan:
echo    Admin: admin@example.com / password123
echo    User:  user@example.com  / password123
echo.

echo 6. Test upload file Excel/CSV:
echo    - Pilih bulan dan tahun
echo    - Upload file dengan kolom: NO, NPP, NAMA, TANGGAL LAHIR, NAMA JABATAN, ENTITAS
echo.

echo ========================================
echo Troubleshooting:
echo ========================================
echo - Jika ada error "EPERM", restart terminal sebagai Administrator
echo - Jika ada error database, pastikan MySQL berjalan dan kredensial benar
echo - Jika ada error upload, periksa format file dan kolom yang diperlukan
echo - Check console browser dan terminal untuk error details
echo.

pause


