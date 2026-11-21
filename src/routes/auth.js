import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { config } from '../config.js';

const router = Router();

router.post('/register', async (request, response) => {
  const username = typeof request.body.username === 'string'
    ? request.body.username.trim()
    : '';
  const password = typeof request.body.password === 'string'
    ? request.body.password
    : '';

  if (username.length < 3 || username.length > 50) {
    return response.status(400).json({ error: 'Username must be 3 to 50 characters' });
  }
  if (password.length < 8) {
    return response.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existingUser = db.prepare('SELECT id FROM users LIMIT 1').get();
  if (existingUser) {
    return response.status(403).json({ error: 'Registration is disabled because a user already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const timestamp = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO users (username, password_hash, created_at)
    VALUES (?, ?, ?)
  `).run(username, passwordHash, timestamp);

  const token = jwt.sign(
    { sub: String(result.lastInsertRowid), username, role: 'admin' },
    config.jwtSecret,
    { expiresIn: '12h' }
  );
  response.status(201).json({ token, username, role: 'admin' });
});

router.post('/login', async (request, response) => {
  const username = typeof request.body.username === 'string'
    ? request.body.username.trim()
    : '';
  const password = typeof request.body.password === 'string'
    ? request.body.password
    : '';
  if (!username || !password) {
    return response.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return response.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { sub: String(user.id), username: user.username, role: 'admin' },
    config.jwtSecret,
    { expiresIn: '12h' }
  );
  response.json({ token, username: user.username, role: 'admin' });
});

export default router;
