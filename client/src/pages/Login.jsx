import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api('/auth/login', { method: 'POST', body: { username, password } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>🏥 診所 CRM</h1>
        <div className="sub">請登入以繼續</div>
        <form onSubmit={submit}>
          <input
            placeholder="帳號" value={username} autoFocus autoCapitalize="none"
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            placeholder="密碼" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button disabled={busy || !username || !password}>登入</button>
          {error && <div className="error-msg">{error}</div>}
        </form>
      </div>
    </div>
  );
}
