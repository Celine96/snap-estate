import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { PDFDocument, rgb } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';

const BG   = rgb(0.071, 0.071, 0.078);
const SURF = rgb(0.110, 0.110, 0.118);
const BORD = rgb(0.173, 0.173, 0.180);
const WHITE= rgb(1, 1, 1);
const GRAY = rgb(0.604, 0.627, 0.651);
const BLUE = rgb(0.302, 0.588, 1);
const GREEN= rgb(0.204, 0.827, 0.600);
const AMBR = rgb(0.984, 0.749, 0.141);
const RED  = rgb(0.937, 0.267, 0.267);
const DARK = rgb(0.071, 0.071, 0.078);

function wrapText(text, maxW, size, fnt) {
  if (!text) return [];
  const lines = [];
  let cur = '';
  for (const ch of String(text)) {
    const test = cur + ch;
    if (fnt.widthOfTextAtSize(test, size) > maxW && cur) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// 단일 라인에 맞게 텍스트를 자르고 '...' 추가
function clampText(text, maxW, size, fnt) {
  if (!text) return '';
  const str = String(text);
  if (fnt.widthOfTextAtSize(str, size) <= maxW) return str;
  let result = '';
  for (const ch of str) {
    if (fnt.widthOfTextAtSize(result + ch + '...', size) > maxW) break;
    result += ch;
  }
  return result + '...';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await req.json();
    if (!id) return Response.json({ error: 'ID가 필요합니다.' }, { status: 400 });

    const d = await base44.entities.BuildingAnalysis.get(id);
    if (!d) return Response.json({ error: '데이터를 찾을 수 없습니다.' }, { status: 404 });

    // Download Noto Sans KR from jsDelivr CDN (stable, fast, no rate limit)
    const FONT_URLS = [
      'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.1.0/files/noto-sans-kr-korean-400-normal.woff',
      'https://fonts.gstatic.com/s/notosanskr/v36/PbyxFmXiEBPT4ITbgNA5Cgm203Tq4JJWq209pU0DPdWuqxJFA4GNDCBYtw.119.woff2',
    ];
    let fontBytes = null;
    for (const url of FONT_URLS) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) { fontBytes = await res.arrayBuffer(); break; }
      } catch (_) { /* try next */ }
    }
    if (!fontBytes) throw new Error('한글 폰트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes);

    const PW = 595.28, PH = 841.89;
    const page = pdfDoc.addPage([PW, PH]);
    const pad = 40;
    const cw  = PW - pad * 2;
    const tb  = (y) => PH - y; // top-based → pdf-lib bottom-based

    // Background
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: BG });

    // Header
    page.drawRectangle({ x: 0, y: tb(62), width: PW, height: 62, color: SURF });
    page.drawLine({ start: { x: 0, y: tb(62) }, end: { x: PW, y: tb(62) }, thickness: 0.8, color: BORD });
    page.drawText('SnapEstate', { x: pad, y: tb(43), font, size: 13, color: BLUE });
    const dateStr = new Date().toLocaleDateString('ko-KR');
    page.drawText(dateStr, { x: PW - pad - font.widthOfTextAtSize(dateStr, 8), y: tb(43), font, size: 8, color: GRAY });

    let top = 82;

    // Building name (clamp to single line)
    const buildingNameText = clampText(d.building_name || '건물 분석 결과', cw, 16, font);
    page.drawText(buildingNameText, { x: pad, y: tb(top + 14), font, size: 16, color: WHITE });
    top += 22;

    // Address
    if (d.address) {
      const lines = wrapText(d.address, cw, 9, font);
      for (const l of lines.slice(0, 2)) {
        page.drawText(l, { x: pad, y: tb(top + 9), font, size: 9, color: GRAY });
        top += 14;
      }
    }
    top += 2;

    // Confidence badge
    if (d.confidence) {
      const cc = d.confidence === '높음' ? GREEN : d.confidence === '보통' ? AMBR : RED;
      page.drawRectangle({ x: pad, y: tb(top + 16), width: 62, height: 16, color: cc });
      page.drawText('신뢰도 ' + d.confidence, { x: pad + 5, y: tb(top + 11), font, size: 7.5, color: DARK });
      top += 26;
    } else {
      top += 10;
    }

    // Divider
    page.drawLine({ start: { x: pad, y: tb(top) }, end: { x: PW - pad, y: tb(top) }, thickness: 0.5, color: BORD });
    top += 16;

    // 시세 정보
    page.drawText('시세 정보', { x: pad, y: tb(top + 9), font, size: 8, color: GRAY });
    top += 16;

    const prices = [
      d.estimated_price_sale    ? { label: '매매가', value: d.estimated_price_sale,    accent: true } : null,
      d.estimated_price_rent    ? { label: '전세가', value: d.estimated_price_rent }                  : null,
      d.estimated_price_monthly ? { label: '월세',   value: d.estimated_price_monthly }               : null,
    ].filter(Boolean);

    if (prices.length > 0) {
      const pcw = cw / prices.length;
      const ph  = 54;
      for (let i = 0; i < prices.length; i++) {
        const p  = prices[i];
        const px = pad + i * pcw;
        page.drawRectangle({ x: px, y: tb(top + ph), width: pcw - 4, height: ph, color: SURF, borderColor: BORD, borderWidth: 0.5 });
        page.drawText(p.label, { x: px + 8, y: tb(top + 22), font, size: 7.5, color: GRAY });
        page.drawText(p.value, { x: px + 8, y: tb(top + 42), font, size: 10,  color: p.accent ? BLUE : WHITE });
      }
      top += ph + 16;
    }

    // 건물 스펙
    page.drawText('건물 스펙', { x: pad, y: tb(top + 9), font, size: 8, color: GRAY });
    top += 16;

    const specs = [
      d.building_type         ? { label: '건물 유형', value: d.building_type }                              : null,
      d.estimated_year        ? { label: '건축연도',  value: String(d.estimated_year) }                     : null,
      d.estimated_floors      ? { label: '층수',      value: String(d.estimated_floors) + '층' }            : null,
      d.estimated_area_pyeong ? { label: '면적',      value: String(d.estimated_area_pyeong) + '평' }       : null,
    ].filter(Boolean);

    if (specs.length > 0) {
      const scw  = cw / 2;
      const sh   = 42;
      const rows = Math.ceil(specs.length / 2);
      for (let i = 0; i < specs.length; i++) {
        const s   = specs[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const sx  = pad + col * scw;
        const sy  = top + row * (sh + 4);
        page.drawRectangle({ x: sx, y: tb(sy + sh), width: scw - 4, height: sh, color: SURF, borderColor: BORD, borderWidth: 0.5 });
        page.drawText(s.label, { x: sx + 8, y: tb(sy + 16), font, size: 7.5, color: GRAY });
        page.drawText(s.value, { x: sx + 8, y: tb(sy + 32), font, size: 10,  color: WHITE });
      }
      top += rows * (sh + 4) + 16;
    }

    // 시세 동향
    if (d.price_trend) {
      page.drawText('시세 동향', { x: pad, y: tb(top + 9), font, size: 8, color: GRAY });
      top += 16;
      const tlines = wrapText(d.price_trend, cw - 20, 8, font);
      const used   = tlines.slice(0, 4);
      const th     = used.length * 14 + 18;
      page.drawRectangle({ x: pad, y: tb(top + th), width: cw, height: th, color: SURF, borderColor: BORD, borderWidth: 0.5 });
      let ty2 = top + 14;
      for (const l of used) {
        page.drawText(l, { x: pad + 10, y: tb(ty2 + 8), font, size: 8, color: WHITE });
        ty2 += 14;
      }
      top += th + 16;
    }

    // AI 분석 요약
    if (d.analysis_summary && top + 60 < PH - 50) {
      page.drawText('AI 분석 요약', { x: pad, y: tb(top + 9), font, size: 8, color: GRAY });
      top += 16;
      const slines  = wrapText(d.analysis_summary, cw - 20, 8, font);
      const maxL    = Math.min(Math.floor((PH - 50 - top - 18) / 14), 6);
      const used    = slines.slice(0, maxL);
      const sth     = used.length * 14 + 18;
      page.drawRectangle({ x: pad, y: tb(top + sth), width: cw, height: sth, color: SURF, borderColor: BORD, borderWidth: 0.5 });
      let sy2 = top + 14;
      for (const l of used) {
        page.drawText(l, { x: pad + 10, y: tb(sy2 + 8), font, size: 8, color: WHITE });
        sy2 += 14;
      }
    }

    // Footer
    page.drawLine({ start: { x: pad, y: tb(PH - 32) }, end: { x: PW - pad, y: tb(PH - 32) }, thickness: 0.5, color: BORD });
    page.drawText('※ AI 기반 추정 정보이며 실제 시세와 다를 수 있습니다.', { x: pad, y: tb(PH - 18), font, size: 7, color: GRAY });
    const snapW = font.widthOfTextAtSize('SnapEstate', 7);
    page.drawText('SnapEstate', { x: PW - pad - snapW, y: tb(PH - 18), font, size: 7, color: GRAY });

    const pdfBytes = await pdfDoc.save();
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