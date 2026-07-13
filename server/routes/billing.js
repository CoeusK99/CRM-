import { Router } from 'express';
import db, { today } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const router = Router();

router.get('/payments', requireAuth, (req, res) => {
  const { from, to, patient_id } = req.query;
  const conds = [];
  const args = [];
  if (from) { conds.push('y.paid_at >= ?'); args.push(from); }
  if (to) { conds.push('y.paid_at <= ?'); args.push(to); }
  if (patient_id) { conds.push('y.patient_id = ?'); args.push(patient_id); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  res.json(db.prepare(`
    SELECT y.*, p.name AS patient_name, p.chart_no,
           u.name AS handler_name, s.name AS service_name
    FROM payments y
    JOIN patients p ON p.id = y.patient_id
    LEFT JOIN users u ON u.id = y.handled_by
    LEFT JOIN packages k ON k.id = y.package_id
    LEFT JOIN services s ON s.id = k.service_id
    ${where} ORDER BY y.paid_at DESC, y.id DESC LIMIT 500
  `).all(...args));
});

router.post('/payments', requireRole('admin', 'staff'), (req, res) => {
  const { patient_id, package_id, visit_id, amount, method, paid_at, notes } = req.body || {};
  if (!patient_id || !amount || !['cash', 'card', 'transfer'].includes(method)) {
    return res.status(400).json({ error: '請填寫病患、金額與付款方式' });
  }
  const info = db.prepare(`
    INSERT INTO payments (patient_id, package_id, visit_id, amount, method, paid_at, handled_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(patient_id, package_id || null, visit_id || null, Number(amount),
    method, paid_at || today(), req.session.user.id, notes || null);
  res.json({ id: info.lastInsertRowid });
});

router.delete('/payments/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// 日報表
router.get('/reports/daily', requireRole('admin', 'staff'), (req, res) => {
  const date = req.query.date || today();
  const byMethod = db.prepare(
    'SELECT method, SUM(amount) AS total, COUNT(*) AS count FROM payments WHERE paid_at = ? GROUP BY method'
  ).all(date);
  const visits = db.prepare('SELECT COUNT(*) AS c FROM visits WHERE date = ?').get(date).c;
  const newPatients = db.prepare(
    "SELECT COUNT(*) AS c FROM patients WHERE date(created_at) = ?").get(date).c;
  res.json({
    date,
    total: byMethod.reduce((s, r) => s + r.total, 0),
    byMethod,
    visits,
    newPatients,
  });
});

export default router;
