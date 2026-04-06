// Database configuration for SPMT System
export const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root", 
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "spmt_pelindo_revisi",
  port: parseInt(process.env.DB_PORT || "3307")
};

// Connection string for Prisma (if needed later)
export const databaseUrl = process.env.DATABASE_URL || 
  `mysql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;



