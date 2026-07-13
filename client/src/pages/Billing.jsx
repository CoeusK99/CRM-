import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtMoney, METHOD_LABELS, today } from '../api.js';
import { Empty, Field, Modal, PatientPicker } from '../components/ui.jsx';
import { useAuth } from '../App.jsx';

export default function Billing() {
  const user = useAuth();
  const canCharge = ['admin', 'staff'].includes(user.role);
  const [date, setDate] = useState(today());
  const [payments, setPayments] = useState([]);
  const [report, setReport] = useState(null);
  const [show, setShow] = useState(false);
  const [patient, setPatient] = useState(null);
  const [form, setForm] = useState({ amount: '', method: 'cash', notes: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/payments?from=${date}&to=${date}`).then(setPayments).catch(() => {});
    if (canCharge) api('/reports/daily?date=' + date).then(setReport).catch(() => {});
  }, [date, canCharge]);
  useEffect(load, [load]);

  const save = async () => {
    if (!patient) return setError('請選擇病患');
    setError('');
    try {
      await api('/payments', {
        method: 'POST',
        body: { ...form, patient_id: patient.id, paid_at: date },
      });
      setShow(false);
      setPatient(null);
      setForm({ amount: '', method: 'cash', notes: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>收費帳務</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" style={{ width: 'auto' }} value={date} onChange={(e) => setDate(e.target.value)} />
          {canCharge && <button onClick={() => setShow(true)}>＋ 新增收費</button>}
        </div>
      </div>

      {report && (
        <div className="stat-row">
          <div className="stat-card"><div className="label">當日營收</div><div className="value">{fmtMoney(report.total)}</div></div>
          {['cash', 'card', 'transfer'].map((m) => {
            const row = report.byMethod.find((r) => r.method === m);
            return (
              <div key={m} className="stat-card">
                <div className="label">{METHOD_LABELS[m]}</div>
                <div className="value">{fmtMoney(row?.total || 0)}</div>
                <div className="muted small">{row?.count || 0} 筆</div>
              </div>
            );
          })}
          <div className="stat-card"><div className="label">看診人次</div><div className="value">{report.visits}</div></div>
          <div className="stat-card"><div className="label">新病患</div><div className="value">{report.newPatients}</div></div>
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: 17, marginBottom: 10 }}>{date} 收費明細</h2>
        {payments.length === 0 ? <Empty>這天沒有收費記錄</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>病患</th><th>金額</th><th>方式</th><th>項目/備註</th><th>經手人</th></tr></thead>
              <tbody>
                {payments.map((y) => (
                  <tr key={y.id}>
                    <td>
                      <Link to={'/patients/' + y.patient_id}>{y.patient_name}</Link>
                      <span className="muted small"> {y.chart_no}</span>
                    </td>
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
      </div>

      {show && (
        <Modal title="新增收費" onClose={() => setShow(false)}>
          <div className="form-grid">
            <Field label="病患" full><PatientPicker value={patient} onChange={setPatient} /></Field>
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
