import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@2.5.1';
import { fetch as nodeFetch } from 'npm:node-fetch@3.3.2';

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
    const W = 210;
    const H = 297;

    // 한글 폰트 로드 (NotoSansCJKkr)
    const fontUrl = 'https://cdn.jsdelivr.net/npm/noto-sans-cjk@20190416/NotoSansCJKkr-Regular.ttf';
    const fontBoldUrl = 'https://cdn.jsdelivr.net/npm/noto-sans-cjk@20190416/NotoSansCJKkr-Bold.ttf';
    
    let fontData, fontBoldData;
    try {
      const fontRes = await fetch(fontUrl);
      fontData = await fontRes.arrayBuffer();
      const fontBoldRes = await fetch(fontBoldUrl);
      fontBoldData = await fontBoldRes.arrayBuffer();
    } catch {
      // 폰트 로드 실패 시 기본 폰트 사용
      fontData = null;
      fontBoldData = null;
    }

    // 폰트가 로드되면 등록
    if (fontData && fontBoldData) {
      const fontBase64 = btoa(String.fromCharCode(...new Uint8Array(fontData)));
      const fontBoldBase64 = btoa(String.fromCharCode(...new Uint8Array(fontBoldData)));
      
      doc.addFileToVFS('NotoSans.ttf', fontBase64);
      doc.addFont('NotoSans.ttf', 'NotoSans', 'normal');
      doc.addFileToVFS('NotoSansBold.ttf', fontBoldBase64);
      doc.addFont('NotoSansBold.ttf', 'NotoSans', 'bold');
    }

    const setFill = (r, g, b) => doc.setFillColor(r, g, b);
    const setDraw = (r, g, b) => doc.setDrawColor(r, g, b);
    const setTxt = (r, g, b) => doc.setTextColor(r, g, b);
    const setFont = (font, style) => {
      if (fontData && fontBoldData) {
        doc.setFont('NotoSans', style);
      } else {
        doc.setFont('helvetica', style);
      }
    };

    // Background
    setFill(18, 18, 20); doc.rect(0, 0, W, H, 'F');

    // Header bar
    setFill(28, 28, 30); doc.rect(0, 0, W, 22, 'F');
    setDraw(44, 44, 46); doc.setLineWidth(0.3); doc.line(0, 22, W, 22);

    // Logo
    setTxt(77, 150, 255); doc.setFontSize(13); setFont('helvetica', 'bold');
    doc.text('SnapEstate', 14, 14);

    // Date
    setTxt(154, 160, 166); doc.setFontSize(8); setFont('helvetica', 'normal');
    doc.text(new Date().toLocaleDateString('ko-KR'), W - 14, 14, { align: 'right' });

    let y = 32;

    // Building name
    setTxt(255, 255, 255); doc.setFontSize(16); setFont('helvetica', 'bold');
    doc.text(d.building_name || '건물 분석 결과', 14, y); y += 7;

    // Address
    if (d.address) {
      setTxt(154, 160, 166); doc.setFontSize(9); setFont('helvetica', 'normal');
      const addrLines = doc.splitTextToSize(d.address, W - 28);
      doc.text(addrLines, 14, y); y += addrLines.length * 5;
    }

    // Confidence
    if (d.confidence) {
      if (d.confidence === '높음') setFill(52, 211, 153);
      else if (d.confidence === '보통') setFill(251, 191, 36);
      else setFill(239, 68, 68);
      doc.roundedRect(14, y + 1, 28, 6, 1, 1, 'F');
      setTxt(18, 18, 20); doc.setFontSize(7); setFont('helvetica', 'bold');
      doc.text('신뢰도 ' + d.confidence, 17, y + 5.5); y += 12;
    } else { y += 5; }

    // Divider
    setDraw(44, 44, 46); doc.setLineWidth(0.3); doc.line(14, y, W - 14, y); y += 8;

    // 시세 정보
    setTxt(154, 160, 166); doc.setFontSize(8); setFont('helvetica', 'bold');
    doc.text('시세 정보', 14, y); y += 5;

    const prices = [
      d.estimated_price_sale ? { label: '매매가', value: d.estimated_price_sale, accent: true } : null,
      d.estimated_price_rent ? { label: '전세가', value: d.estimated_price_rent } : null,
      d.estimated_price_monthly ? { label: '월세', value: d.estimated_price_monthly } : null,
    ].filter(Boolean);

    if (prices.length > 0) {
      const colW = (W - 28) / prices.length;
      for (let i = 0; i < prices.length; i++) {
        const p = prices[i];
        const x = 14 + i * colW;
        setFill(28, 28, 30); setDraw(44, 44, 46); doc.setLineWidth(0.3);
        doc.roundedRect(x, y, colW - 3, 20, 2, 2, 'FD');
        setTxt(154, 160, 166); doc.setFontSize(7); setFont('helvetica', 'normal');
        doc.text(p.label, x + 4, y + 6);
        if (p.accent) setTxt(77, 150, 255); else setTxt(255, 255, 255);
        doc.setFontSize(10); setFont('helvetica', 'bold');
        doc.text(p.value, x + 4, y + 15);
      }
      y += 27;
    }

    // 건물 스펙
    setTxt(154, 160, 166); doc.setFontSize(8); setFont('helvetica', 'bold');
    doc.text('건물 스펙', 14, y); y += 5;

    const specs = [
      d.building_type ? { label: '건물 유형', value: d.building_type } : null,
      d.estimated_year ? { label: '건축연도', value: String(d.estimated_year) } : null,
      d.estimated_floors ? { label: '층수', value: d.estimated_floors + '층' } : null,
      d.estimated_area_pyeong ? { label: '면적', value: d.estimated_area_pyeong + '평' } : null,
    ].filter(Boolean);

    const specColW = (W - 28) / 2;
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 14 + col * specColW;
      const sy = y + row * 18;
      setFill(28, 28, 30); setDraw(44, 44, 46); doc.setLineWidth(0.3);
      doc.roundedRect(x, sy, specColW - 3, 15, 2, 2, 'FD');
      setTxt(154, 160, 166); doc.setFontSize(7); setFont('helvetica', 'normal');
      doc.text(s.label, x + 4, sy + 5.5);
      setTxt(255, 255, 255); doc.setFontSize(9); setFont('helvetica', 'bold');
      doc.text(s.value, x + 4, sy + 11.5);
    }
    y += Math.ceil(specs.length / 2) * 18 + 6;

    // 시세 동향
    if (d.price_trend) {
      setTxt(154, 160, 166); doc.setFontSize(8); setFont('helvetica', 'bold');
      doc.text('시세 동향', 14, y); y += 5;
      setFill(28, 28, 30); setDraw(44, 44, 46);
      doc.roundedRect(14, y, W - 28, 28, 2, 2, 'FD');
      setTxt(255, 255, 255); doc.setFontSize(8); setFont('helvetica', 'normal');
      const trendLines = doc.splitTextToSize(d.price_trend, W - 36);
      doc.text(trendLines.slice(0, 4), 18, y + 7); y += 34;
    }

    // AI 분석 요약
    if (d.analysis_summary) {
      setTxt(154, 160, 166); doc.setFontSize(8); setFont('helvetica', 'bold');
      doc.text('AI 분석 요약', 14, y); y += 5;
      setFill(28, 28, 30); setDraw(44, 44, 46);
      doc.roundedRect(14, y, W - 28, 36, 2, 2, 'FD');
      setTxt(255, 255, 255); doc.setFontSize(8); setFont('helvetica', 'normal');
      const summaryLines = doc.splitTextToSize(d.analysis_summary, W - 36);
      doc.text(summaryLines.slice(0, 5), 18, y + 7);
    }

    const pdfBytes = doc.output('arraybuffer');
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