import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 760 } : undefined}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, full, children }) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children = '目前沒有資料' }) {
  return <div className="empty">{children}</div>;
}

// 病患搜尋選擇器（輸入姓名/電話/病歷號即時搜尋）
// excludeId：從結果中排除的病患 id（例如推薦人不能是自己）
export function PatientPicker({ value, onChange, excludeId }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef();

  useEffect(() => {
    if (!open) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const rows = await api('/patients?q=' + encodeURIComponent(q));
        setResults(excludeId ? rows.filter((p) => p.id !== excludeId) : rows);
      } catch { /* 忽略搜尋錯誤 */ }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q, open, excludeId]);

  if (value) {
    return (
      <div className="list-row" style={{ borderBottom: 'none', padding: '4px 0' }}>
        <strong>{value.name}</strong>
        <span className="muted small">{value.chart_no}{value.phone ? ` · ${value.phone}` : ''}</span>
        <button type="button" className="sm secondary" onClick={() => onChange(null)}>重選</button>
      </div>
    );
  }
  return (
    <div className="picker">
      <input
        placeholder="輸入姓名、電話或病歷號搜尋"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && results.length > 0 && (
        <div className="drop">
          {results.map((p) => (
            <div key={p.id} className="opt" onMouseDown={() => { onChange(p); setOpen(false); }}>
              <strong>{p.name}</strong>{' '}
              <span className="muted small">{p.chart_no}{p.phone ? ` · ${p.phone}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
