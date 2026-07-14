import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { age, api, fmtMoney, GENDER_LABELS, METHOD_LABELS, today } from '../api.js';
import { Empty, Field, Modal } from '../components/ui.jsx';
import { PatientFields } from './Patients.jsx';
import { useAuth } from '../App.jsx';

const TABS = [
  ['summary', '病歷首頁'], ['info', '基本資料'], ['packages', '療程套組'],
  ['visits', '看診記錄'], ['photos', '照片'], ['payments', '收費記錄'],
];

export default function PatientDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'summary';
  const [patient, setPatient] = useState(null);

  const load = useCallback(() => {
    api('/patients/' + id).then(setPatient).catch(() => {});
  }, [id]);
  useEffect(load, [load]);

  if (!patient) return null;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="muted small"><Link to="/patients">← 回病患列表</Link></div>
          <h1 style={{ marginTop: 4 }}>
            {patient.name}{' '}
            <span className="muted" style={{ fontSize: 15, fontWeight: 500 }}>
              {patient.chart_no}
              {patient.gender ? `｜${GENDER_LABELS[patient.gender]}` : ''}
              {age(patient.birthdate) !== '' ? `｜${age(patient.birthdate)} 歲` : ''}
              {patient.phone ? `｜${patient.phone}` : ''}
            </span>
          </h1>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''}
            onClick={() => setParams({ tab: key })}>{label}</button>
        ))}
      </div>

      {tab === 'summary' && <ChartSummary patientId={id} onEdit={() => setParams({ tab: 'info' })} />}
      {tab === 'info' && <InfoTab patient={patient} onSaved={load} />}
      {tab === 'packages' && <PackagesTab patientId={id} />}
      {tab === 'visits' && <VisitsTab patientId={id} />}
      {tab === 'photos' && <PhotosTab patientId={id} />}
      {tab === 'payments' && <PaymentsTab patientId={id} />}
    </div>
  );
}

