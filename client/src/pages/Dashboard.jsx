import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtMoney, METHOD_LABELS, STATUS_LABELS } from '../api.js';
import { Empty } from '../components/ui.jsx';
import AppointmentModal from '../components/AppointmentModal.jsx';
import { useAuth } from '../App.jsx';

export default function Dashboard() {
  const user = useAuth();
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null); // 'new' | appointment 物件

  const load = useCallback(() => {
    api('/dashboard/today').then(setData).catch(() => {});
  }, []);
  useEffect(load, [load]);

  if (!data) return null;

  const setStatus = async (a, status) => {
    await api('/appointments/' + a.id, { method: 'PUT', body: { status } });
    load();
  };

  const dateLabel = new Date(data.date + 'T00:00').toLocaleDateString('zh-TW',
    { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div>
      <div className="page-head">
        <h1>今日看板 <span className="muted small">{dateLabel}</span></h1>
        <button onClick={() => setModal('new')}>＋ 新增預約</button>
      </div>

      <div className="stat-row">
        <div className="stat-card"><div className="label">今日預約</div><div className="value">{data.stats.total}</div></div>
        <div className="stat-card"><div className="label">已報到</div><div className="value">{data.stats.arrived}</div></div>
        <div className="stat-card"><div className="label">已完成</div><div className="value">{data.stats.completed}</div></div>
        {data.revenue && (
          <div className="stat-card">
            <div className="label">今日營收</div>
            <div className="value">{fmtMoney(data.revenue.total)}</div>
            <div className="muted small">
              {Object.entries(data.revenue.byMethod).map(([m, v]) => `${METHOD_LABELS[m]} ${fmtMoney(v)}`).join('｜') || '尚無收費'}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 17, marginBottom: 10 }}>今日預約名單</h2>
        {data.appointments.length === 0 ? <Empty>今天還沒有預約</Empty> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>時間</th><th>病患</th><th>療程</th><th>醫師</th><th>狀態</th><th>操作</th></tr>
              </thead>
              <tbody>
                {data.appointments.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.time}</strong></td>
                    <td>
                      <Link to={'/patients/' + a.patient_id}>{a.patient_name}</Link>
                      <div className="muted small">{a.chart_no}</div>
                    </td>
                    <td>{a.service_name || '—'}</td>
                    <td>{a.doctor_name || '—'}</td>
                    <td><span className={'badge ' + a.status}>{STATUS_LABELS[a.status]}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {a.status === 'booked' && <>
                          <button className="sm" onClick={() => setStatus(a, 'arrived')}>報到</button>
                          <button className="sm secondary" onClick={() => setStatus(a, 'no_show')}>未到</button>
                        </>}
                        {a.status === 'arrived' && ['admin', 'doctor'].includes(user.role) && (
                          <Link to={`/patients/${a.patient_id}?tab=visits&appt=${a.id}`}>
                            <button className="sm">寫看診記錄</button>
                          </Link>
                        )}
                        {a.status === 'arrived' && user.role === 'staff' && (
                          <button className="sm secondary" onClick={() => setStatus(a, 'completed')}>完成</button>
                        )}
                        <button className="sm ghost" onClick={() => setModal(a)}>編輯</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <AppointmentModal
          appt={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}
