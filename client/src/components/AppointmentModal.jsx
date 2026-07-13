import { useEffect, useState } from 'react';
import { api, STATUS_LABELS, today } from '../api.js';
import { Field, Modal, PatientPicker } from './ui.jsx';

// 新增/編輯預約。appt 為既有預約物件則進入編輯模式；
// initial 可帶入 { date, time, patient } 預填。
export default function AppointmentModal({ appt, initial, onSaved, onClose }) {
  const editing = !!appt;
  const [patient, setPatient] = useState(
    appt ? { id: appt.patient_id, name: appt.patient_name, chart_no: appt.chart_no, phone: appt.phone }
      : initial?.patient || null
  );
  const [form, setForm] = useState({
    doctor_id: appt?.doctor_id || '',
    service_id: appt?.service_id || '',
    date: appt?.date || initial?.date || today(),
    time: appt?.time || initial?.time || '10:00',
    duration: appt?.duration || 30,
    status: appt?.status || 'booked',
    notes: appt?.notes || '',
  });
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/users').then((us) => setDoctors(us.filter((u) => u.role === 'doctor')));
    api('/services').then(setServices);
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!patient) return setError('請選擇病患');
    setBusy(true);
    setError('');
    const body = { ...form, patient_id: patient.id, doctor_id: form.doctor_id || null, service_id: form.service_id || null };
    try {
      if (editing) await api('/appointments/' + appt.id, { method: 'PUT', body });
      else await api('/appointments', { method: 'POST', body });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await api('/appointments/' + appt.id, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? '編輯預約' : '新增預約'} onClose={onClose}>
      <div className="form-grid">
        <Field label="病患" full><PatientPicker value={patient} onChange={setPatient} /></Field>
        <Field label="日期"><input type="date" value={form.date} onChange={set('date')} /></Field>
        <Field label="時間"><input type="time" step="900" value={form.time} onChange={set('time')} /></Field>
        <Field label="醫師">
          <select value={form.doctor_id} onChange={set('doctor_id')}>
            <option value="">未指定</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="療程項目">
          <select value={form.service_id} onChange={set('service_id')}>
            <option value="">未指定</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="時長（分鐘）">
          <select value={form.duration} onChange={set('duration')}>
            {[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
        {editing && (
          <Field label="狀態">
            <select value={form.status} onChange={set('status')}>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </Field>
        )}
        <Field label="備註" full><textarea value={form.notes} onChange={set('notes')} /></Field>
      </div>
      {error && <div className="error-msg">{error}</div>}
      <div className="actions">
        {editing && appt.status !== 'cancelled' && (
          <button className="danger" disabled={busy} onClick={cancel} style={{ marginRight: 'auto' }}>取消此預約</button>
        )}
        <button className="secondary" onClick={onClose}>關閉</button>
        <button disabled={busy} onClick={save}>儲存</button>
      </div>
    </Modal>
  );
}
