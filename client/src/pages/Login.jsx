import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onLogin(await api('/auth/login', { method: 'POST', body: { email, password } }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const forgot = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api('/auth/forgot', { method: 'POST', body: { email } });
      setInfo(res.message || '已收到申請，請聯絡診所管理員協助重設密碼。');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setInfo('');
    setPassword('');
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>🏥 診所 CRM</h1>

        {mode === 'login' ? (
          <>
            <div className="sub">請登入以繼續</div>
            <form onSubmit={login}>
              <input
                placeholder="Email" type="email" value={email} autoFocus autoCapitalize="none"
                autoComplete="username"
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                placeholder="密碼" type="password" value={password} autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button disabled={busy || !email || !password}>登入</button>
              {error && <div className="error-msg">{error}</div>}
            </form>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button type="button" className="ghost sm" onClick={() => switchMode('forgot')}>
                忘記密碼？
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="sub">忘記密碼</div>
            {info ? (
              <>
                <div className="card" style={{ background: 'var(--primary-soft)', border: 'none', textAlign: 'center' }}>
                  ✅ {info}
                </div>
                <button type="button" style={{ width: '100%', marginTop: 16 }} onClick={() => switchMode('login')}>
                  返回登入
                </button>
              </>
            ) : (
              <>
                <p className="muted small" style={{ marginTop: 0 }}>
                  輸入你的 Email 送出申請，診所管理員會協助你重設密碼。
                </p>
                <form onSubmit={forgot}>
                  <input
                    placeholder="Email" type="email" value={email} autoFocus autoCapitalize="none"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button disabled={busy || !email}>送出重設申請</button>
                  {error && <div className="error-msg">{error}</div>}
                </form>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <button type="button" className="ghost sm" onClick={() => switchMode('login')}>
                    ← 返回登入
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
