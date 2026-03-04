import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import puppeteer from 'npm:puppeteer@22.0.0';

Deno.serve(async (req) => {
  let browser;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json();
    if (!id) return Response.json({ error: 'ID가 필요합니다.' }, { status: 400 });

    const d = await base44.entities.BuildingAnalysis.get(id);
    if (!d) return Response.json({ error: '데이터를 찾을 수 없습니다.' }, { status: 404 });

    // HTML 생성
    const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; background: #121214; color: #fff; }
    .container { width: 210mm; height: 297mm; padding: 20mm; background: #121214; }
    .header { background: #1c1c1e; border-bottom: 1px solid #2c2c2e; padding: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .logo { color: #4D96FF; font-size: 18px; font-weight: bold; }
    .date { color: #9aa0a6; font-size: 12px; }
    .title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
    .address { color: #9aa0a6; font-size: 14px; margin-bottom: 15px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; margin-bottom: 15px; }
    .badge-high { background: #34d399; color: #1c1c1e; }
    .badge-medium { background: #fbbf24; color: #1c1c1e; }
    .badge-low { background: #ef4444; color: #fff; }
    .section-title { color: #9aa0a6; font-size: 12px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; border-top: 1px solid #2c2c2e; padding-top: 15px; }
    .price-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
    .price-card { background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px; }
    .price-label { color: #9aa0a6; font-size: 11px; margin-bottom: 5px; }
    .price-value { color: #4D96FF; font-size: 16px; font-weight: bold; }
    .specs-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
    .spec-card { background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px; }
    .spec-label { color: #9aa0a6; font-size: 11px; margin-bottom: 5px; }
    .spec-value { color: #fff; font-size: 14px; font-weight: bold; }
    .summary-box { background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 15px; font-size: 13px; line-height: 1.6; color: #fff; margin-bottom: 20px; }
    .footer { color: #9aa0a6; font-size: 11px; border-top: 1px solid #2c2c2e; padding-top: 15px; margin-top: 20px; }
    img { max-width: 100%; margin-bottom: 15px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">SnapEstate</div>
      <div class="date">${new Date().toLocaleDateString('ko-KR')}</div>
    </div>

    <div class="title">${d.building_name || '건물 분석 결과'}</div>
    ${d.address ? `<div class="address">📍 ${d.address}</div>` : ''}
    ${d.confidence ? `<div class="badge badge-${d.confidence === '높음' ? 'high' : d.confidence === '보통' ? 'medium' : 'low'}">신뢰도 ${d.confidence}</div>` : ''}

    ${d.image_url ? `<img src="${d.image_url}" alt="건물 이미지" style="max-height: 200px; object-fit: cover;">` : ''}

    <div class="section-title">시세 정보</div>
    <div class="price-grid">
      ${d.estimated_price_sale ? `<div class="price-card"><div class="price-label">매매가</div><div class="price-value">${d.estimated_price_sale}</div></div>` : ''}
      ${d.estimated_price_rent ? `<div class="price-card"><div class="price-label">전세가</div><div class="price-value">${d.estimated_price_rent}</div></div>` : ''}
      ${d.estimated_price_monthly ? `<div class="price-card"><div class="price-label">월세</div><div class="price-value">${d.estimated_price_monthly}</div></div>` : ''}
    </div>

    <div class="section-title">건물 스펙</div>
    <div class="specs-grid">
      ${d.building_type ? `<div class="spec-card"><div class="spec-label">건물 유형</div><div class="spec-value">${d.building_type}</div></div>` : ''}
      ${d.estimated_year ? `<div class="spec-card"><div class="spec-label">건축연도</div><div class="spec-value">${d.estimated_year}</div></div>` : ''}
      ${d.estimated_floors ? `<div class="spec-card"><div class="spec-label">층수</div><div class="spec-value">${d.estimated_floors}층</div></div>` : ''}
      ${d.estimated_area_pyeong ? `<div class="spec-card"><div class="spec-label">면적</div><div class="spec-value">${d.estimated_area_pyeong}평</div></div>` : ''}
    </div>

    ${d.price_trend ? `
      <div class="section-title">시세 동향</div>
      <div class="summary-box">${d.price_trend}</div>
    ` : ''}

    ${d.analysis_summary ? `
      <div class="section-title">AI 분석 요약</div>
      <div class="summary-box">${d.analysis_summary}</div>
    ` : ''}

    <div class="footer">※ AI 기반 추정 정보이며 실제 시세와 다를 수 있습니다.</div>
  </div>
</body>
</html>
    `;

    // Puppeteer로 PDF 생성
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', margin: { top: 0, right: 0, bottom: 0, left: 0 } });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="snapestate_report.pdf"',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
});