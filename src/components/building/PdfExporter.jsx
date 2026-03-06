import { toast } from "sonner";

export async function exportToPdf(analysisData) {
  if (!analysisData) return;

  try {
    const html2pdf = (await import('html2pdf.js')).default;
    const d = analysisData;
    const dateStr = new Date().toLocaleDateString('ko-KR');

    const prices = [
      d.estimated_price_sale    ? { label: '매매가', value: d.estimated_price_sale,    color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' } : null,
      d.estimated_price_rent    ? { label: '전세가', value: d.estimated_price_rent,    color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' } : null,
      d.estimated_price_monthly ? { label: '월세',   value: d.estimated_price_monthly, color: '#92400E', bg: '#FFFBEB', border: '#FDE68A' } : null,
    ].filter(Boolean);

    const specs = [
      d.building_type         ? { label: '건물 유형', value: d.building_type,                       icon: '🏢' } : null,
      d.estimated_year        ? { label: '건축연도',  value: `${d.estimated_year}년`,                icon: '📅' } : null,
      d.estimated_floors      ? { label: '층수',      value: `${d.estimated_floors}층`,              icon: '📐' } : null,
      d.estimated_area_pyeong ? { label: '면적',      value: `${d.estimated_area_pyeong}평`,         icon: '📏' } : null,
    ].filter(Boolean);

    const confidenceBg    = d.confidence === '높음' ? '#ECFDF5' : d.confidence === '보통' ? '#FFFBEB' : '#FEF2F2';
    const confidenceColor = d.confidence === '높음' ? '#065F46' : d.confidence === '보통' ? '#92400E' : '#991B1B';
    const confidenceBorder= d.confidence === '높음' ? '#A7F3D0' : d.confidence === '보통' ? '#FDE68A' : '#FECACA';

    const html = `
      <div style="
        background: #FFFFFF;
        color: #1A1A1A;
        font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif;
        width: 595px;
        box-sizing: border-box;
      ">
        <!-- Header Bar -->
        <div style="background:#1E293B; padding:20px 40px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="background:#3B82F6; width:28px; height:28px; border-radius:6px; display:flex; align-items:center; justify-content:center;">
              <span style="color:white; font-size:14px;">🏠</span>
            </div>
            <span style="color:#FFFFFF; font-size:16px; font-weight:700; letter-spacing:-0.3px;">SnapEstate</span>
          </div>
          <div style="text-align:right;">
            <p style="color:#94A3B8; font-size:9px; margin:0 0 2px 0;">분석 보고서</p>
            <p style="color:#CBD5E1; font-size:10px; margin:0; font-weight:500;">${dateStr}</p>
          </div>
        </div>

        <!-- Main Content -->
        <div style="padding:32px 40px;">

          <!-- 건물 이미지 + 기본 정보 -->
          <div style="display:flex; gap:20px; margin-bottom:28px; align-items:flex-start;">
            ${d.image_url ? `
            <div style="flex-shrink:0; width:180px; height:140px; border-radius:10px; overflow:hidden; border:1px solid #E2E8F0;">
              <img src="${d.image_url}" style="width:100%; height:100%; object-fit:cover;" crossorigin="anonymous" />
            </div>
            ` : ''}
            <div style="flex:1; padding-top:4px;">
              <h1 style="font-size:20px; font-weight:700; margin:0 0 8px 0; color:#0F172A; line-height:1.3;">${d.building_name || '건물 분석 결과'}</h1>
              ${d.address ? `
              <div style="display:flex; align-items:flex-start; gap:5px; margin-bottom:12px;">
                <span style="color:#64748B; font-size:11px; margin-top:1px;">📍</span>
                <span style="color:#475569; font-size:11px; line-height:1.5;">${d.address}</span>
              </div>
              ` : ''}
              ${d.confidence ? `
              <span style="background:${confidenceBg}; color:${confidenceColor}; border:1px solid ${confidenceBorder}; padding:4px 12px; border-radius:20px; font-size:10px; font-weight:600;">
                신뢰도 ${d.confidence}
              </span>
              ` : ''}
              ${d.district ? `<p style="color:#94A3B8; font-size:10px; margin:10px 0 0 0;">${d.district}</p>` : ''}
            </div>
          </div>

          <!-- 구분선 -->
          <div style="border-top:2px solid #F1F5F9; margin-bottom:24px;"></div>

          <!-- 시세 정보 -->
          ${prices.length > 0 ? `
          <div style="margin-bottom:28px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
              <div style="width:3px; height:16px; background:#3B82F6; border-radius:2px;"></div>
              <p style="color:#0F172A; font-size:13px; font-weight:700; margin:0;">시세 정보</p>
              ${d.price_type ? `<span style="background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; padding:2px 8px; border-radius:10px; font-size:9px; font-weight:500;">${d.price_type}</span>` : ''}
            </div>
            <div style="display:flex; gap:10px;">
              ${prices.map((p, i) => `
                <div style="flex:1; background:${p.bg}; border:1.5px solid ${p.border}; border-radius:10px; padding:16px 14px;">
                  <p style="color:${p.color}; font-size:10px; font-weight:600; margin:0 0 6px 0; opacity:0.8;">${p.label}</p>
                  <p style="color:${p.color}; font-size:${i === 0 ? '15px' : '13px'}; font-weight:700; margin:0; line-height:1.2;">${p.value}</p>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- 건물 스펙 -->
          ${specs.length > 0 ? `
          <div style="margin-bottom:28px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
              <div style="width:3px; height:16px; background:#8B5CF6; border-radius:2px;"></div>
              <p style="color:#0F172A; font-size:13px; font-weight:700; margin:0;">건물 스펙</p>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px;">
              ${specs.map(s => `
                <div style="width:calc(50% - 5px); box-sizing:border-box; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:14px 16px; display:flex; align-items:center; gap:12px;">
                  <span style="font-size:20px; flex-shrink:0;">${s.icon}</span>
                  <div>
                    <p style="color:#94A3B8; font-size:10px; margin:0 0 3px 0;">${s.label}</p>
                    <p style="color:#0F172A; font-size:13px; font-weight:600; margin:0;">${s.value}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}

          <!-- 시세 동향 -->
          ${d.price_trend ? `
          <div style="margin-bottom:28px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
              <div style="width:3px; height:16px; background:#10B981; border-radius:2px;"></div>
              <p style="color:#0F172A; font-size:13px; font-weight:700; margin:0;">시세 동향</p>
            </div>
            <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-left:3px solid #10B981; border-radius:8px; padding:16px 18px;">
              <p style="color:#064E3B; font-size:11px; line-height:1.8; margin:0;">${d.price_trend}</p>
            </div>
          </div>
          ` : ''}

          <!-- AI 분석 요약 -->
          ${d.analysis_summary ? `
          <div style="margin-bottom:28px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px;">
              <div style="width:3px; height:16px; background:#F59E0B; border-radius:2px;"></div>
              <p style="color:#0F172A; font-size:13px; font-weight:700; margin:0;">AI 분석 요약</p>
              <span style="background:#FEF3C7; color:#92400E; border:1px solid #FDE68A; padding:2px 8px; border-radius:10px; font-size:9px; font-weight:500;">AI 추정</span>
            </div>
            <div style="background:#FFFBEB; border:1px solid #FDE68A; border-left:3px solid #F59E0B; border-radius:8px; padding:16px 18px;">
              <p style="color:#451A03; font-size:11px; line-height:1.8; margin:0;">${d.analysis_summary}</p>
            </div>
          </div>
          ` : ''}

          <!-- 건물 특징 태그 -->
          ${d.building_features && d.building_features.length > 0 ? `
          <div style="margin-bottom:28px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
              <div style="width:3px; height:16px; background:#6366F1; border-radius:2px;"></div>
              <p style="color:#0F172A; font-size:13px; font-weight:700; margin:0;">건물 특징</p>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
              ${d.building_features.map(f => `
                <span style="background:#EEF2FF; color:#3730A3; border:1px solid #C7D2FE; padding:5px 12px; border-radius:20px; font-size:10px; font-weight:500;">${f}</span>
              `).join('')}
            </div>
          </div>
          ` : ''}

        </div>

        <!-- Footer -->
        <div style="background:#F8FAFC; border-top:1px solid #E2E8F0; padding:16px 40px; display:flex; justify-content:space-between; align-items:center;">
          <span style="color:#94A3B8; font-size:9px;">※ AI 기반 추정 정보이며 실제 시세와 다를 수 있습니다.</span>
          <span style="color:#3B82F6; font-size:10px; font-weight:700;">SnapEstate</span>
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
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' },
        jsPDF: { unit: 'px', format: [595, 1400], orientation: 'portrait' },
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