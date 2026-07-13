import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { api, ROLE_LABELS } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Calendar from './pages/Calendar.jsx';
import Patients from './pages/Patients.jsx';
import PatientDetail from './pages/PatientDetail.jsx';
import Billing from './pages/Billing.jsx';
import KeyCustomers from './pages/KeyCustomers.jsx';
import Settings from './pages/Settings.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const NAV = [
  { to: '/', label: '今日看板', icon: '📋' },
  { to: '/calendar', label: '預約行事曆', icon: '📅' },
  { to: '/patients', label: '病患管理', icon: '🧑‍⚕️' },
  { to: '/key-customers', label: '關鍵客戶', icon: '⭐', roles: ['admin', 'staff'] },
  { to: '/billing', label: '收費帳務', icon: '💳' },
  { to: '/settings', label: '系統設定', icon: '⚙️', roles: ['admin'] },
];

const TITLES = {
  '/': '今日看板', '/calendar': '預約行事曆', '/patients': '病患管理',
  '/key-customers': '關鍵客戶', '/billing': '收費帳務', '/settings': '系統設定',
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    api('/auth/me').then(setUser).catch(() => {}).finally(() => setLoading(false));
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (loading) return null;
  if (!user) return <Login onLogin={setUser} />;

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const title = location.pathname.startsWith('/patients/')
    ? '病患資料' : (TITLES[location.pathname] || '診所 CRM');

  return (
    <AuthContext.Provider value={user}>
      <div className="layout">
        {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}
        <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
          <div className="brand">🏥 診所 CRM</div>
          <nav>
            {NAV.filter((n) => !n.roles || n.roles.includes(user.role)).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}>
                <span>{n.icon}</span>{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="user-box">
            <div>
              <div className="who">{user.name}</div>
              <div className="role">{ROLE_LABELS[user.role]}</div>
            </div>
            <button className="sm secondary" onClick={logout}>登出</button>
          </div>
        </aside>
        <main className="main">
          <div className="topbar">
            <button className="icon-btn" aria-label="選單" onClick={() => setMenuOpen(true)}>☰</button>
            <div className="title">{title}</div>
          </div>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            {['admin', 'staff'].includes(user.role) && (
              <Route path="/key-customers" element={<KeyCustomers />} />
            )}
            <Route path="/billing" element={<Billing />} />
            {user.role === 'admin' && <Route path="/settings" element={<Settings />} />}
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </AuthContext.Provider>
  );
}
