// 만원 단위를 한국식 억/만원 표기로 변환
export function convertManwon(manwon) {
  const num = typeof manwon === 'string' ? parseInt(manwon.replace(/,/g, '')) : manwon;
  if (isNaN(num)) return null;
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const remain = num % 10000;
    return remain > 0 ? `약 ${eok}억 ${remain.toLocaleString()}만원` : `약 ${eok}억원`;
  }
  return `약 ${num.toLocaleString()}만원`;
}
