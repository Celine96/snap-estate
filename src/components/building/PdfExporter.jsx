import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export async function exportToPdf(analysisData) {
  if (!analysisData) return;

  try {
    // html2pdf는 설치되어 있음
    const html2pdf = (await import('html2pdf.js')).default;

    const d = analysisData;
    const dateStr = new Date().toLocaleDateString('ko-KR');

    const prices = [
      d.estimated_price_sale    ? { label: '매매가', value: d.estimated_price_sale,    color: '#4D96FF' } : null,
      d.estimated_price_rent    ? { label: '전세가', value: d.estimated_price_rent,    color: '#ffffff' } : null,
      d.estimated_price_monthly ? { label: '월세',   value: d.estimated_price_monthly, color: '#ffffff' } : null,
    ].filter(Boolean);

    const specs = [
      d.building_type         ? { label: '건물 유형', value: d.building_type }                          : null,
      d.estimated_year        ? { label: '건축연도',  value: `${d.estimated_year}년` }                   : null,
      d.estimated_floors      ? { label: '층수',      value: `${d.estimated_floors}층` }                 : null,
      d.estimated_area_pyeong ? { label: '면적',      value: `${d.estimated_area_pyeong}평` }            : null,
    ].filter(Boolean);

    const confidenceColor = d.confidence === '높음' ? '#34D399' : d.confidence === '보통' ? '#FBBF24' : '#F43F5E';

    const html = `
      <div style="
        background: #121214;
        color: white;
        font-family: 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif;
        padding: 40px;
        width: 515px;
        box-sizing: border-box;
      ">
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:16px; border-bottom:1px solid #2C2C2E; margin-bottom:20px;">
          <span style="color:#4D96FF; font-size:14px; font-weight:700;">SnapEstate</span>
          <span style="color:#9AA0A6; font-size:10px;">${dateStr}</span>
        </div>

        ${d.image_url ? `<img src="${d.image_url}" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:16px;" crossorigin="anonymous" />` : ''}

        <!-- 건물명 -->
        <h1 style="font-size:18px; font-weight:700; margin:0 0 6px 0; color:white;">${d.building_name || '건물 분석 결과'}</h1>
        ${d.address ? `<p style="color:#9AA0A6; font-size:10px; margin:0 0 10px 0;">📍 ${d.address}</p>` : ''}
        ${d.confidence ? `<span style="background:${confidenceColor}33; color:${confidenceColor}; border:1px solid ${confidenceColor}55; padding:3px 10px; border-radius:4px; font-size:9px;">신뢰도 ${d.confidence}</span>` : ''}

        <div style="border-top:1px solid #2C2C2E; margin:16px 0;"></div>

        <!-- 시세 정보 -->
        ${prices.length > 0 ? `
        <p style="color:#9AA0A6; font-size:9px; margin:0 0 8px 0;">시세 정보</p>
        <div style="display:flex; gap:8px; margin-bottom:20px;">
          ${prices.map(p => `
            <div style="flex:1; background:#1C1C1E; border:1px solid #2C2C2E; border-radius:8px; padding:12px;">
              <p style="color:#9AA0A6; font-size:8px; margin:0 0 4px 0;">${p.label}</p>
              <p style="color:${p.color}; font-size:12px; font-weight:700; margin:0;">${p.value}</p>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- 건물 스펙 -->
        ${specs.length > 0 ? `
        <p style="color:#9AA0A6; font-size:9px; margin:0 0 8px 0;">건물 스펙</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:20px;">
          ${specs.map(s => `
            <div style="background:#1C1C1E; border:1px solid #2C2C2E; border-radius:8px; padding:12px;">
              <p style="color:#9AA0A6; font-size:8px; margin:0 0 4px 0;">${s.label}</p>
              <p style="color:white; font-size:12px; font-weight:600; margin:0;">${s.value}</p>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- 시세 동향 -->
        ${d.price_trend ? `
        <p style="color:#9AA0A6; font-size:9px; margin:0 0 8px 0;">시세 동향</p>
        <div style="background:#1C1C1E; border:1px solid #2C2C2E; border-radius:8px; padding:14px; margin-bottom:20px;">
          <p style="color:white; font-size:9px; line-height:1.7; margin:0;">${d.price_trend}</p>
        </div>
        ` : ''}

        <!-- AI 분석 요약 -->
        ${d.analysis_summary ? `
        <p style="color:#9AA0A6; font-size:9px; margin:0 0 8px 0;">AI 분석 요약</p>
        <div style="background:#1C1C1E; border:1px solid #2C2C2E; border-radius:8px; padding:14px; margin-bottom:20px;">
          <p style="color:white; font-size:9px; line-height:1.7; margin:0;">${d.analysis_summary}</p>
        </div>
        ` : ''}

        <!-- Footer -->
        <div style="border-top:1px solid #2C2C2E; padding-top:12px; display:flex; justify-content:space-between;">
          <span style="color:#9AA0A6; font-size:8px;">※ AI 기반 추정 정보이며 실제 시세와 다를 수 있습니다.</span>
          <span style="color:#9AA0A6; font-size:8px;">SnapEstate</span>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    await html2pdf()
      .set({
        margin: 0,
        filename: `snapestate_${d.building_name || 'report'}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#121214' },
        jsPDF: { unit: 'px', format: [595, 1200], orientation: 'portrait' },
      })
      .from(container.firstElementChild)
      .save();

    document.body.removeChild(container);
    toast.success('PDF가 다운로드되었습니다');
  } catch (e) {
    console.error(e);
    toast.error('PDF 생성에 실패했습니다');
  }
}