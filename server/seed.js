// 示範資料種子腳本：建立一份擬真的醫美診所初步模型。
// 執行：npm run seed（會清空既有病患/預約/看診/收費資料，保留使用者與療程項目）
import db from './db.js';

const fmt = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); };
const daysAhead = (n) => daysAgo(-n);

// 療程項目 name -> {id, price, default_sessions}
const svc = {};
for (const s of db.prepare('SELECT * FROM services').all()) svc[s.name] = s;

// 王醫師（doctor 角色）作為看診/預約醫師
const doctor = db.prepare("SELECT id FROM users WHERE role = 'doctor' ORDER BY id LIMIT 1").get();
const staff = db.prepare("SELECT id FROM users WHERE role = 'staff' ORDER BY id LIMIT 1").get();
const doctorId = doctor ? doctor.id : null;
const staffId = staff ? staff.id : null;

// 病患：ref 指向推薦人姓名；packages 為購買的療程套組（used=已使用堂數）
const PATIENTS = [
  { name: '林雅婷', gender: 'female', phone: '0911100200', skin_type: '混合性', source: '網路廣告',
    buyAgo: 20, packages: [{ s: '音波拉提', used: 1 }, { s: '皮秒雷射', used: 3 }] },
  { name: '陳美惠', gender: 'female', phone: '0922233111', skin_type: '乾性', source: '朋友介紹', ref: '林雅婷',
    buyAgo: 16, packages: [{ s: '皮秒雷射', used: 2 }] },
  { name: '張淑芬', gender: 'female', phone: '0933344222', skin_type: '敏感性', source: '朋友介紹', ref: '林雅婷',
    buyAgo: 12, packages: [{ s: '杏仁酸煥膚', used: 3 }] },
  { name: '王建宏', gender: 'male', phone: '0955566333', skin_type: '油性', source: '朋友介紹', ref: '林雅婷',
    buyAgo: 9, packages: [{ s: '除毛雷射', used: 2 }] },
  { name: '許雅涵', gender: 'female', phone: '0966677444', skin_type: '混合性', source: '朋友介紹', ref: '林雅婷',
    buyAgo: 5, packages: [{ s: '玻尿酸注射', used: 1 }] },
  { name: '李佳穎', gender: 'female', phone: '0977788555', skin_type: '乾性', source: '朋友介紹', ref: '陳美惠',
    buyAgo: 7, packages: [{ s: '皮秒雷射', used: 1 }] },
  { name: '黃志明', gender: 'male', phone: '0910101010', skin_type: '油性', source: 'Google 搜尋',
    buyAgo: 14, packages: [{ s: '肉毒桿菌注射', used: 1 }] },
  { name: '吳婉如', gender: 'female', phone: '0920202020', skin_type: '中性', source: 'Instagram', ref: '黃志明',
    buyAgo: 6, packages: [{ s: '杏仁酸煥膚', used: 2 }] },
  { name: '劉曉薇', gender: 'female', phone: '0930303030', skin_type: '敏感性', source: '網路廣告',
    buyAgo: 11, packages: [{ s: '音波拉提', used: 1 }] },
  { name: '蔡佩珊', gender: 'female', phone: '0940404040', skin_type: '混合性', source: '朋友介紹', ref: '劉曉薇',
    buyAgo: 3, packages: [] },
  { name: '鄭雅文', gender: 'female', phone: '0950505050', skin_type: '乾性', source: '診所官網',
    buyAgo: 2, packages: [{ s: '皮秒雷射', used: 1 }] },
  { name: '周家豪', gender: 'male', phone: '0960606060', skin_type: '油性', source: '路過',
    buyAgo: 1, packages: [] },
];

const VISIT_NOTES = [
  { cc: '臉部細紋想改善', tx: '音波拉提全臉，依部位調整能量', od: '一週內加強保濕、避免過度清潔' },
  { cc: '膚色暗沉、毛孔粗大', tx: '皮秒雷射全臉施打 3.5J', od: '加強防曬 SPF50，一週勿去角質' },
  { cc: '法令紋明顯', tx: '玻尿酸注射法令紋 1cc', od: '24 小時內勿按壓、勿處高溫環境' },
  { cc: '兩頰痘疤', tx: '皮秒蜂巢透鏡處理痘疤', od: '結痂勿摳，加強保濕修復' },
  { cc: '腋下除毛', tx: '除毛雷射腋下', od: '術後勿曝曬，48 小時勿泡湯' },
  { cc: '膚質保養', tx: '杏仁酸 20% 煥膚', od: '加強保濕與防曬' },
  { cc: '眉間動態紋', tx: '肉毒桿菌注射眉間 20u', od: '4 小時內勿平躺、勿揉壓' },
];
const METHODS = ['cash', 'card', 'transfer'];

