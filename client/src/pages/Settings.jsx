import { useCallback, useEffect, useState } from 'react';
import { api, fmtMoney, ROLE_LABELS } from '../api.js';
import { Empty, Field, Modal } from '../components/ui.jsx';

export default function Settings() {
  const [tab, setTab] = useState('services');
  return (
    <div>
      <div className="page-head"><h1>系統設定</h1></div>
      <div className="tabs">
        <button className={tab === 'services' ? 'active' : ''} onClick={() => setTab('services')}>療程項目</button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>使用者帳號</button>
      </div>
      {tab === 'services' ? <ServicesTab /> : <UsersTab />}
    </div>
  );
}

function ServicesTab() {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null); // 'new' | service 物件
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/services?all=1').then(setRows).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const open = (svc) => {
    setForm(svc === 'new'
      ? { name: '', category: '', price: 0, default_sessions: 1, active: 1 }
      : { ...svc });
    setError('');
    setModal(svc);
  };

  const save = async () => {
    setError('');
    try {
      if (modal === 'new') await api('/services', { method: 'POST', body: form });
      else await api('/services/' + modal.id, { method: 'PUT', body: form });
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <button onClick={() => open('new')}>＋ 新增療程項目</button>
      </div>
      {rows.length === 0 ? <Empty /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>名稱</th><th>分類</th><th>單價</th><th>預設堂數</th><th>狀態</th><th></th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong></td>
                  <td>{s.category || '—'}</td>
                  <td>{fmtMoney(s.price)}</td>
                  <td>{s.default_sessions}</td>
                  <td>{s.active ? <span className="badge completed">啟用</span> : <span className="badge cancelled">停用</span>}</td>
                  <td><button className="sm secondary" onClick={() => open(s)}>編輯</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal === 'new' ? '新增療程項目' : '編輯療程項目'} onClose={() => setModal(null)}>
          <div className="form-grid">
            <Field label="名稱"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="分類"><input value={form.category} placeholder="例：雷射光療"
              onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="單價"><input type="number" min="0" value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
            <Field label="預設堂數"><input type="number" min="1" value={form.default_sessions}
              onChange={(e) => setForm({ ...form, default_sessions: e.target.value })} /></Field>
            {modal !== 'new' && (
              <Field label="狀態">
                <select value={form.active ? '1' : '0'} onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}>
                  <option value="1">啟用</option>
                  <option value="0">停用</option>
                </select>
              </Field>
            )}
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="actions">
            <button className="secondary" onClick={() => setModal(null)}>取消</button>
            <button disabled={!form.name} onClick={save}>儲存</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function UsersTab() {
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null); // 'new' | user 物件
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/users').then(setRows).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const open = (u) => {
    setForm(u === 'new'
      ? { username: '', password: '', name: '', role: 'staff' }
      : { ...u, password: '' });
    setError('');
    setModal(u);
  };

  const save = async () => {
    setError('');
    try {
      if (modal === 'new') await api('/users', { method: 'POST', body: form });
      else await api('/users/' + modal.id, { method: 'PUT', body: form });
      setModal(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <div style={{ marginBottom: 14 }}>
        <button onClick={() => open('new')}>＋ 新增使用者</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>帳號</th><th>姓名</th><th>角色</th><th>狀態</th><th></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td><strong>{u.name}</strong></td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>{u.active ? <span className="badge completed">啟用</span> : <span className="badge cancelled">停用</span>}</td>
                <td><button className="sm secondary" onClick={() => open(u)}>編輯</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={modal === 'new' ? '新增使用者' : '編輯使用者'} onClose={() => setModal(null)}>
          <div className="form-grid">
            {modal === 'new' && (
              <Field label="登入帳號"><input value={form.username} autoCapitalize="none"
                onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
            )}
            <Field label="姓名"><input value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="角色">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label={modal === 'new' ? '密碼' : '重設密碼（留空表示不變更）'}>
              <input type="password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            {modal !== 'new' && (
              <Field label="狀態">
                <select value={form.active ? '1' : '0'} onChange={(e) => setForm({ ...form, active: e.target.value === '1' })}>
                  <option value="1">啟用</option>
                  <option value="0">停用</option>
                </select>
              </Field>
            )}
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="actions">
            <button className="secondary" onClick={() => setModal(null)}>取消</button>
            <button disabled={!form.name || (modal === 'new' && (!form.username || !form.password))} onClick={save}>儲存</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
