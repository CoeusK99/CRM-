import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const router = Router();

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '請輸入帳號與密碼' });
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '帳號或密碼錯誤' });
  }
  req.session.user = { id: user.id, username: user.username, name: user.name, role: user.role };
  res.json(req.session.user);
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '未登入' });
  res.json(req.session.user);
});

// ---- 使用者管理（僅 admin）----
router.get('/users', requireAuth, (req, res) => {
  // 所有角色都需要醫師名單（預約表單用）；非 admin 只回傳基本欄位
  const rows = db.prepare('SELECT id, username, name, role, active FROM users ORDER BY id').all();
  if (req.session.user.role !== 'admin') {
    return res.json(rows.filter(u => u.active).map(({ id, name, role }) => ({ id, name, role })));
  }
  res.json(rows);
});

router.post('/users', requireRole('admin'), (req, res) => {
  const { username, password, name, role } = req.body || {};
  if (!username || !password || !name || !['admin', 'doctor', 'staff'].includes(role)) {
    return res.status(400).json({ error: '欄位不完整' });
  }
  try {
    const info = db.prepare('INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)')
      .run(username, bcrypt.hashSync(password, 10), name, role);
    res.json({ id: info.lastInsertRowid });
  } catch {
    res.status(400).json({ error: '帳號已存在' });
  }
});

router.put('/users/:id', requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '找不到使用者' });
  const { name, role, active, password } = req.body || {};
  db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?').run(
    name ?? user.name,
    ['admin', 'doctor', 'staff'].includes(role) ? role : user.role,
    active === undefined ? user.active : (active ? 1 : 0),
    user.id
  );
  if (password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(bcrypt.hashSync(password, 10), user.id);
  }
  res.json({ ok: true });
});

export default router;
