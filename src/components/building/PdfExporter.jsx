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
      d.building_type         ? { label: '건물 유형', value: d.building_type }                      : null,
      d.estimated_year        ? { label: '건축연도',  value: `${d.estimated_year}년` }               : null,
      d.estimated_floors      ? { label: '층수',      value: `${d.estimated_floors}층` }             : null,
      d.estimated_area_pyeong ? { label: '면적',      value: `${d.estimated_area_pyeong}평` }        : null,
    ].filter(Boolean);

    const confidenceBg     = d.confidence === '높음' ? '#ECFDF5' : d.confidence === '보통' ? '#FFFBEB' : '#FEF2F2';
    const confidenceColor  = d.confidence === '높음' ? '#065F46' : d.confidence === '보통' ? '#92400E' : '#991B1B';
    const confidenceBorder = d.confidence === '높음' ? '#A7F3D0' : d.confidence === '보통' ? '#FDE68A' : '#FECACA';

    // 시세 카드 HTML (table 기반으로 안전하게)
    const priceCardsHtml = prices.map(p => `
      <td style="padding:4px;">
        <div style="background:${p.bg}; border:1.5px solid ${p.border}; border-radius:10px; padding:14px;">
          <div style="color:${p.color}; font-size:10px; font-weight:600; margin-bottom:6px; opacity:0.8;">${p.label}</div>
          <div style="color:${p.color}; font-size:14px; font-weight:700;">${p.value}</div>
        </div>
      </td>
    `).join('');

    // 스펙 카드 HTML (table 기반 2열)
    const specRows = [];
    for (let i = 0; i < specs.length; i += 2) {
      const left = specs[i];
      const right = specs[i + 1];
      specRows.push(`
        <tr>
          <td style="padding:4px; width:50%;">
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:14px;">
              <div style="color:#94A3B8; font-size:10px; margin-bottom:4px;">${left.label}</div>
              <div style="color:#0F172A; font-size:13px; font-weight:600;">${left.value}</div>
            </div>
          </td>
          <td style="padding:4px; width:50%;">
            ${right ? `
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:14px;">
              <div style="color:#94A3B8; font-size:10px; margin-bottom:4px;">${right.label}</div>
              <div style="color:#0F172A; font-size:13px; font-weight:600;">${right.value}</div>
            </div>
            ` : ''}
          </td>
        </tr>
      `);
    }

    const html = `
      <div style="
        background: #FFFFFF;
        color: #1A1A1A;
        font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif;
        width: 595px;
        box-sizing: border-box;
      ">
        <!-- 헤더 -->
        <div style="background:#1E293B; padding:18px 36px; overflow:hidden;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <span style="color:#FFFFFF; font-size:17px; font-weight:700;">SnapEstate</span>
                <span style="color:#94A3B8; font-size:10px; margin-left:10px;">AI 건물 분석 보고서</span>
              </td>
              <td style="text-align:right; vertical-align:middle;">
                <span style="color:#CBD5E1; font-size:10px;">${dateStr}</span>
              </td>
            </tr>
          </table>
        </div>

        <!-- 건물 이미지 -->
        ${d.image_url ? `
        <div style="overflow:hidden; height:180px;">
          <img src="${d.image_url}" style="width:100%; height:180px; object-fit:cover; display:block;" crossorigin="anonymous" />
        </div>
        ` : ''}

        <!-- 본문 -->
        <div style="padding:28px 36px;">

          <!-- 건물명 + 주소 -->
          <div style="margin-bottom:20px;">
            <div style="font-size:20px; font-weight:700; color:#0F172A; margin-bottom:8px; line-height:1.3;">${d.building_name || '건물 분석 결과'}</div>
            ${d.address ? `<div style="color:#475569; font-size:11px; margin-bottom:10px; line-height:1.5;">📍 ${d.address}</div>` : ''}
            ${d.confidence ? `
            <span style="display:inline-block; background:${confidenceBg}; color:${confidenceColor}; border:1px solid ${confidenceBorder}; padding:4px 12px; border-radius:20px; font-size:10px; font-weight:600;">
              신뢰도 ${d.confidence}
            </span>
            ` : ''}
          </div>

          <!-- 구분선 -->
          <div style="border-top:2px solid #F1F5F9; margin-bottom:22px;"></div>

          <!-- 시세 정보 -->
          ${prices.length > 0 ? `
          <div style="margin-bottom:24px;">
            <div style="margin-bottom:12px; overflow:hidden;">
              <div style="display:inline-block; width:3px; height:15px; background:#3B82F6; border-radius:2px; vertical-align:middle; margin-right:8px;"></div>
              <span style="font-size:13px; font-weight:700; color:#0F172A; vertical-align:middle;">시세 정보</span>
              ${d.price_type ? `<span style="margin-left:8px; background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE; padding:2px 8px; border-radius:10px; font-size:9px; vertical-align:middle;">${d.price_type}</span>` : ''}
            </div>
            <table style="width:100%; border-collapse:collapse;">
              <tr>${priceCardsHtml}</tr>
            </table>
          </div>
          ` : ''}

          <!-- 건물 스펙 -->
          ${specs.length > 0 ? `
          <div style="margin-bottom:24px;">
            <div style="margin-bottom:12px; overflow:hidden;">
              <div style="display:inline-block; width:3px; height:15px; background:#8B5CF6; border-radius:2px; vertical-align:middle; margin-right:8px;"></div>
              <span style="font-size:13px; font-weight:700; color:#0F172A; vertical-align:middle;">건물 스펙</span>
            </div>
            <table style="width:100%; border-collapse:collapse;">
              ${specRows.join('')}
            </table>
          </div>
          ` : ''}

          <!-- 시세 동향 -->
          ${d.price_trend ? `
          <div style="margin-bottom:24px;">
            <div style="margin-bottom:12px;">
              <div style="display:inline-block; width:3px; height:15px; background:#10B981; border-radius:2px; vertical-align:middle; margin-right:8px;"></div>
              <span style="font-size:13px; font-weight:700; color:#0F172A; vertical-align:middle;">시세 동향</span>
            </div>
            <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-left:3px solid #10B981; border-radius:8px; padding:14px 16px;">
              <div style="color:#064E3B; font-size:11px; line-height:1.8;">${d.price_trend}</div>
            </div>
          </div>
          ` : ''}

          <!-- AI 분석 요약 -->
          ${d.analysis_summary ? `
          <div style="margin-bottom:24px;">
            <div style="margin-bottom:12px;">
              <div style="display:inline-block; width:3px; height:15px; background:#F59E0B; border-radius:2px; vertical-align:middle; margin-right:8px;"></div>
              <span style="font-size:13px; font-weight:700; color:#0F172A; vertical-align:middle;">AI 분석 요약</span>
            </div>
            <div style="background:#FFFBEB; border:1px solid #FDE68A; border-left:3px solid #F59E0B; border-radius:8px; padding:14px 16px;">
              <div style="color:#451A03; font-size:11px; line-height:1.8;">${d.analysis_summary}</div>
            </div>
          </div>
          ` : ''}

          <!-- 건물 특징 태그 -->
          ${d.building_features && d.building_features.length > 0 ? `
          <div style="margin-bottom:24px;">
            <div style="margin-bottom:12px;">
              <div style="display:inline-block; width:3px; height:15px; background:#6366F1; border-radius:2px; vertical-align:middle; margin-right:8px;"></div>
              <span style="font-size:13px; font-weight:700; color:#0F172A; vertical-align:middle;">건물 특징</span>
            </div>
            <div>
              ${d.building_features.map(f => `
                <span style="display:inline-block; background:#EEF2FF; color:#3730A3; border:1px solid #C7D2FE; padding:4px 10px; border-radius:20px; font-size:10px; font-weight:500; margin:3px 4px 3px 0;">${f}</span>
              `).join('')}
            </div>
          </div>
          ` : ''}

        </div>

        <!-- 푸터 -->
        <div style="background:#F8FAFC; border-top:1px solid #E2E8F0; padding:14px 36px; overflow:hidden;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="color:#94A3B8; font-size:8.5px; vertical-align:middle;">※ AI 기반 추정 정보이며 실제 시세와 다를 수 있습니다.</td>
              <td style="text-align:right; color:#3B82F6; font-size:11px; font-weight:700; vertical-align:middle;">SnapEstate</td>
            </tr>
          </table>
        </div>
      </div>
    `;

    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    await html2pdf()
      .set({
        margin: 0,
        filename: `snapestate_${d.building_name || 'report'}.pdf`,
        image: { type: 'jpeg', quality: 0.97 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#FFFFFF',
          logging: false,
          allowTaint: false,
        },
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