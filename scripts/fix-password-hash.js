const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'spmt_pelindo',
  port: process.env.DB_PORT || 3306
};

async function fixPasswordHashes() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('🔧 Memperbaiki hash password...');
    
    // Generate correct hash for password '
    const password = 'admin123';
    const saltRounds = 10;
    const correctHash = await bcrypt.hash(password, saltRounds);
    
    console.log('✅ Hash password yang benar:', correctHash);
    
    // Update all users with correct password hash
    const [result] = await connection.execute(
      'UPDATE users SET password = ? WHERE 1=1',
      [correctHash]
    );
    
    console.log(`✅ Berhasil update ${result.affectedRows} user dengan password yang benar`);
    
    // Verify the update
    const [users] = await connection.execute(
      'SELECT id, name, email, role, is_active FROM users'
    );
    
    console.log('\n📋 Daftar user yang telah diperbaiki:');
    users.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role} - Status: ${user.is_active ? 'Aktif' : 'Nonaktif'}`);
    });
    
    console.log('\n🔑 Password untuk semua user: admin123');
    console.log('✅ Sekarang Anda dapat login dengan email dan password yang benar!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

// Run the fix
fixPasswordHashes();







