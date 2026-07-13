import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtMoney } from '../api.js';
import { Empty } from '../components/ui.jsx';

const TIER_LABELS = {
  platinum: '白金', gold: '黃金', silver: '銀級', normal: '一般',
};

export default function KeyCustomers() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/key-customers').then(setData).catch(() => {});
  }, []);

  if (!data) return null;
  const { weights, customers } = data;

  return (
    <div>
      <div className="page-head">
        <h1>關鍵客戶 <span className="muted small">依推薦力與貢獻排名</span></h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="muted small" style={{ lineHeight: 1.8 }}>
          <strong style={{ color: 'var(--text)' }}>綜合指數</strong> 用來找出「最會幫你帶新客、且自己也高貢獻」的客戶，計算方式：
          <div style={{ marginTop: 6 }}>
            推薦新客 <b>×{weights.perReferral}</b> ＋
            推薦帶來營收（每萬元）<b>×{weights.perReferralRevenue}</b> ＋
            本人消費（每萬元）<b>×{weights.perOwnSpend}</b> ＋
            回診次數 <b>×{weights.perVisit}</b>
          </div>
          推薦相關的權重最高，所以會介紹新客的客戶會自然浮到前面。
        </div>
      </div>

      <div className="card">
        {customers.length === 0 ? (
          <Empty>目前還沒有可評分的客戶（需有消費、回診或推薦記錄）</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>排名</th><th>客戶</th><th>綜合指數</th>
                  <th>推薦人數</th><th>推薦營收</th><th>本人消費</th><th>回診</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr key={c.id}>
                    <td><strong style={{ fontSize: 16 }}>{i + 1}</strong></td>
                    <td>
                      <Link to={'/patients/' + c.id}>{c.name}</Link>
                      <div className="muted small">{c.chart_no}{c.phone ? `・${c.phone}` : ''}</div>
                    </td>
                    <td>
                      <span className={'badge tier-' + c.tier} style={{ fontSize: 14 }}>
                        {c.score}
                      </span>
                      <span className="muted small" style={{ marginLeft: 6 }}>{TIER_LABELS[c.tier]}</span>
                    </td>
                    <td>{c.referred_count > 0 ? <strong style={{ color: 'var(--primary)' }}>{c.referred_count}</strong> : '—'}</td>
                    <td>{c.referred_revenue > 0 ? fmtMoney(c.referred_revenue) : '—'}</td>
                    <td>{fmtMoney(c.own_spend)}</td>
                    <td>{c.visit_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
