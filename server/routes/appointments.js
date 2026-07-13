import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();
const STATUSES = ['booked', 'arrived', 'completed', 'no_show', 'cancelled'];

router.get('/appointments', requireAuth, (req, res) => {
  const { from, to, doctor_id } = req.query;
  const conds = [];
  const args = [];
  if (from) { conds.push('a.date >= ?'); args.push(from); }
  if (to) { conds.push('a.date <= ?'); args.push(to); }
  if (doctor_id) { conds.push('a.doctor_id = ?'); args.push(doctor_id); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  res.json(db.prepare(`
    SELECT a.*, p.name AS patient_name, p.chart_no, p.phone,
           u.name AS doctor_name, s.name AS service_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    LEFT JOIN users u ON u.id = a.doctor_id
    LEFT JOIN services s ON s.id = a.service_id
    ${where} ORDER BY a.date, a.time
  `).all(...args));
});

router.post('/appointments', requireAuth, (req, res) => {
  const { patient_id, doctor_id, date, time, duration, service_id, notes } = req.body || {};
  if (!patient_id || !date || !time) {
    return res.status(400).json({ error: '請選擇病患與時間' });
  }
  const info = db.prepare(`
    INSERT INTO appointments (patient_id, doctor_id, date, time, duration, service_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(patient_id, doctor_id || null, date, time,
    Number(duration) || 30, service_id || null, notes || null);
  res.json({ id: info.lastInsertRowid });
});

router.put('/appointments/:id', requireAuth, (req, res) => {
  const a = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '找不到預約' });
  const { doctor_id, date, time, duration, service_id, status, notes } = req.body || {};
  db.prepare(`
    UPDATE appointments SET doctor_id = ?, date = ?, time = ?, duration = ?,
      service_id = ?, status = ?, notes = ? WHERE id = ?
  `).run(
    doctor_id === undefined ? a.doctor_id : (doctor_id || null),
    date ?? a.date,
    time ?? a.time,
    duration === undefined ? a.duration : Number(duration),
    service_id === undefined ? a.service_id : (service_id || null),
    STATUSES.includes(status) ? status : a.status,
    notes === undefined ? a.notes : notes,
    a.id
  );
  res.json({ ok: true });
});

router.delete('/appointments/:id', requireAuth, (req, res) => {
  db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