function ChartSummary({ patientId, onEdit }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api(`/patients/${patientId}/summary`).then(setData).catch(() => {});
  }, [patientId]);
  if (!data) return null;

  const { patient: p, packages, totals, recentVisits } = data;
  const hasAllergy = p.allergies && p.allergies.trim();
  const row = (label, value) => (
    <div className="summary-row">
      <span className="muted small">{label}</span>
      <span>{value || '—'}</span>
    </div>
  );

  return (
    <div>
      <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 12 }}>
        <button className="secondary" onClick={onEdit}>編輯基本資料</button>
        <button onClick={() => window.print()}>🖨 列印病歷首頁</button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="summary-h">病患基本資料</h2>
        <div className="summary-grid">
          {row('病歷號', p.chart_no)}
          {row('姓名', p.name)}
          {row('性別', GENDER_LABELS[p.gender])}
          {row('生日', p.birthdate ? `${p.birthdate}（${age(p.birthdate)} 歲）` : '')}
          {row('電話', p.phone)}
          {row('Email', p.email)}
          {row('膚質', p.skin_type)}
          {row('來源', p.referral_source)}
          {row('建檔日', (p.created_at || '').slice(0, 10))}
          {row('地址', p.address)}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, borderColor: hasAllergy ? '#fecaca' : undefined, background: hasAllergy ? '#fef2f2' : undefined }}>
        <h2 className="summary-h">{hasAllergy ? '⚠️ 過敏史 / 病史' : '過敏史 / 病史'}</h2>
        <div className="summary-row">
          <span className="muted small">過敏史</span>
          <strong style={{ color: hasAllergy ? 'var(--danger)' : 'inherit' }}>{hasAllergy ? p.allergies : '無記錄'}</strong>
        </div>
        {row('病史', p.medical_history)}
      </div>

      <div className="stat-row">
        <div className="stat-card"><div className="label">就診次數</div><div className="value">{totals.visits}</div></div>
        <div className="stat-card"><div className="label">最近就診</div><div className="value" style={{ fontSize: 20 }}>{totals.lastVisit || '—'}</div></div>
        <div className="stat-card"><div className="label">累計消費</div><div className="value" style={{ fontSize: 22 }}>{fmtMoney(totals.spent)}</div></div>
        <div className="stat-card"><div className="label">推薦新客</div><div className="value">{totals.referredCount} <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>位</span></div></div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <h2 className="summary-h">療程套組（剩餘堂數）</h2>
        {packages.length === 0 ? <Empty>尚未購買療程套組</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>療程項目</th><th>已用 / 總堂</th><th>剩餘</th><th>購買日</th></tr></thead>
              <tbody>
                {packages.map((k) => {
                  const left = k.total_sessions - k.used_sessions;
                  return (
                    <tr key={k.id}>
                      <td><strong>{k.service_name}</strong></td>
                      <td>{k.used_sessions} / {k.total_sessions}</td>
                      <td>{left > 0 ? <span className="badge completed">剩 {left} 堂</span> : <span className="badge cancelled">已用完</span>}</td>
                      <td className="muted small">{k.purchased_at}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(p.referrer_name || totals.referredCount > 0) && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h2 className="summary-h">推薦關係</h2>
          {p.referrer_name && (
            <div className="small">由 <strong>{p.referrer_name}</strong>（{p.referrer_chart_no}）介紹而來</div>
          )}
          {totals.referredCount > 0 && (
            <div className="small" style={{ marginTop: 4 }}>
              已推薦 <strong style={{ color: 'var(--primary)' }}>{totals.referredCount}</strong> 位新客，
              帶來營收 <strong style={{ color: 'var(--primary)' }}>{fmtMoney(totals.referredRevenue)}</strong>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="summary-h">最近看診記錄</h2>
        {recentVisits.length === 0 ? <Empty>尚無看診記錄</Empty> : recentVisits.map((v) => (
          <div key={v.id} className="visit-card" style={{ marginBottom: 10 }}>
            <div className="meta">
              <strong>{v.date}</strong>
              {v.doctor_name && <span className="muted small">{v.doctor_name}</span>}
              {v.photo_count > 0 && <span className="badge before">📷 {v.photo_count}</span>}
            </div>
            {v.chief_complaint && <div className="small"><span className="muted">主訴：</span>{v.chief_complaint}</div>}
            {v.treatment && <div className="small"><span className="muted">處置：</span>{v.treatment}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoTab({ patient, onSaved }) {
  const [form, setForm] = useState(() => ({
    ...patient,
    __referrer: patient.referred_by
      ? { id: patient.referred_by, name: patient.referrer_name, chart_no: patient.referrer_chart_no }
      : null,
  }));
  const [msg, setMsg] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api(`/patients/${patient.id}/referral-stats`).then(setStats).catch(() => {});
  }, [patient.id]);

  const save = async () => {
    setMsg('');
    try {
      await api('/patients/' + patient.id, { method: 'PUT', body: form });
      setMsg('已儲存 ✓');
      onSaved();
      setTimeout(() => setMsg(''), 2000);
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div>
      {stats && (stats.referred_count > 0 || patient.referrer_name) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 10 }}>⭐ 推薦關係</h2>
          {patient.referrer_name && (
            <div className="muted small" style={{ marginBottom: stats.referred_count > 0 ? 12 : 0 }}>
              由 <strong style={{ color: 'var(--text)' }}>{patient.referrer_name}</strong>
              （{patient.referrer_chart_no}）介紹而來
            </div>
          )}
          {stats.referred_count > 0 && (
            <>
              <div>
                已推薦 <strong style={{ color: 'var(--primary)' }}>{stats.referred_count}</strong> 位新客，
                帶來營收 <strong style={{ color: 'var(--primary)' }}>{fmtMoney(stats.referred_revenue)}</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {stats.referred.map((r) => (
                  <Link key={r.id} to={'/patients/' + r.id} className="badge before" style={{ textDecoration: 'none' }}>
                    {r.name}・{fmtMoney(r.spend)}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      <div className="card">
        <PatientFields form={form} setForm={setForm} excludeId={patient.id} />
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, alignItems: 'center' }}>
          {msg && <span className={msg.includes('✓') ? 'muted' : 'error-msg'} style={{ marginTop: 0 }}>{msg}</span>}
          <button disabled={!form.name} onClick={save}>儲存變更</button>
        </div>
      </div>
    </div>
  );
}

function PackagesTab({ patientId }) {
  const user = useAuth();
  const canSell = ['admin', 'staff'].includes(user.role);
  const [rows, setRows] = useState([]);
  const [services, setServices] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ service_id: '', total_sessions: 1, price: 0, pay: true, method: 'cash' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/patients/${patientId}/packages`).then(setRows).catch(() => {});
  }, [patientId]);
  useEffect(load, [load]);
  useEffect(() => { api('/services').then(setServices); }, []);

  const pickService = (e) => {
    const svc = services.find((s) => s.id === Number(e.target.value));
    setForm({
      ...form,
      service_id: e.target.value,
      total_sessions: svc?.default_sessions || 1,
      price: svc ? svc.price * (svc.default_sessions || 1) : 0,
    });
  };

  const save = async () => {
    setError('');
    try {
      await api(`/patients/${patientId}/packages`, {
        method: 'POST',
        body: {
          service_id: form.service_id,
          total_sessions: form.total_sessions,
          price: form.price,
          payment: form.pay ? { method: form.method, amount: form.price } : null,
        },
      });
      setShow(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      {canSell && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => { setForm({ service_id: '', total_sessions: 1, price: 0, pay: true, method: 'cash' }); setShow(true); }}>
            ＋ 新增療程套組
          </button>
        </div>
      )}
      {rows.length === 0 ? <Empty>尚未購買療程套組</Empty> : rows.map((k) => {
        const left = k.total_sessions - k.used_sessions;
        return (
          <div key={k.id} className="pkg-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <strong>{k.service_name}</strong>
              <span className="muted small">{k.purchased_at} 購入｜{fmtMoney(k.price)}</span>
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              已使用 {k.used_sessions} / {k.total_sessions} 堂，
              {left > 0 ? <strong style={{ color: 'var(--primary)' }}>剩餘 {left} 堂</strong> : '已用完'}
            </div>
            <div className="bar"><div style={{ width: `${(k.used_sessions / k.total_sessions) * 100}%` }} /></div>
          </div>
        );
      })}

      {show && (
        <Modal title="新增療程套組" onClose={() => setShow(false)}>
          <div className="form-grid">
            <Field label="療程項目" full>
              <select value={form.service_id} onChange={pickService}>
                <option value="">請選擇</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}（單堂 {fmtMoney(s.price)}）</option>
                ))}
              </select>
            </Field>
            <Field label="堂數">
              <input type="number" min="1" value={form.total_sessions}
                onChange={(e) => setForm({ ...form, total_sessions: e.target.value })} />
            </Field>
            <Field label="售價（總額）">
              <input type="number" min="0" value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label="收款" full>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                  <input type="checkbox" style={{ width: 20, minHeight: 20 }} checked={form.pay}
                    onChange={(e) => setForm({ ...form, pay: e.target.checked })} />
                  同時收款
                </label>
                {form.pay && (
                  <select style={{ width: 'auto' }} value={form.method}
                    onChange={(e) => setForm({ ...form, method: e.target.value })}>
                    {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                )}
              </div>
            </Field>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="actions">
            <button className="secondary" onClick={() => setShow(false)}>取消</button>
            <button disabled={!form.service_id} onClick={save}>建立</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function VisitsTab({ patientId }) {
  const user = useAuth();
  const canEdit = ['admin', 'doctor'].includes(user.role);
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [packages, setPackages] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [show, setShow] = useState(!!params.get('appt'));
  const [form, setForm] = useState({
    date: today(), doctor_id: '', package_id: '',
    chief_complaint: '', treatment: '', doctor_orders: '',
    appointment_id: params.get('appt') || null,
  });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/patients/${patientId}/visits`).then(setRows).catch(() => {});
    api(`/patients/${patientId}/packages`).then(setPackages).catch(() => {});
  }, [patientId]);
  useEffect(load, [load]);
  useEffect(() => {
    api('/users').then((us) => {
      setDoctors(us.filter((u) => u.role === 'doctor'));
      if (user.role === 'doctor') setForm((f) => ({ ...f, doctor_id: user.id }));
    });
  }, [user]);

  const save = async () => {
    setError('');
    try {
      await api(`/patients/${patientId}/visits`, { method: 'POST', body: form });
      setShow(false);
      setForm({ date: today(), doctor_id: form.doctor_id, package_id: '', chief_complaint: '', treatment: '', doctor_orders: '', appointment_id: null });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const available = packages.filter((k) => k.used_sessions < k.total_sessions);

  return (
    <div className="card">
      {canEdit && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => setShow(true)}>＋ 新增看診記錄</button>
        </div>
      )}
      {!canEdit && <div className="muted small" style={{ marginBottom: 12 }}>（看診記錄僅供檢視，如需修改請由醫師操作）</div>}
      {rows.length === 0 ? <Empty>尚無看診記錄</Empty> : rows.map((v) => (
        <div key={v.id} className="visit-card">
          <div className="meta">
            <strong>{v.date}</strong>
            {v.doctor_name && <span className="muted small">{v.doctor_name}</span>}
            {v.package_service_name && <span className="badge completed">扣套組：{v.package_service_name}</span>}
          </div>
          <dl>
            {v.chief_complaint && <><dt>主訴</dt><dd>{v.chief_complaint}</dd></>}
            {v.treatment && <><dt>處置內容</dt><dd>{v.treatment}</dd></>}
            {v.doctor_orders && <><dt>醫囑</dt><dd>{v.doctor_orders}</dd></>}
          </dl>
          {v.photos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {v.photos.map((ph) => (
                <a key={ph.id} href={ph.file_path} target="_blank" rel="noreferrer">
                  <img src={ph.file_path} alt={ph.type} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                </a>
              ))}
            </div>
          )}
        </div>
      ))}

      {show && (
        <Modal title="新增看診記錄" wide onClose={() => setShow(false)}>
          <div className="form-grid">
            <Field label="日期"><input type="date" value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="醫師">
              <select value={form.doctor_id} onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}>
                <option value="">未指定</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="使用療程套組（自動扣 1 堂）" full>
              <select value={form.package_id} onChange={(e) => setForm({ ...form, package_id: e.target.value })}>
                <option value="">不扣堂數</option>
                {available.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.service_name}（剩 {k.total_sessions - k.used_sessions} 堂）
                  </option>
                ))}
              </select>
            </Field>
            <Field label="主訴" full><textarea value={form.chief_complaint}
              onChange={(e) => setForm({ ...form, chief_complaint: e.target.value })} /></Field>
            <Field label="處置內容" full><textarea value={form.treatment}
              onChange={(e) => setForm({ ...form, treatment: e.target.value })} /></Field>
            <Field label="醫囑" full><textarea value={form.doctor_orders}
              onChange={(e) => setForm({ ...form, doctor_orders: e.target.value })} /></Field>
          </div>
          {form.appointment_id && <div className="muted small" style={{ marginTop: 8 }}>儲存後將自動把今日預約標記為「完成」。</div>}
          {error && <div className="error-msg">{error}</div>}
          <div className="actions">
            <button className="secondary" onClick={() => setShow(false)}>取消</button>
            <button onClick={save}>儲存記錄</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PhotosTab({ patientId }) {
  const user = useAuth();
  const canEdit = ['admin', 'doctor'].includes(user.role);
  const [rows, setRows] = useState([]);
  const [type, setType] = useState('before');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/patients/${patientId}/photos`).then(setRows).catch(() => {});
  }, [patientId]);
  useEffect(load, [load]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('type', type);
    try {
      await api(`/patients/${patientId}/photos`, { method: 'POST', body: fd });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (ph) => {
    if (!confirm('確定刪除這張照片？')) return;
    await api('/photos/' + ph.id, { method: 'DELETE' });
    load();
  };

  return (
    <div className="card">
      {canEdit && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <select style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="before">術前</option>
            <option value="after">術後</option>
          </select>
          <label className="btn" style={{ cursor: 'pointer' }}>
            {busy ? '上傳中…' : '📷 上傳照片'}
            <input type="file" accept="image/*" hidden disabled={busy} onChange={upload} />
          </label>
          {error && <span className="error-msg" style={{ marginTop: 0 }}>{error}</span>}
        </div>
      )}
      {rows.length === 0 ? <Empty>尚無照片</Empty> : (
        <div className="photo-grid">
          {rows.map((ph) => (
            <div key={ph.id} className="photo-item">
              <a href={ph.file_path} target="_blank" rel="noreferrer">
                <img src={ph.file_path} alt={ph.type} />
              </a>
              <div className="info">
                <span className={'badge ' + ph.type}>{ph.type === 'before' ? '術前' : '術後'}</span>
                <span>{ph.taken_at}</span>
                {canEdit && <button className="sm danger" onClick={() => remove(ph)}>刪除</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentsTab({ patientId }) {
  const user = useAuth();
  const canCharge = ['admin', 'staff'].includes(user.role);
  const [rows, setRows] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ amount: '', method: 'cash', notes: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/payments?patient_id=' + patientId).then(setRows).catch(() => {});
  }, [patientId]);
  useEffect(load, [load]);

  const save = async () => {
    setError('');
    try {
      await api('/payments', { method: 'POST', body: { ...form, patient_id: patientId } });
      setShow(false);
      setForm({ amount: '', method: 'cash', notes: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      {canCharge && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={() => setShow(true)}>＋ 新增收費</button>
        </div>
      )}
      {rows.length === 0 ? <Empty>尚無收費記錄</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>日期</th><th>金額</th><th>方式</th><th>項目/備註</th><th>經手人</th></tr></thead>
            <tbody>
              {rows.map((y) => (
                <tr key={y.id}>
                  <td>{y.paid_at}</td>
                  <td><strong>{fmtMoney(y.amount)}</strong></td>
                  <td>{METHOD_LABELS[y.method]}</td>
                  <td>{y.notes || y.service_name || '—'}</td>
                  <td>{y.handler_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {show && (
        <Modal title="新增收費" onClose={() => setShow(false)}>
          <div className="form-grid">
            <Field label="金額"><input type="number" min="0" value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="付款方式">
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="備註" full><input value={form.notes} placeholder="收費項目說明"
              onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="actions">
            <button className="secondary" onClick={() => setShow(false)}>取消</button>
            <button disabled={!form.amount} onClick={save}>建立收費</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
