import { toast } from "sonner";

// ── 숫자 파싱: "12억 5천만원" → 125000 (만원 단위)
function parseKoreanPrice(str) {
  if (!str) return null;
  let val = 0;
  const uk  = str.match(/(\d+[\d,.]*)억/);
  const man = str.match(/(\d+[\d,.]*)천?만/);
  if (uk)  val += parseFloat(uk[1].replace(/,/g, ''))  * 10000;
  if (man) {
    const m = str.match(/(\d+[\d,.]*)천만/);
    if (m) val += parseFloat(m[1].replace(/,/g, '')) * 1000;
    else val += parseFloat(man[1].replace(/,/g, ''));
  }
  return val > 0 ? val : null;
}

// ── 전세가율 계산
function calcJeonseRatio(saleStr, rentStr) {
  const sale = parseKoreanPrice(saleStr);
  const rent = parseKoreanPrice(rentStr);
  if (!sale || !rent || sale === 0) return null;
  return Math.round((rent / sale) * 100);
}

// ── 투자 시그널
function getInvestSignal(ratio) {
  if (ratio === null) return null;
  if (ratio >= 70) return { text: '전세가율 높음 — 투자 주의', bg: '#FEF2F2', border: '#FECACA', color: '#991B1B', icon: '⚠️' };
  if (ratio >= 50) return { text: '전세가율 적정 — 안정적 투자 가능', bg: '#ECFDF5', border: '#A7F3D0', color: '#065F46', icon: '✅' };
  return { text: '전세가율 낮음 — 매매가 대비 임대 수익 주의', bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', icon: '⚡' };
}

export async function exportToPdf(analysisData) {
  if (!analysisData) return;

  try {
    const html2pdf = (await import('html2pdf.js')).default;
    const d = analysisData;
    const dateStr = new Date().toLocaleDateString('ko-KR');

    const prices = [
      d.estimated_price_sale    ? { label: '매매가', value: d.estimated_price_sale,    color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' } : null,
      d.estimated_price_rent    ? { label: '전세가', value: d.estimated_price_rent,    color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' } : null,
      d.estimated_price_monthly ? { label: '월세',   value: d.estimated_price_monthly, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' } : null,
    ].filter(Boolean);

    const specs = [
      d.building_type         ? { label: '건물 유형', value: d.building_type }               : null,
      d.estimated_year        ? { label: '건축연도',  value: `${d.estimated_year}년` }         : null,
      d.estimated_floors      ? { label: '층수',      value: `${d.estimated_floors}층` }       : null,
      d.estimated_area_pyeong ? { label: '연면적',    value: `${d.estimated_area_pyeong}평` }  : null,
    ].filter(Boolean);

    const jeonseRatio = calcJeonseRatio(d.estimated_price_sale, d.estimated_price_rent);
    const signal = getInvestSignal(jeonseRatio);

    const confidenceBg     = d.confidence === '높음' ? '#ECFDF5' : d.confidence === '보통' ? '#FFFBEB' : '#FEF2F2';
    const confidenceColor  = d.confidence === '높음' ? '#065F46' : d.confidence === '보통' ? '#92400E' : '#991B1B';
    const confidenceBorder = d.confidence === '높음' ? '#A7F3D0' : d.confidence === '보통' ? '#FDE68A' : '#FECACA';
    const confidenceDot    = d.confidence === '높음' ? '#10B981' : d.confidence === '보통' ? '#F59E0B' : '#EF4444';
    const isLowConfidence  = d.confidence === '낮음';

    // 시세 카드 (table 기반)
    const priceCardsHtml = prices.map(p => `
      <td style="padding:5px; width:${Math.floor(100/prices.length)}%;">
        <div style="background:${p.bg}; border:1.5px solid ${p.border}; border-radius:10px; padding:16px 14px;">
          <div style="color:${p.color}; font-size:10px; font-weight:600; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">${p.label}</div>
          <div style="color:${p.color}; font-size:15px; font-weight:800; line-height:1.2;">${p.value}</div>
        </div>
      </td>
    `).join('');

    // 투자 지표 카드
    const investItems = [];
    if (jeonseRatio !== null) {
      const ratioColor = jeonseRatio >= 70 ? '#991B1B' : jeonseRatio >= 50 ? '#065F46' : '#92400E';
      const ratioBg    = jeonseRatio >= 70 ? '#FEF2F2' : jeonseRatio >= 50 ? '#ECFDF5' : '#FFFBEB';
      investItems.push({ label: '전세가율', value: `${jeonseRatio}%`, sub: jeonseRatio >= 70 ? '고위험' : jeonseRatio >= 50 ? '안정' : '주의', color: ratioColor, bg: ratioBg });
    }
    if (d.estimated_price_sale && d.estimated_area_pyeong) {
      const sale = parseKoreanPrice(d.estimated_price_sale);
      const area = parseFloat(String(d.estimated_area_pyeong).replace(/[^0-9.]/g, ''));
      if (sale && area) {
        const perPyeong = Math.round(sale / area);
        investItems.push({ label: '평당 매매가', value: `${perPyeong.toLocaleString()}만`, sub: '원/평', color: '#1D4ED8', bg: '#EFF6FF' });
      }
    }
    if (d.district) investItems.push({ label: '행정구역', value: d.district, sub: '', color: '#374151', bg: '#F9FAFB' });

    // 스펙 카드 (2열)
    const specRows = [];
    for (let i = 0; i < specs.length; i += 2) {
      const left = specs[i];
      const right = specs[i + 1];
      specRows.push(`
        <tr>
          <td style="padding:5px; width:50%;">
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:14px 16px;">
              <div style="color:#94A3B8; font-size:9.5px; margin-bottom:5px; font-weight:500;">${left.label}</div>
              <div style="color:#0F172A; font-size:13px; font-weight:600;">${left.value}</div>
            </div>
          </td>
          <td style="padding:5px; width:50%;">
            ${right ? `
            <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:14px 16px;">
              <div style="color:#94A3B8; font-size:9.5px; margin-bottom:5px; font-weight:500;">${right.label}</div>
              <div style="color:#0F172A; font-size:13px; font-weight:600;">${right.value}</div>
            </div>
            ` : ''}
          </td>
        </tr>
      `);
    }

    // 투자 지표 행 (3열)
    const investCardsHtml = investItems.map(item => `
      <td style="padding:5px;">
        <div style="background:${item.bg}; border:1px solid ${item.bg === '#F9FAFB' ? '#E5E7EB' : item.bg}; border-radius:8px; padding:14px 12px; text-align:center;">
          <div style="color:#94A3B8; font-size:9px; font-weight:600; margin-bottom:6px; text-transform:uppercase;">${item.label}</div>
          <div style="color:${item.color}; font-size:16px; font-weight:800;">${item.value}</div>
          ${item.sub ? `<div style="color:${item.color}; font-size:9px; margin-top:3px; opacity:0.8;">${item.sub}</div>` : ''}
        </div>
      </td>
    `).join('');

    const html = `
      <div style="
        background:#FFFFFF;
        color:#1A1A1A;
        font-family:'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;
        width:595px;
        height:842px;
        box-sizing:border-box;
        overflow:hidden;
      ">

        <!-- ① 헤더 (다크 + Summary Bar) -->
        <div style="background:#0F172A; padding:0;">
          <!-- 브랜드 + Summary Bar (한 줄) -->
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="padding:10px 16px 10px 28px; border-right:1px solid rgba(255,255,255,0.06); vertical-align:middle; width:22%;">
                <div style="color:#FFFFFF; font-size:14px; font-weight:800;">SnapEstate</div>
                <div style="color:#475569; font-size:8px; margin-top:1px;">${dateStr}</div>
              </td>
              <td style="padding:10px 16px; border-right:1px solid rgba(255,255,255,0.06); vertical-align:middle; width:26%;">
                <div style="color:#64748B; font-size:7.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:3px;">매매 추정가</div>
                <div style="color:#FFFFFF; font-size:14px; font-weight:800;">${d.estimated_price_sale || '—'}</div>
                ${d.price_type ? `<div style="color:#3B82F6; font-size:7.5px; margin-top:2px;">${d.price_type}</div>` : ''}
              </td>
              <td style="padding:10px 16px; border-right:1px solid rgba(255,255,255,0.06); vertical-align:middle; width:26%;">
                <div style="color:#64748B; font-size:7.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:3px;">전세가율</div>
                <div style="color:${jeonseRatio !== null ? (jeonseRatio >= 70 ? '#F87171' : jeonseRatio >= 50 ? '#34D399' : '#FCD34D') : '#475569'}; font-size:14px; font-weight:800;">
                  ${jeonseRatio !== null ? jeonseRatio + '%' : '—'}
                </div>
                ${jeonseRatio !== null ? `<div style="color:#475569; font-size:7.5px; margin-top:2px;">${jeonseRatio >= 70 ? '고위험' : jeonseRatio >= 50 ? '안정' : '주의'}</div>` : ''}
              </td>
              <td style="padding:10px 28px 10px 16px; vertical-align:middle; width:26%;">
                <div style="color:#64748B; font-size:7.5px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:3px;">분석 신뢰도</div>
                <div style="color:#FFFFFF; font-size:14px; font-weight:800;">
                  <span style="display:inline-block; width:5px; height:5px; background:${confidenceDot}; border-radius:50%; vertical-align:middle; margin-right:4px;"></span>
                  ${d.confidence || '—'}
                </div>
                <div style="color:#475569; font-size:7.5px; margin-top:2px;">${d.confidence === '높음' ? 'AI 고신뢰' : d.confidence === '보통' ? '참고 수준' : '검증 필요'}</div>
              </td>
            </tr>
          </table>
        </div>

        <!-- ② 신뢰도 낮음 경고 배너 -->
        ${isLowConfidence ? `
        <div style="background:#FEF2F2; border-bottom:1.5px solid #FCA5A5; padding:7px 28px;">
          <span style="font-size:9.5px; color:#991B1B; font-weight:700;">⚠️ 신뢰도 낮음 — </span>
          <span style="font-size:9.5px; color:#B91C1C;">위치 정확도가 낮거나 데이터 부족. 추가 검증 후 의사결정하세요.</span>
        </div>
        ` : ''}

        <!-- ③ 건물 이미지 + 건물 ID 블록 (가로 분할) -->
        <table style="width:100%; border-collapse:collapse; border-bottom:1px solid #F1F5F9;">
          <tr>
            ${d.image_url ? `
            <td style="width:160px; vertical-align:top; padding:0;">
              <img src="${d.image_url}" style="width:160px; height:110px; object-fit:cover; display:block;" crossorigin="anonymous" />
            </td>
            ` : ''}
            <td style="vertical-align:middle; padding:14px 20px 14px ${d.image_url ? '20px' : '28px'};">
              <div style="font-size:17px; font-weight:800; color:#0F172A; line-height:1.3; margin-bottom:5px;">${d.building_name || '건물 분석 결과'}</div>
              ${d.address ? `<div style="color:#64748B; font-size:10px; line-height:1.6; margin-bottom:6px;">📍 ${d.address}</div>` : ''}
              <div>
                ${d.confidence ? `<span style="display:inline-block; background:${confidenceBg}; color:${confidenceColor}; border:1px solid ${confidenceBorder}; padding:3px 10px; border-radius:20px; font-size:9px; font-weight:700; margin-right:5px;">신뢰도 ${d.confidence}</span>` : ''}
                ${d.building_type ? `<span style="display:inline-block; background:#F1F5F9; color:#475569; border:1px solid #E2E8F0; padding:3px 10px; border-radius:20px; font-size:9px; font-weight:600;">${d.building_type}</span>` : ''}
              </div>
            </td>
          </tr>
        </table>

        <!-- 본문 -->
        <div style="padding:14px 28px;">

          <!-- ④+⑤ 시세 정보 + 투자 지표 (좌우 2열) -->
          <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
            <tr>
              ${prices.length > 0 ? `
              <td style="vertical-align:top; padding-right:8px; width:55%;">
                ${sectionHeader('시세 정보', '#1D4ED8')}
                <table style="width:100%; border-collapse:collapse; margin-top:8px;">
                  <tr>${priceCardsHtml}</tr>
                </table>
              </td>
              ` : ''}
              ${investItems.length > 0 ? `
              <td style="vertical-align:top; padding-left:${prices.length > 0 ? '8px' : '0'}; width:${prices.length > 0 ? '45%' : '100%'};">
                ${sectionHeader('투자 지표', '#7C3AED')}
                <table style="width:100%; border-collapse:collapse; margin-top:8px;">
                  <tr>${investCardsHtml}</tr>
                </table>
              </td>
              ` : ''}
            </tr>
          </table>

          <!-- ⑥ 투자 시그널 배너 -->
          ${signal ? `
          <div style="margin-bottom:12px; background:${signal.bg}; border:1px solid ${signal.border}; border-left:4px solid ${signal.color}; border-radius:7px; padding:9px 14px;">
            <span style="font-size:10px; color:${signal.color}; font-weight:700;">${signal.icon} ${signal.text}</span>
            ${jeonseRatio !== null ? `<span style="font-size:9.5px; color:${signal.color}; margin-left:6px; opacity:0.75;">(전세가율 ${jeonseRatio}%)</span>` : ''}
          </div>
          ` : ''}

          <!-- ⑦ 건물 스펙 -->
          ${specs.length > 0 ? `
          <div style="margin-bottom:12px;">
            ${sectionHeader('건물 스펙', '#0369A1')}
            <table style="width:100%; border-collapse:collapse; margin-top:8px;">
              ${specRows.join('')}
            </table>
          </div>
          ` : ''}

          <!-- ⑧+⑨ 시세 동향 + AI 분석 요약 (좌우 2열) -->
          ${(d.price_trend || d.analysis_summary) ? `
          <table style="width:100%; border-collapse:collapse; margin-bottom:12px;">
            <tr>
              ${d.price_trend ? `
              <td style="vertical-align:top; padding-right:${d.analysis_summary ? '6px' : '0'}; width:${d.analysis_summary ? '50%' : '100%'};">
                ${sectionHeader('시세 동향', '#059669')}
                <div style="margin-top:8px; background:#F0FDF4; border:1px solid #BBF7D0; border-left:3px solid #059669; border-radius:7px; padding:10px 12px;">
                  <div style="color:#064E3B; font-size:9.5px; line-height:1.7;">${d.price_trend}</div>
                </div>
              </td>
              ` : ''}
              ${d.analysis_summary ? `
              <td style="vertical-align:top; padding-left:${d.price_trend ? '6px' : '0'}; width:${d.price_trend ? '50%' : '100%'};">
                ${sectionHeader('AI 분석 요약', '#D97706')}
                <div style="margin-top:8px; background:#FFFBEB; border:1px solid #FDE68A; border-left:3px solid #D97706; border-radius:7px; padding:10px 12px;">
                  <div style="color:#451A03; font-size:9.5px; line-height:1.7;">${d.analysis_summary}</div>
                </div>
              </td>
              ` : ''}
            </tr>
          </table>
          ` : ''}

          <!-- ⑩ 건물 특징 태그 -->
          ${d.building_features && d.building_features.length > 0 ? `
          <div style="margin-bottom:8px;">
            ${sectionHeader('건물 특징', '#4F46E5')}
            <div style="margin-top:8px;">
              ${d.building_features.map(f => `
                <span style="display:inline-block; background:#EEF2FF; color:#3730A3; border:1px solid #C7D2FE; padding:3px 9px; border-radius:20px; font-size:9.5px; font-weight:500; margin:0 4px 5px 0;">${f}</span>
              `).join('')}
            </div>
          </div>
          ` : ''}

        </div>

        <!-- ⑪ 푸터 -->
        <div style="background:#F8FAFC; border-top:2px solid #E2E8F0; padding:14px 32px;">
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <span style="color:#94A3B8; font-size:8.5px;">※ AI 기반 추정 정보입니다. 실제 시세·투자 결과는 다를 수 있으며, 본 보고서는 참고용입니다.</span>
              </td>
              <td style="text-align:right; vertical-align:middle; white-space:nowrap; padding-left:12px;">
                <span style="color:#3B82F6; font-size:10px; font-weight:800;">SnapEstate</span>
              </td>
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
        jsPDF: { unit: 'px', format: [595, 1500], orientation: 'portrait' },
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

// 섹션 헤더 헬퍼
function sectionHeader(text, color) {
  return `
    <table style="border-collapse:collapse; width:100%;">
      <tr>
        <td style="vertical-align:middle; width:4px; padding-right:10px;">
          <div style="width:4px; height:16px; background:${color}; border-radius:2px;"></div>
        </td>
        <td style="vertical-align:middle;">
          <span style="font-size:12.5px; font-weight:700; color:#0F172A; letter-spacing:-0.2px;">${text}</span>
        </td>
      </tr>
    </table>
  `;
}