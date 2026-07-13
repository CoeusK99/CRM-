import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, toDateStr, today } from '../api.js';
import AppointmentModal from '../components/AppointmentModal.jsx';

const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const START_MIN = 9 * 60;   // 09:00
const END_MIN = 21 * 60;    // 21:00
const STEP = 30;

const SLOTS = [];
for (let m = START_MIN; m < END_MIN; m += STEP) {
  SLOTS.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
}

function mondayOf(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export default function Calendar() {
  const [view, setView] = useState(() => (window.innerWidth < 768 ? 'day' : 'week'));
  const [anchor, setAnchor] = useState(() => new Date());
  const [doctorId, setDoctorId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [appts, setAppts] = useState([]);
  const [modal, setModal] = useState(null); // { appt } 或 { initial }

  const days = useMemo(() => {
    if (view === 'day') return [toDateStr(anchor)];
    const mon = mondayOf(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(d.getDate() + i);
      return toDateStr(d);
    });
  }, [view, anchor]);

  useEffect(() => {
    api('/users').then((us) => setDoctors(us.filter((u) => u.role === 'doctor')));
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams({ from: days[0], to: days[days.length - 1] });
    if (doctorId) params.set('doctor_id', doctorId);
    api('/appointments?' + params).then(setAppts).catch(() => {});
  }, [days, doctorId]);
  useEffect(load, [load]);

  // 依「日期|時段」分組
  const byCell = useMemo(() => {
    const map = {};
    for (const a of appts) {
      const [h, m] = a.time.split(':').map(Number);
      const idx = Math.min(SLOTS.length - 1, Math.max(0, Math.floor((h * 60 + m - START_MIN) / STEP)));
      const key = a.date + '|' + SLOTS[idx];
      (map[key] ||= []).push(a);
    }
    return map;
  }, [appts]);

  const move = (dir) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() + dir * (view === 'week' ? 7 : 1));
    setAnchor(d);
  };

  const label = view === 'week'
    ? `${days[0].slice(5).replace('-', '/')} – ${days[6].slice(5).replace('-', '/')}`
    : new Date(days[0] + 'T00:00').toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div>
      <div className="page-head">
        <h1>預約行事曆</h1>
        <button onClick={() => setModal({ initial: { date: days[0] } })}>＋ 新增預約</button>
      </div>

      <div className="cal-toolbar">
        <button className="sm secondary" onClick={() => move(-1)}>◀</button>
        <button className="sm secondary" onClick={() => setAnchor(new Date())}>今天</button>
        <button className="sm secondary" onClick={() => move(1)}>▶</button>
        <strong style={{ marginLeft: 4 }}>{label}</strong>
        <div className="spacer" />
        <select style={{ width: 'auto' }} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">全部醫師</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select style={{ width: 'auto' }} value={view} onChange={(e) => setView(e.target.value)}>
          <option value="week">週檢視</option>
          <option value="day">日檢視</option>
        </select>
      </div>

      <div className="cal-scroll">
        <div
          className={`cal-grid${view === 'day' ? ' day-view' : ''}`}
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        >
          <div className="cal-head" style={{ borderLeft: 'none' }} />
          {days.map((d) => {
            const dt = new Date(d + 'T00:00');
            return (
              <div key={d} className={'cal-head' + (d === today() ? ' today-col' : '')}>
                {d.slice(5).replace('-', '/')}（{DAY_NAMES[dt.getDay()]}）
              </div>
            );
          })}
          {SLOTS.map((slot) => (
            <div key={slot} style={{ display: 'contents' }}>
              <div className="cal-time">{slot.endsWith(':00') ? slot : ''}</div>
              {days.map((d) => (
                <div
                  key={d + slot}
                  className="cal-cell"
                  onClick={() => setModal({ initial: { date: d, time: slot } })}
                >
                  {(byCell[d + '|' + slot] || []).map((a) => (
                    <div
                      key={a.id}
                      className={'appt-chip ' + a.status}
                      title={`${a.time} ${a.patient_name} ${a.service_name || ''}`}
                      onClick={(e) => { e.stopPropagation(); setModal({ appt: a }); }}
                    >
                      {a.time} {a.patient_name}{a.service_name ? `・${a.service_name}` : ''}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {modal && (
        <AppointmentModal
          appt={modal.appt}
          initial={modal.initial}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