const run = db.transaction(() => {
  // 清空交易性資料（保留 users / services / sessions）
  for (const t of ['payments', 'photos', 'visits', 'packages', 'appointments', 'patients']) {
    db.prepare(`DELETE FROM ${t}`).run();
  }
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('patients','packages','appointments','visits','photos','payments')").run();

  const insPatient = db.prepare(`
    INSERT INTO patients (chart_no, name, gender, phone, skin_type, referral_source)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const insPackage = db.prepare(`
    INSERT INTO packages (patient_id, service_id, total_sessions, used_sessions, price, purchased_at)
    VALUES (?, ?, ?, ?, ?, ?)`);
  const insVisit = db.prepare(`
    INSERT INTO visits (patient_id, doctor_id, package_id, date, chief_complaint, treatment, doctor_orders)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const insPay = db.prepare(`
    INSERT INTO payments (patient_id, package_id, amount, method, paid_at, handled_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const insAppt = db.prepare(`
    INSERT INTO appointments (patient_id, doctor_id, date, time, duration, service_id, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

  // 1) 建立病患
  const idByName = {};
  let n = 1;
  for (const p of PATIENTS) {
    const chart = 'P' + String(n).padStart(5, '0');
    const info = insPatient.run(chart, p.name, p.gender, p.phone, p.skin_type, p.source);
    idByName[p.name] = info.lastInsertRowid;
    n++;
  }
  // 2) 設定推薦人
  for (const p of PATIENTS) {
    if (p.ref && idByName[p.ref]) {
      db.prepare('UPDATE patients SET referred_by = ? WHERE id = ?').run(idByName[p.ref], idByName[p.name]);
    }
  }

  // 3) 套組 + 收費 + 看診
  let visitSeq = 0, payMethod = 0;
  for (const p of PATIENTS) {
    const pid = idByName[p.name];
    for (const pk of p.packages) {
      const s = svc[pk.s];
      if (!s) continue;
      const total = s.default_sessions;
      const price = s.price * total;
      const buyDate = daysAgo(p.buyAgo);
      const pkgInfo = insPackage.run(pid, s.id, total, pk.used, price, buyDate);
      const pkgId = pkgInfo.lastInsertRowid;
      // 購買收款
      insPay.run(pid, pkgId, price, METHODS[payMethod++ % 3], buyDate, staffId, `購買 ${s.name}`);
      // 每使用一堂 = 一次看診（從購買日之後陸續進行）
      for (let i = 0; i < pk.used; i++) {
        const note = VISIT_NOTES[visitSeq++ % VISIT_NOTES.length];
        const vdate = daysAgo(Math.max(0, p.buyAgo - (i + 1) * 3));
        insVisit.run(pid, doctorId, pkgId, vdate, note.cc, note.tx, note.od);
      }
    }
  }

  // 4) 今日預約（不同狀態，讓看板有內容）
  const todayAppts = [
    ['林雅婷', '09:30', '音波拉提', 'completed'],
    ['黃志明', '10:00', '肉毒桿菌注射', 'completed'],
    ['陳美惠', '10:30', '皮秒雷射', 'arrived'],
    ['鄭雅文', '11:00', '皮秒雷射', 'arrived'],
    ['蔡佩珊', '14:00', '初診諮詢', 'booked'],
    ['周家豪', '15:00', '初診諮詢', 'booked'],
    ['吳婉如', '16:00', '杏仁酸煥膚', 'booked'],
    ['劉曉薇', '17:00', '音波拉提', 'no_show'],
  ];
  for (const [name, time, sname, status] of todayAppts) {
    insAppt.run(idByName[name], doctorId, daysAgo(0), time, 30, svc[sname]?.id || null, status, null);
  }

  // 5) 本週其他天的預約（讓行事曆有分佈）
  const weekAppts = [
    ['張淑芬', 1, '10:00', '杏仁酸煥膚'],
    ['王建宏', 1, '15:30', '除毛雷射'],
    ['許雅涵', 2, '11:00', '玻尿酸注射'],
    ['李佳穎', 2, '14:30', '皮秒雷射'],
    ['林雅婷', 3, '16:00', '皮秒雷射'],
    ['黃志明', 4, '10:30', '肉毒桿菌注射'],
  ];
  for (const [name, ahead, time, sname] of weekAppts) {
    insAppt.run(idByName[name], doctorId, daysAhead(ahead), time, 30, svc[sname]?.id || null, 'booked', null);
  }

  // 6) 今日已完成預約補一筆當日收費（讓當日營收有數字）
  insPay.run(idByName['黃志明'], null, svc['肉毒桿菌注射'].price, 'card', daysAgo(0), staffId, '肉毒桿菌注射');
  insPay.run(idByName['林雅婷'], null, 3000, 'cash', daysAgo(0), staffId, '保養品');
});

run();

const c = db.prepare('SELECT COUNT(*) AS c FROM patients').get().c;
const a = db.prepare('SELECT COUNT(*) AS c FROM appointments').get().c;
const v = db.prepare('SELECT COUNT(*) AS c FROM visits').get().c;
const pay = db.prepare('SELECT COUNT(*) AS c FROM payments').get().c;
console.log(`✓ 已建立示範資料：病患 ${c} 位、預約 ${a} 筆、看診 ${v} 筆、收費 ${pay} 筆`);
