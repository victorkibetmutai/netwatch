import dotenv from 'dotenv';

dotenv.config();

const retentionDays = Number.parseInt(process.env.CHECK_RETENTION_DAYS || '30', 10);
export const JWT_SECRET_PLACEHOLDER = 'replace-this-before-using-auth';

export function validateJwtSecret(environment = process.env.NODE_ENV || 'development', secret) {
  if (arguments.length < 2) {
    secret = process.env.JWT_SECRET;
  }
  const nodeEnvironment = environment || 'development';
  const normalizedSecret = typeof secret === 'string' ? secret.trim() : '';

  if (nodeEnvironment === 'production') {
    if (!normalizedSecret) {
      throw new Error('JWT_SECRET is required when NODE_ENV=production');
    }
    if (normalizedSecret === JWT_SECRET_PLACEHOLDER) {
      throw new Error('JWT_SECRET cannot use the placeholder from .env.example in production');
    }
    if (normalizedSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters when NODE_ENV=production');
    }
  } else if (nodeEnvironment === 'development' && (!normalizedSecret || normalizedSecret === JWT_SECRET_PLACEHOLDER)) {
    console.warn(
      'WARNING: Using the development JWT_SECRET placeholder. Set a secure JWT_SECRET before production.'
    );
  }

  return secret || JWT_SECRET_PLACEHOLDER;
}

const jwtSecret = validateJwtSecret();

export const config = {
  port: Number.parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || './data/netwatch.db',
  jwtSecret,
  webhookUrl: process.env.WEBHOOK_URL || '',
  checkRetentionDays: Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 30
};
