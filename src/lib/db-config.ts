// Database configuration for SPMT System
export const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root", 
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "spmt_pelindo",
  port: parseInt(process.env.DB_PORT || "3306")
};

// Connection string for Prisma (if needed later)
export const databaseUrl = process.env.DATABASE_URL || 
  `mysql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;



