// 內建看診表單範本：新增/顯示看診記錄時共用。
// 每種表單有自己的欄位；一般看診沿用主訴/處置/醫囑。
export const FORM_TEMPLATES = {
  general: {
    label: '一般看診',
    fields: [
      { key: 'chief_complaint', label: '主訴', type: 'textarea' },
      { key: 'treatment', label: '處置內容', type: 'textarea' },
      { key: 'doctor_orders', label: '醫囑', type: 'textarea' },
    ],
  },
  followup: {
    label: '回診追蹤',
    fields: [
      { key: 'days_since', label: '距上次天數', type: 'number' },
      { key: 'recovery', label: '恢復狀況', type: 'select', options: ['良好', '普通', '需追蹤', '異常'] },
      { key: 'satisfaction', label: '滿意度', type: 'rating' },
      { key: 'side_effects', label: '副作用 / 不適', type: 'textarea' },
      { key: 'advice', label: '後續建議', type: 'textarea' },
    ],
  },
  initial: {
    label: '初診評估',
    fields: [
      { key: 'chief_complaint', label: '主訴 / 需求', type: 'textarea' },
      { key: 'expectation', label: '期望改善', type: 'textarea' },
      { key: 'skin_assessment', label: '皮膚評估', type: 'textarea' },
      { key: 'history_confirm', label: '病史 / 過敏確認', type: 'text' },
      { key: 'recommendation', label: '建議療程', type: 'textarea' },
    ],
  },
  procedure: {
    label: '療程記錄',
    fields: [
      { key: 'area', label: '施作部位', type: 'text' },
      { key: 'dose', label: '能量 / 劑量', type: 'text' },
      { key: 'shots', label: '發數 / 數量', type: 'text' },
      { key: 'product_lot', label: '產品 / 批號', type: 'text' },
      { key: 'aftercare', label: '術後衛教', type: 'textarea' },
    ],
  },
  hair_transplant: {
    label: '植髮術後',
    fields: [
      { key: 'method', label: '移植方式', type: 'select', options: ['FUE', 'FUT', 'FUE + FUT'] },
      { key: 'grafts', label: '移植株數', type: 'number' },
      { key: 'recipient_area', label: '植髮部位', type: 'text' },
      { key: 'days_postop', label: '術後天數', type: 'number' },
      { key: 'swelling', label: '腫脹程度', type: 'select', options: ['無', '輕微', '中度', '明顯'] },
      { key: 'pain', label: '疼痛程度', type: 'select', options: ['無', '輕微', '中度', '劇烈'] },
      { key: 'graft_condition', label: '植髮區狀況（結痂/紅腫/生長）', type: 'textarea' },
      { key: 'donor_condition', label: '供區狀況', type: 'textarea' },
      { key: 'medication', label: '用藥', type: 'text' },
      { key: 'aftercare', label: '清潔與衛教', type: 'textarea' },
      { key: 'next_followup', label: '下次回診', type: 'text' },
    ],
  },
  satisfaction: {
    label: '滿意度問卷',
    fields: [
      { key: 'service_score', label: '服務滿意度', type: 'rating' },
      { key: 'result_score', label: '效果滿意度', type: 'rating' },
      { key: 'recommend', label: '願意推薦', type: 'select', options: ['是', '否', '再考慮'] },
      { key: 'feedback', label: '意見回饋', type: 'textarea' },
    ],
  },
};

export const FORM_TYPE_ORDER = ['general', 'followup', 'initial', 'procedure', 'hair_transplant', 'satisfaction'];

export const formLabel = (t) => (FORM_TEMPLATES[t] || FORM_TEMPLATES.general).label;

// 把某筆看診的 form_data 依範本整理成可顯示的 [{label, value}]（略過空值）
export function formEntries(type, data) {
  const tpl = FORM_TEMPLATES[type] || FORM_TEMPLATES.general;
  const d = data || {};
  return tpl.fields
    .filter((f) => d[f.key] !== undefined && d[f.key] !== '' && d[f.key] !== null)
    .map((f) => ({
      label: f.label,
      value: f.type === 'rating' ? '★'.repeat(Number(d[f.key]) || 0) + `（${d[f.key]}）` : d[f.key],
    }));
}
