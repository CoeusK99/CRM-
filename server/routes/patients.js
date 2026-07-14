import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db, { nextChartNo, today, UPLOAD_DIR } from '../db.js';
import { requireAuth, requireRole } from '../middleware.js';

const router = Router();

const PATIENT_FIELDS = ['name', 'gender', 'birthdate', 'phone', 'email', 'address',
  'allergies', 'medical_history', 'skin_type', 'referral_source', 'referred_by', 'notes'];

// 空字串轉 null（referred_by 等外鍵欄位需要）
const clean = (v) => (v === '' || v === undefined ? null : v);

// ---- 病患 ----
router.get('/patients', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT * FROM patients
      WHERE name LIKE ? OR phone LIKE ? OR chart_no LIKE ?
      ORDER BY id DESC LIMIT 100
    `).all(like, like, like);
  } else {
    rows = db.prepare('SELECT * FROM patients ORDER BY id DESC LIMIT 100').all();
  }
  res.json(rows);
});

router.get('/patients/:id', requireAuth, (req, res) => {
  const p = db.prepare(`
    SELECT p.*, r.name AS referrer_name, r.chart_no AS referrer_chart_no
    FROM patients p LEFT JOIN patients r ON r.id = p.referred_by
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: '找不到病患' });
  res.json(p);
});

router.post('/patients', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!body.name) return res.status(400).json({ error: '請輸入姓名' });
  const cols = ['chart_no', ...PATIENT_FIELDS];
  const info = db.prepare(
    `INSERT INTO patients (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
  ).run(nextChartNo(), ...PATIENT_FIELDS.map(f => clean(body[f])));
  res.json({ id: info.lastInsertRowid });
});

router.put('/patients/:id', requireAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: '找不到病患' });
  const body = req.body || {};
  // 不能把自己設為自己的推薦人
  if (Number(body.referred_by) === p.id) body.referred_by = null;
  db.prepare(
    `UPDATE patients SET ${PATIENT_FIELDS.map(f => `${f} = ?`).join(', ')} WHERE id = ?`
  ).run(...PATIENT_FIELDS.map(f => body[f] !== undefined ? clean(body[f]) : p[f]), p.id);
  res.json({ ok: true });
});

// ---- 推薦貢獻（這位病患介紹來的新客與其消費）----
router.get('/patients/:id/referral-stats', requireAuth, (req, res) => {
  const referred = db.prepare(`
    SELECT p.id, p.chart_no, p.name, p.created_at,
      COALESCE((SELECT SUM(amount) FROM payments WHERE patient_id = p.id), 0) AS spend
    FROM patients p
    WHERE p.referred_by = ?
    ORDER BY p.id DESC
  `).all(req.params.id);
  res.json({
    referred_count: referred.length,
    referred_revenue: referred.reduce((s, r) => s + r.spend, 0),
    referred,
  });
});

// ---- 病歷首頁彙整（一頁整合病患關鍵資訊）----
router.get('/patients/:id/summary', requireAuth, (req, res) => {
  const id = req.params.id;
  const patient = db.prepare(`
    SELECT p.*, r.name AS referrer_name, r.chart_no AS referrer_chart_no
    FROM patients p LEFT JOIN patients r ON r.id = p.referred_by
    WHERE p.id = ?
  `).get(id);
  if (!patient) return res.status(404).json({ error: '找不到病患' });

  const packages = db.prepare(`
    SELECT k.*, s.name AS service_name, s.category
    FROM packages k JOIN services s ON s.id = k.service_id
    WHERE k.patient_id = ? ORDER BY k.id DESC
  `).all(id);

  const visitAgg = db.prepare('SELECT COUNT(*) AS c, MAX(date) AS last FROM visits WHERE patient_id = ?').get(id);
  const spent = db.prepare('SELECT COALESCE(SUM(amount), 0) AS t FROM payments WHERE patient_id = ?').get(id).t;
  const referredCount = db.prepare('SELECT COUNT(*) AS c FROM patients WHERE referred_by = ?').get(id).c;
  const referredRevenue = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS t FROM payments WHERE patient_id IN (SELECT id FROM patients WHERE referred_by = ?)'
  ).get(id).t;

  const recentVisits = db.prepare(`
    SELECT v.*, u.name AS doctor_name,
      (SELECT COUNT(*) FROM photos WHERE visit_id = v.id) AS photo_count
    FROM visits v LEFT JOIN users u ON u.id = v.doctor_id
    WHERE v.patient_id = ? ORDER BY v.date DESC, v.id DESC LIMIT 3
  `).all(id);

  res.json({
    patient,
    packages,
    totals: {
      visits: visitAgg.c,
      lastVisit: visitAgg.last,
      spent,
      referredCount,
      referredRevenue,
    },
    recentVisits,
  });
});

// ---- 療程套組 ----
router.get('/patients/:id/packages', requireAuth, (req, res) => {
  res.json(db.prepare(`
    SELECT k.*, s.name AS service_name, s.category
    FROM packages k JOIN services s ON s.id = k.service_id
    WHERE k.patient_id = ? ORDER BY k.id DESC
  `).all(req.params.id));
});

router.post('/patients/:id/packages', requireRole('admin', 'staff'), (req, res) => {
  const { service_id, total_sessions, price, notes, payment } = req.body || {};
  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(service_id);
  if (!svc) return res.status(400).json({ error: '請選擇療程項目' });
  const patientId = Number(req.params.id);
  const create = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO packages (patient_id, service_id, total_sessions, price, purchased_at, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(patientId, svc.id, Number(total_sessions) || svc.default_sessions,
      Number(price) || 0, today(), notes || null);
    // 購買時同步收款
    if (payment && payment.method) {
      db.prepare(`
        INSERT INTO payments (patient_id, package_id, amount, method, paid_at, handled_by, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(patientId, info.lastInsertRowid, Number(payment.amount) || Number(price) || 0,
        payment.method, today(), req.session.user.id, `購買 ${svc.name}`);
    }
    return info.lastInsertRowid;
  });
  res.json({ id: create() });
});

