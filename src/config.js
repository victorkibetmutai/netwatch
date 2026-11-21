import dotenv from 'dotenv';

dotenv.config();

const retentionDays = Number.parseInt(process.env.CHECK_RETENTION_DAYS || '30', 10);

export const config = {
  port: Number.parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || './data/netwatch.db',
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-me',
  webhookUrl: process.env.WEBHOOK_URL || '',
  checkRetentionDays: Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 30
};
