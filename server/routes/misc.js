import { Router } from 'express';
import db, { today } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const router = Router();

// ---- 療程項目 ----
router.get('/services', requireAuth, (req, res) => {
  const all = req.query.all === '1' && req.session.user.role === 'admin';
  res.json(db.prepare(`SELECT * FROM services ${all ? '' : 'WHERE active = 1'} ORDER BY category, id`).all());
});

router.post('/services', requireRole('admin'), (req, res) => {
  const { name, category, price, default_sessions } = req.body || {};
  if (!name) return res.status(400).json({ error: '請輸入項目名稱' });
  const info = db.prepare('INSERT INTO services (name, category, price, default_sessions) VALUES (?, ?, ?, ?)')
    .run(name, category || '', Number(price) || 0, Number(default_sessions) || 1);
  res.json({ id: info.lastInsertRowid });
});

router.put('/services/:id', requireRole('admin'), (req, res) => {
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
  if (!svc) return res.status(404).json({ error: '找不到項目' });
  const { name, category, price, default_sessions, active } = req.body || {};
  db.prepare('UPDATE services SET name = ?, category = ?, price = ?, default_sessions = ?, active = ? WHERE id = ?')
    .run(
      name ?? svc.name,
      category ?? svc.category,
      price === undefined ? svc.price : Number(price),
      default_sessions === undefined ? svc.default_sessions : Number(default_sessions),
      active === undefined ? svc.active : (active ? 1 : 0),
      svc.id
    );
  res.json({ ok: true });
});

// ---- 關鍵客戶評分 ----
// 綜合分數 = 推薦貢獻（人數＋帶來營收，權重最高）＋ 本人消費 ＋ 回診忠誠
// 權重集中在此，日後要調整只改這一處。
export const SCORE_WEIGHTS = {
  perReferral: 20,        // 每推薦 1 位新客
  perReferralRevenue: 10, // 推薦客每帶來 NT$10,000 營收
  perOwnSpend: 5,         // 本人每消費 NT$10,000
  perVisit: 3,            // 每回診 1 次
};

function scoreOf(r) {
  const w = SCORE_WEIGHTS;
  return Math.round(
    r.referred_count * w.perReferral +
    (r.referred_revenue / 10000) * w.perReferralRevenue +
    (r.own_spend / 10000) * w.perOwnSpend +
    r.visit_count * w.perVisit
  );
}

function tierOf(score) {
  if (score >= 120) return 'platinum';
  if (score >= 60) return 'gold';
  if (score >= 20) return 'silver';
  return 'normal';
}

router.get('/key-customers', requireRole('admin', 'staff'), (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.chart_no, p.name, p.phone,
      (SELECT COUNT(*) FROM patients r WHERE r.referred_by = p.id) AS referred_count,
      (SELECT COALESCE(SUM(y.amount), 0) FROM payments y
        WHERE y.patient_id IN (SELECT id FROM patients WHERE referred_by = p.id)) AS referred_revenue,
      (SELECT COALESCE(SUM(y.amount), 0) FROM payments y WHERE y.patient_id = p.id) AS own_spend,
      (SELECT COUNT(*) FROM visits v WHERE v.patient_id = p.id) AS visit_count
    FROM patients p
  `).all();

  const ranked = rows
    .map((r) => ({ ...r, score: scoreOf(r), tier: tierOf(scoreOf(r)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  res.json({ weights: SCORE_WEIGHTS, customers: ranked });
});

// ---- 今日看板 ----
router.get('/dashboard/today', requireAuth, (req, res) => {
  const date = req.query.date || today();
  const appointments = db.prepare(`
    SELECT a.*, p.name AS patient_name, p.chart_no, p.phone,
           u.name AS doctor_name, s.name AS service_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    LEFT JOIN users u ON u.id = a.doctor_id
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.date = ?
    ORDER BY a.time
  `).all(date);

  const stats = { total: 0, booked: 0, arrived: 0, completed: 0, no_show: 0, cancelled: 0 };
  for (const a of appointments) {
    stats.total++;
    stats[a.status] = (stats[a.status] || 0) + 1;
  }

  const result = { date, appointments, stats };
  if (['admin', 'staff'].includes(req.session.user.role)) {
    const rows = db.prepare(
      "SELECT method, SUM(amount) AS total FROM payments WHERE paid_at = ? GROUP BY method").all(date);
    result.revenue = {
      total: rows.reduce((s, r) => s + r.total, 0),
      byMethod: Object.fromEntries(rows.map(r => [r.method, r.total])),
    };
  }
  res.json(result);
});

export default router;
