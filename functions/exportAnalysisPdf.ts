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

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Colors
    const COLOR_BG = [18, 18, 20];
    const COLOR_CARD = [28, 28, 30];
    const COLOR_BORDER = [44, 44, 46];
    const COLOR_WHITE = [255, 255, 255];
    const COLOR_GRAY = [154, 160, 166];
    const COLOR_ACCENT = [77, 150, 255];
    const COLOR_GREEN = [52, 211, 153];

    const W = 210;
    const H = 297;

    // Background
    doc.setFillColor(...COLOR_BG);
    doc.rect(0, 0, W, H, 'F');

    // Header bar
    doc.setFillColor(...COLOR_CARD);
    doc.rect(0, 0, W, 22, 'F');
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(0, 22, W, 22);

    // Logo / Title
    doc.setTextColor(...COLOR_ACCENT);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('SnapEstate', 14, 14);

    // Date top right
    doc.setTextColor(...COLOR_GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const today = new Date().toLocaleDateString('ko-KR');
    doc.text(today, W - 14, 14, { align: 'right' });

    let y = 32;

    // Building name
    doc.setTextColor(...COLOR_WHITE);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    const name = d.building_name || '건물 분석 결과';
    doc.text(name, 14, y);
    y += 7;

    // Address
    if (d.address) {
      doc.setTextColor(...COLOR_GRAY);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(d.address, 14, y);
      y += 5;
    }

    // Confidence badge
    if (d.confidence) {
      const confColor = d.confidence === '높음' ? COLOR_GREEN : d.confidence === '보통' ? [251, 191, 36] : [239, 68, 68];
      doc.setFillColor(...confColor);
      doc.roundedRect(14, y, 26, 6, 1, 1, 'F');
      doc.setTextColor(...COLOR_BG);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`신뢰도 ${d.confidence}`, 17, y + 4);
      y += 11;
    } else {
      y += 4;
    }

    // Divider
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(14, y, W - 14, y);
    y += 8;

    // === 시세 정보 섹션 ===
    doc.setTextColor(...COLOR_GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('시세 정보', 14, y);
    y += 5;

    const prices = [
      d.estimated_price_sale && { label: '매매가', value: d.estimated_price_sale, highlight: true },
      d.estimated_price_rent && { label: '전세가', value: d.estimated_price_rent },
      d.estimated_price_monthly && { label: '월세', value: d.estimated_price_monthly },
    ].filter(Boolean);

    const priceColW = (W - 28) / Math.max(prices.length, 1);
    prices.forEach((p, i) => {
      const x = 14 + i * priceColW;
      doc.setFillColor(...COLOR_CARD);
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, priceColW - 3, 20, 2, 2, 'FD');
      doc.setTextColor(...COLOR_GRAY);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(p.label, x + 4, y + 6);
      doc.setTextColor(p.highlight ? ...COLOR_ACCENT : ...COLOR_WHITE);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(p.value, x + 4, y + 15);
    });
    y += 27;

    // 실거래 배너
    if (d.real_price_data?.거래일) {
      doc.setFillColor(...COLOR_CARD);
      doc.setDrawColor(52, 211, 153, 0.3);
      doc.roundedRect(14, y, W - 28, 10, 2, 2, 'FD');
      doc.setTextColor(...COLOR_GREEN);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`✓ ${d.real_price_data.거래일} 실거래 신고 데이터 기준`, 18, y + 6.5);
      y += 15;
    }

    // === 건물 스펙 ===
    doc.setTextColor(...COLOR_GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('건물 스펙', 14, y);
    y += 5;

    const specs = [
      d.building_type && { label: '건물 유형', value: d.building_type },
      d.estimated_year && { label: '건축연도', value: d.estimated_year },
      d.estimated_floors && { label: '층수', value: `${d.estimated_floors}층` },
      d.estimated_area_pyeong && { label: '면적', value: `${d.estimated_area_pyeong}평` },
    ].filter(Boolean);

    const specColW = (W - 28) / 2;
    specs.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 14 + col * specColW;
      const sy = y + row * 18;
      doc.setFillColor(...COLOR_CARD);
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, sy, specColW - 3, 15, 2, 2, 'FD');
      doc.setTextColor(...COLOR_GRAY);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(s.label, x + 4, sy + 5.5);
      doc.setTextColor(...COLOR_WHITE);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(s.value, x + 4, sy + 11.5);
    });
    y += Math.ceil(specs.length / 2) * 18 + 6;

    // === 시세 동향 ===
    if (d.price_trend) {
      doc.setTextColor(...COLOR_GRAY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('시세 동향', 14, y);
      y += 5;
      doc.setFillColor(...COLOR_CARD);
      doc.setDrawColor(...COLOR_BORDER);
      doc.roundedRect(14, y, W - 28, 28, 2, 2, 'FD');
      doc.setTextColor(...COLOR_WHITE);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const trendLines = doc.splitTextToSize(d.price_trend, W - 36);
      doc.text(trendLines.slice(0, 4), 18, y + 7);
      y += 34;
    }

    // === AI 분석 요약 ===
    if (d.analysis_summary) {
      doc.setTextColor(...COLOR_GRAY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('AI 분석 요약', 14, y);
      y += 5;
      doc.setFillColor(...COLOR_CARD);
      doc.setDrawColor(...COLOR_BORDER);
      doc.roundedRect(14, y, W - 28, 36, 2, 2, 'FD');
      doc.setTextColor(...COLOR_WHITE);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(d.analysis_summary, W - 36);
      doc.text(summaryLines.slice(0, 5), 18, y + 7);
      y += 42;
    }

    // Footer
    doc.setDrawColor(...COLOR_BORDER);
    doc.line(14, H - 14, W - 14, H - 14);
    doc.setTextColor(...COLOR_GRAY);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('※ AI 기반 추정 정보이며 실제 시세와 다를 수 있습니다. 정확한 정보는 공인중개사에 문의하세요.', 14, H - 8);
    doc.text('SnapEstate', W - 14, H - 8, { align: 'right' });

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="snapestate_${d.building_name || 'report'}.pdf"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});