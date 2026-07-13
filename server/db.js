import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'clinic.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','doctor','staff')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chart_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('female','male','other') OR gender IS NULL),
  birthdate TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  allergies TEXT,
  medical_history TEXT,
  skin_type TEXT,
  referral_source TEXT,
  referred_by INTEGER REFERENCES patients(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  default_sessions INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  service_id INTEGER NOT NULL REFERENCES services(id),
  total_sessions INTEGER NOT NULL DEFAULT 1,
  used_sessions INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL DEFAULT 0,
  purchased_at TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER REFERENCES users(id),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 30,
  service_id INTEGER REFERENCES services(id),
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked','arrived','completed','no_show','cancelled')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER REFERENCES users(id),
  appointment_id INTEGER REFERENCES appointments(id),
  package_id INTEGER REFERENCES packages(id),
  date TEXT NOT NULL,
  chief_complaint TEXT,
  treatment TEXT,
  doctor_orders TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  visit_id INTEGER REFERENCES visits(id),
  type TEXT NOT NULL CHECK (type IN ('before','after')),
  file_path TEXT NOT NULL,
  taken_at TEXT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_photos_patient ON photos(patient_id);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  package_id INTEGER REFERENCES packages(id),
  visit_id INTEGER REFERENCES visits(id),
  amount INTEGER NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash','card','transfer')),
  paid_at TEXT NOT NULL,
  handled_by INTEGER REFERENCES users(id),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(paid_at);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire INTEGER NOT NULL
);
`);

// ---- 欄位遷移（讓既有資料庫也能升級）----
const patientCols = db.prepare("PRAGMA table_info(patients)").all().map((c) => c.name);
if (!patientCols.includes('referred_by')) {
  db.exec('ALTER TABLE patients ADD COLUMN referred_by INTEGER REFERENCES patients(id)');
}

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function nextChartNo() {
  const row = db.prepare("SELECT MAX(id) AS m FROM patients").get();
  return 'P' + String((row.m || 0) + 1).padStart(5, '0');
}

// ---- 初始資料（僅在空資料庫時建立）----
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  const insertUser = db.prepare(
    'INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)');
  insertUser.run('admin', bcrypt.hashSync('admin123', 10), '系統管理員', 'admin');
  insertUser.run('doctor1', bcrypt.hashSync('doctor123', 10), '王醫師', 'doctor');
  insertUser.run('staff1', bcrypt.hashSync('staff123', 10), '陳櫃檯', 'staff');

  const insertService = db.prepare(
    'INSERT INTO services (name, category, price, default_sessions) VALUES (?, ?, ?, ?)');
  insertService.run('皮秒雷射', '雷射光療', 8000, 5);
  insertService.run('音波拉提', '緊緻拉提', 45000, 1);
  insertService.run('玻尿酸注射', '微整注射', 15000, 1);
  insertService.run('杏仁酸煥膚', '美容保養', 2500, 6);
  insertService.run('除毛雷射', '雷射光療', 3000, 6);
  insertService.run('肉毒桿菌注射', '微整注射', 9000, 1);
  insertService.run('初診諮詢', '諮詢', 500, 1);
}

export default db;
