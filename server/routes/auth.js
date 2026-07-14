import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const router = Router();
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const sessionUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: '請輸入 Email 與密碼' });
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(String(email).trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email 或密碼錯誤' });
  }
  req.session.user = sessionUser(user);
  res.json(req.session.user);
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/auth/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: '未登入' });
  res.json(req.session.user);
});

// ---- 忘記密碼：送出重設申請，由管理員在使用者管理處理 ----
router.post('/auth/forgot', (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  // 不論 email 是否存在都回相同訊息，避免洩漏哪些帳號存在
  if (isEmail(email)) {
    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);
    if (user) {
      const pending = db.prepare(
        "SELECT id FROM password_reset_requests WHERE user_id = ? AND status = 'pending'").get(user.id);
      if (pending) {
        db.prepare("UPDATE password_reset_requests SET created_at = datetime('now','localtime') WHERE id = ?")
          .run(pending.id);
      } else {
        db.prepare('INSERT INTO password_reset_requests (user_id, email) VALUES (?, ?)').run(user.id, email);
      }
    }
  }
  res.json({ ok: true, message: '已收到申請，請聯絡診所管理員協助重設密碼。' });
});

// ---- 待處理的重設申請（僅 admin）----
router.get('/reset-requests', requireRole('admin'), (req, res) => {
  res.json(db.prepare(`
    SELECT r.id, r.email, r.created_at, u.id AS user_id, u.name AS user_name, u.role
    FROM password_reset_requests r JOIN users u ON u.id = r.user_id
    WHERE r.status = 'pending'
    ORDER BY r.created_at DESC
  `).all());
});

router.post('/reset-requests/:id/resolve', requireRole('admin'), (req, res) => {
  db.prepare("UPDATE password_reset_requests SET status = 'handled', handled_at = datetime('now','localtime') WHERE id = ?")
    .run(req.params.id);
  res.json({ ok: true });
});

// ---- 使用者管理（僅 admin）----
router.get('/users', requireAuth, (req, res) => {
  // 所有角色都需要醫師名單（預約表單用）；非 admin 只回傳基本欄位
  const rows = db.prepare('SELECT id, email, name, role, active FROM users ORDER BY id').all();
  if (req.session.user.role !== 'admin') {
    return res.json(rows.filter(u => u.active).map(({ id, name, role }) => ({ id, name, role })));
  }
  res.json(rows);
});

router.post('/users', requireRole('admin'), (req, res) => {
  const { email, password, name, role } = req.body || {};
  const mail = String(email || '').trim().toLowerCase();
  if (!isEmail(mail) || !password || !name || !['admin', 'doctor', 'staff'].includes(role)) {
    return res.status(400).json({ error: '請填寫有效 Email、密碼、姓名與角色' });
  }
  try {
    // username 沿用為內部唯一鍵，直接存 email
    const info = db.prepare('INSERT INTO users (username, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
      .run(mail, mail, bcrypt.hashSync(password, 10), name, role);
    res.json({ id: info.lastInsertRowid });
  } catch {
    res.status(400).json({ error: '此 Email 已被使用' });
  }
});

router.put('/users/:id', requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '找不到使用者' });
  const { name, role, active, password, email } = req.body || {};
  const mail = email === undefined ? user.email : String(email || '').trim().toLowerCase();
  if (email !== undefined && !isEmail(mail)) return res.status(400).json({ error: 'Email 格式不正確' });
  try {
    db.prepare('UPDATE users SET name = ?, email = ?, role = ?, active = ? WHERE id = ?').run(
      name ?? user.name,
      mail,
      ['admin', 'doctor', 'staff'].includes(role) ? role : user.role,
      active === undefined ? user.active : (active ? 1 : 0),
      user.id
    );
  } catch {
    return res.status(400).json({ error: '此 Email 已被使用' });
  }
  if (password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(bcrypt.hashSync(password, 10), user.id);
    // 重設密碼後，將該使用者待處理的重設申請標記為已處理
    db.prepare("UPDATE password_reset_requests SET status = 'handled', handled_at = datetime('now','localtime') WHERE user_id = ? AND status = 'pending'")
      .run(user.id);
  }
  res.json({ ok: true });
});

export default router;
