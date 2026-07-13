export async function api(path, opts = {}) {
  const { body, ...rest } = opts;
  const isForm = body instanceof FormData;
  const res = await fetch('/api' + path, {
    credentials: 'same-origin',
    headers: isForm || body === undefined ? {} : { 'Content-Type': 'application/json' },
    ...rest,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event('auth:expired'));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '發生錯誤，請稍後再試');
  return data;
}

export const STATUS_LABELS = {
  booked: '已預約', arrived: '已報到', completed: '完成', no_show: '未到', cancelled: '取消',
};
export const METHOD_LABELS = { cash: '現金', card: '刷卡', transfer: '轉帳' };
export const ROLE_LABELS = { admin: '管理者', doctor: '醫師', staff: '櫃檯' };
export const GENDER_LABELS = { female: '女', male: '男', other: '其他' };

export const fmtMoney = (n) => 'NT$ ' + Number(n || 0).toLocaleString();

export function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const today = () => toDateStr(new Date());

export function age(birthdate) {
  if (!birthdate) return '';
  const b = new Date(birthdate);
  if (isNaN(b)) return '';
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a;
}