// ---- 看診記錄 ----
router.get('/patients/:id/visits', requireAuth, (req, res) => {
  const visits = db.prepare(`
    SELECT v.*, u.name AS doctor_name, s.name AS package_service_name
    FROM visits v
    LEFT JOIN users u ON u.id = v.doctor_id
    LEFT JOIN packages k ON k.id = v.package_id
    LEFT JOIN services s ON s.id = k.service_id
    WHERE v.patient_id = ? ORDER BY v.date DESC, v.id DESC
  `).all(req.params.id);
  const photoStmt = db.prepare('SELECT * FROM photos WHERE visit_id = ? ORDER BY id');
  for (const v of visits) v.photos = photoStmt.all(v.id);
  res.json(visits);
});

router.post('/patients/:id/visits', requireRole('admin', 'doctor'), (req, res) => {
  const { doctor_id, appointment_id, package_id, date, chief_complaint, treatment, doctor_orders } = req.body || {};
  const patientId = Number(req.params.id);
  const create = db.transaction(() => {
    if (package_id) {
      const pkg = db.prepare('SELECT * FROM packages WHERE id = ? AND patient_id = ?')
        .get(package_id, patientId);
      if (!pkg) throw new Error('找不到療程套組');
      if (pkg.used_sessions >= pkg.total_sessions) throw new Error('此套組堂數已用完');
      db.prepare('UPDATE packages SET used_sessions = used_sessions + 1 WHERE id = ?').run(pkg.id);
    }
    const info = db.prepare(`
      INSERT INTO visits (patient_id, doctor_id, appointment_id, package_id, date,
        chief_complaint, treatment, doctor_orders)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(patientId, doctor_id || req.session.user.id, appointment_id || null,
      package_id || null, date || today(),
      chief_complaint || null, treatment || null, doctor_orders || null);
    if (appointment_id) {
      db.prepare("UPDATE appointments SET status = 'completed' WHERE id = ?").run(appointment_id);
    }
    return info.lastInsertRowid;
  });
  try {
    res.json({ id: create() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/visits/:id', requireRole('admin', 'doctor'), (req, res) => {
  const v = db.prepare('SELECT * FROM visits WHERE id = ?').get(req.params.id);
  if (!v) return res.status(404).json({ error: '找不到看診記錄' });
  const { chief_complaint, treatment, doctor_orders } = req.body || {};
  db.prepare('UPDATE visits SET chief_complaint = ?, treatment = ?, doctor_orders = ? WHERE id = ?')
    .run(chief_complaint ?? v.chief_complaint, treatment ?? v.treatment,
      doctor_orders ?? v.doctor_orders, v.id);
  res.json({ ok: true });
});

// ---- 照片 ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `p${req.params.id}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, /^image\//.test(file.mimetype));
  },
});

router.get('/patients/:id/photos', requireAuth, (req, res) => {
  res.json(db.prepare(
    'SELECT * FROM photos WHERE patient_id = ? ORDER BY taken_at DESC, id DESC'
  ).all(req.params.id));
});

router.post('/patients/:id/photos', requireRole('admin', 'doctor'),
  upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: '請選擇圖片檔案' });
    const { type, visit_id, note } = req.body || {};
    if (!['before', 'after'].includes(type)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: '請選擇術前或術後' });
    }
    const info = db.prepare(`
      INSERT INTO photos (patient_id, visit_id, type, file_path, taken_at, note)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.params.id, visit_id || null, type,
      '/uploads/' + req.file.filename, today(), note || null);
    res.json({ id: info.lastInsertRowid, file_path: '/uploads/' + req.file.filename });
  });

router.delete('/photos/:id', requireRole('admin', 'doctor'), (req, res) => {
  const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id);
  if (!photo) return res.status(404).json({ error: '找不到照片' });
  db.prepare('DELETE FROM photos WHERE id = ?').run(photo.id);
  const file = path.join(UPLOAD_DIR, path.basename(photo.file_path));
  fs.unlink(file, () => {});
  res.json({ ok: true });
});

export default router;
