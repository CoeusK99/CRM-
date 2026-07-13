import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { age, api, GENDER_LABELS } from '../api.js';
import { Empty, Field, Modal, PatientPicker } from '../components/ui.jsx';

export const PATIENT_FORM_FIELDS = [
  { key: 'name', label: '姓名 *' },
  { key: 'gender', label: '性別', type: 'select', options: [['', '未填'], ['female', '女'], ['male', '男'], ['other', '其他']] },
  { key: 'birthdate', label: '生日', type: 'date' },
  { key: 'phone', label: '電話', type: 'tel' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'referral_source', label: '來源管道', placeholder: '例：網路廣告、親友介紹' },
  { key: 'address', label: '地址', full: true },
  { key: 'skin_type', label: '膚質', placeholder: '例：混合性、敏感性' },
  { key: 'allergies', label: '過敏史', placeholder: '藥物/成分過敏' },
  { key: 'medical_history', label: '病史', type: 'textarea', full: true },
  { key: 'notes', label: '備註', type: 'textarea', full: true },
];

export function PatientFields({ form, setForm, excludeId }) {
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setReferrer = (p) => setForm({ ...form, __referrer: p, referred_by: p ? p.id : null });
  return (
    <div className="form-grid">
      {PATIENT_FORM_FIELDS.map((f) => (
        <Field key={f.key} label={f.label} full={f.full}>
          {f.type === 'select' ? (
            <select value={form[f.key] || ''} onChange={set(f.key)}>
              {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea value={form[f.key] || ''} onChange={set(f.key)} placeholder={f.placeholder} />
          ) : (
            <input type={f.type || 'text'} value={form[f.key] || ''} onChange={set(f.key)} placeholder={f.placeholder} />
          )}
        </Field>
      ))}
      <Field label="推薦人（哪位客戶介紹來的）" full>
        <PatientPicker value={form.__referrer || null} excludeId={excludeId} onChange={setReferrer} />
      </Field>
    </div>
  );
}

export default function Patients() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const timer = useRef();

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api('/patients?q=' + encodeURIComponent(q)).then(setRows).catch(() => {});
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  const create = async () => {
    setError('');
    try {
      const { id } = await api('/patients', { method: 'POST', body: form });
      navigate('/patients/' + id);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>病患管理</h1>
        <button onClick={() => { setForm({}); setShowNew(true); }}>＋ 新增病患</button>
      </div>

      <div className="card">
        <input
          placeholder="🔍 搜尋姓名、電話或病歷號"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        {rows.length === 0 ? <Empty>找不到符合的病患</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>病歷號</th><th>姓名</th><th>性別</th><th>年齡</th><th>電話</th><th>建檔日</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => navigate('/patients/' + p.id)}>
                    <td className="muted">{p.chart_no}</td>
                    <td><strong>{p.name}</strong></td>
                    <td>{GENDER_LABELS[p.gender] || '—'}</td>
                    <td>{age(p.birthdate) || '—'}</td>
                    <td>{p.phone || '—'}</td>
                    <td className="muted small">{(p.created_at || '').slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showNew && (
        <Modal title="新增病患" wide onClose={() => setShowNew(false)}>
          <PatientFields form={form} setForm={setForm} />
          {error && <div className="error-msg">{error}</div>}
          <div className="actions">
            <button className="secondary" onClick={() => setShowNew(false)}>取消</button>
            <button disabled={!form.name} onClick={create}>建立病患</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
