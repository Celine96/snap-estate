import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@2.5.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json();
    if (!id) return Response.json({ error: 'ID가 필요합니다.' }, { status: 400 });

    const d = await base44.entities.BuildingAnalysis.get(id);
    if (!d) return Response.json({ error: '데이터를 찾을 수 없습니다.' }, { status: 404 });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Noto Sans KR', sans-serif; background: #121214; color: white; padding: 20px; }
          .container { background: #121214; width: 210mm; margin: 0 auto; padding: 20px; }
          
          .header { background: #1c1c1e; border-bottom: 1px solid #2c2c2e; padding: 15px 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .logo { color: #4d96ff; font-size: 18px; font-weight: bold; }
          .date { color: #9aa0a6; font-size: 10px; }
          
          .building-header { margin-bottom: 20px; }
          .building-name { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
          .address { color: #9aa0a6; font-size: 12px; margin-bottom: 12px; }
          
          .confidence { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-bottom: 15px; }
          .confidence.high { background: #34d399; color: #1c1c1e; }
          .confidence.medium { background: #fbbf24; color: #1c1c1e; }
          .confidence.low { background: #ef4444; color: white; }
          
          .section { margin-bottom: 20px; }
          .section-title { color: #9aa0a6; font-size: 11px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; }
          
          .price-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 15px; }
          .price-card { background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px; }
          .price-label { color: #9aa0a6; font-size: 9px; margin-bottom: 6px; }
          .price-value { font-size: 13px; font-weight: bold; color: white; }
          .price-value.accent { color: #4d96ff; }
          
          .specs-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px; }
          .spec-card { background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px; }
          .spec-label { color: #9aa0a6; font-size: 9px; margin-bottom: 6px; }
          .spec-value { font-size: 12px; font-weight: bold; color: white; }
          
          .content-box { background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px; margin-bottom: 15px; font-size: 11px; color: white; line-height: 1.6; }
          
          .divider { height: 1px; background: #2c2c2e; margin: 15px 0; }
          
          .footer { border-top: 1px solid #2c2c2e; padding-top: 12px; margin-top: 20px; display: flex; justify-content: space-between; color: #9aa0a6; font-size: 9px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="logo">SnapEstate</span>
            <span class="date">${new Date().toLocaleDateString('ko-KR')}</span>
          </div>
          
          <div class="building-header">
            <div class="building-name">${d.building_name || '건물 분석 결과'}</div>
            ${d.address ? `<div class="address">${d.address}</div>` : ''}
            ${d.confidence ? `<div class="confidence ${d.confidence === '높음' ? 'high' : d.confidence === '보통' ? 'medium' : 'low'}">신뢰도 ${d.confidence}</div>` : ''}
          </div>
          
          ${d.estimated_price_sale || d.estimated_price_rent || d.estimated_price_monthly ? `
            <div class="section">
              <div class="section-title">시세 정보</div>
              <div class="price-grid">
                ${d.estimated_price_sale ? `<div class="price-card"><div class="price-label">매매가</div><div class="price-value accent">${d.estimated_price_sale}</div></div>` : ''}
                ${d.estimated_price_rent ? `<div class="price-card"><div class="price-label">전세가</div><div class="price-value">${d.estimated_price_rent}</div></div>` : ''}
                ${d.estimated_price_monthly ? `<div class="price-card"><div class="price-label">월세</div><div class="price-value">${d.estimated_price_monthly}</div></div>` : ''}
              </div>
            </div>
          ` : ''}
          
          ${d.building_type || d.estimated_year || d.estimated_floors || d.estimated_area_pyeong ? `
            <div class="section">
              <div class="section-title">건물 스펙</div>
              <div class="specs-grid">
                ${d.building_type ? `<div class="spec-card"><div class="spec-label">건물 유형</div><div class="spec-value">${d.building_type}</div></div>` : ''}
                ${d.estimated_year ? `<div class="spec-card"><div class="spec-label">건축연도</div><div class="spec-value">${d.estimated_year}년</div></div>` : ''}
                ${d.estimated_floors ? `<div class="spec-card"><div class="spec-label">층수</div><div class="spec-value">${d.estimated_floors}층</div></div>` : ''}
                ${d.estimated_area_pyeong ? `<div class="spec-card"><div class="spec-label">면적</div><div class="spec-value">${d.estimated_area_pyeong}평</div></div>` : ''}
              </div>
            </div>
          ` : ''}
          
          ${d.price_trend ? `
            <div class="section">
              <div class="section-title">시세 동향</div>
              <div class="content-box">${d.price_trend}</div>
            </div>
          ` : ''}
          
          ${d.analysis_summary ? `
            <div class="section">
              <div class="section-title">AI 분석 요약</div>
              <div class="content-box">${d.analysis_summary}</div>
            </div>
          ` : ''}
          
          <div class="footer">
            <span>※ AI 기반 추정 정보이며 실제 시세와 다를 수 있습니다.</span>
            <span>SnapEstate</span>
          </div>
        </div>
      </body>
      </html>
    `;

    const options = {
      margin: 0,
      filename: 'snapestate_report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };

    const canvas = await html2pdf().set(options).from(html).toPdf().output('canvas');
    const imgData = canvas.toDataURL('image/png');
    const pdf = new html2pdf().set(options).from(html).toPdf();
    const pdfBytes = pdf.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="snapestate_report.pdf"',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});