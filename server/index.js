import express from 'express';
import session from 'express-session';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db, { UPLOAD_DIR } from './db.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import appointmentRoutes from './routes/appointments.js';
import billingRoutes from './routes/billing.js';
import miscRoutes from './routes/misc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3020;
const WEEK = 7 * 24 * 60 * 60 * 1000;

// Session 存進 SQLite，重啟伺服器不會登出
class SqliteStore extends session.Store {
  get(sid, cb) {
    const row = db.prepare('SELECT sess, expire FROM sessions WHERE sid = ?').get(sid);
    if (!row || row.expire < Date.now()) return cb(null, null);
    cb(null, JSON.parse(row.sess));
  }
  set(sid, sess, cb) {
    const expire = Date.now() + (sess.cookie?.maxAge || WEEK);
    db.prepare(`
      INSERT INTO sessions (sid, sess, expire) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire
    `).run(sid, JSON.stringify(sess), expire);
    cb?.(null);
  }
  destroy(sid, cb) {
    db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    cb?.(null);
  }
}
setInterval(() => {
  db.prepare('DELETE FROM sessions WHERE expire < ?').run(Date.now());
}, 60 * 60 * 1000).unref();

app.set('trust proxy', 1);
app.use(express.json());
app.use(session({
  store: new SqliteStore(),
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
    maxAge: WEEK,
  },
}));

app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/api', authRoutes);
app.use('/api', patientRoutes);
app.use('/api', appointmentRoutes);
app.use('/api', billingRoutes);
app.use('/api', miscRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: '找不到此 API' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '伺服器發生錯誤' });
});

// 正式環境：提供前端打包後的靜態檔
const dist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`診所 CRM 伺服器啟動於 http://localhost:${PORT}`));
