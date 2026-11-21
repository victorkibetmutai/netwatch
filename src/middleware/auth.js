import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(request, response, next) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = authorization.slice('Bearer '.length);
    request.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    response.status(401).json({ error: 'Invalid or expired token' });
  }
}
