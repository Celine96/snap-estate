import { toast } from "sonner";

export async function exportToPdf(analysisData) {
  if (!analysisData) return;

  try {
    const { jsPDF } = await import('jspdf');
    const d = analysisData;
    const dateStr = new Date().toLocaleDateString('ko-KR');

    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const W = 595;
    let y = 0;

    // ── 헤더 배경
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, W, 56, 'F');

    // 브랜드명
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SnapEstate', 40, 35);

    // 날짜
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(dateStr, W - 40, 32, { align: 'right' });
    doc.setFontSize(8);
    doc.text('AI Building Analysis', W - 40, 44, { align: 'right' });

    y = 80;

    // ── 건물 이미지 (있을 경우)
    if (d.image_url) {
      try {
        const img = await loadImageAsBase64(d.image_url);
        if (img) {
          doc.addImage(img, 'JPEG', 40, y, W - 80, 160, undefined, 'FAST');
          // 이미지 위에 그라데이션 효과 대신 하단 오버레이
          doc.setFillColor(15, 23, 42, 0.6);
          y += 168;
        }
      } catch (e) {
        // 이미지 로드 실패 시 스킵
      }
    }

    // ── 건물명 섹션
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const nameText = d.building_name || 'Building Analysis';
    doc.text(nameText, 40, y + 24);
    y += 36;

    if (d.address) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(d.address, 40, y);
      y += 16;
    }

    if (d.confidence) {
      const cColor = d.confidence === '높음' ? [6, 95, 70] : d.confidence === '보통' ? [146, 64, 14] : [153, 27, 27];
      const cBg    = d.confidence === '높음' ? [236, 253, 245] : d.confidence === '보통' ? [255, 251, 235] : [254, 242, 242];
      doc.setFillColor(...cBg);
      doc.roundedRect(40, y, 72, 16, 3, 3, 'F');
      doc.setTextColor(...cColor);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text(`신뢰도 ${d.confidence}`, 76, y + 10.5, { align: 'center' });
      y += 28;
    }

    // ── 구분선
    y += 6;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(40, y, W - 40, y);
    y += 20;

    // ── 시세 정보
    const prices = [
      d.estimated_price_sale    ? { label: '매매가', value: d.estimated_price_sale,    bg: [239, 246, 255], border: [191, 219, 254], text: [29, 78, 216] } : null,
      d.estimated_price_rent    ? { label: '전세가', value: d.estimated_price_rent,    bg: [236, 253, 245], border: [167, 243, 208], text: [6, 95, 70]   } : null,
      d.estimated_price_monthly ? { label: '월세',   value: d.estimated_price_monthly, bg: [255, 251, 235], border: [253, 230, 138], text: [146, 64, 14] } : null,
    ].filter(Boolean);

    if (prices.length > 0) {
      sectionLabel(doc, 40, y, '시세 정보', [59, 130, 246]);
      y += 22;

      const cardW = (W - 80 - (prices.length - 1) * 10) / prices.length;
      prices.forEach((p, i) => {
        const x = 40 + i * (cardW + 10);
        doc.setFillColor(...p.bg);
        doc.setDrawColor(...p.border);
        doc.setLineWidth(1);
        doc.roundedRect(x, y, cardW, 54, 6, 6, 'FD');

        doc.setTextColor(...p.text);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(p.label, x + 12, y + 18);

        doc.setFontSize(i === 0 ? 13 : 11);
        doc.setFont('helvetica', 'bold');
        const valueText = p.value.length > 16 ? p.value.substring(0, 16) + '...' : p.value;
        doc.text(valueText, x + 12, y + 38);
      });
      y += 66;
    }

    // ── 건물 스펙
    const specs = [
      d.building_type         ? { label: '건물 유형', value: d.building_type }                      : null,
      d.estimated_year        ? { label: '건축연도',  value: `${d.estimated_year}년` }               : null,
      d.estimated_floors      ? { label: '층수',      value: `${d.estimated_floors}층` }             : null,
      d.estimated_area_pyeong ? { label: '면적',      value: `${d.estimated_area_pyeong}평` }        : null,
    ].filter(Boolean);

    if (specs.length > 0) {
      sectionLabel(doc, 40, y, '건물 스펙', [139, 92, 246]);
      y += 22;

      const cols = 2;
      const specW = (W - 80 - 10) / cols;
      specs.forEach((s, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 40 + col * (specW + 10);
        const sy = y + row * 48;

        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.8);
        doc.roundedRect(x, sy, specW, 38, 5, 5, 'FD');

        doc.setTextColor(148, 163, 184);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text(s.label, x + 12, sy + 14);

        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(s.value, x + 12, sy + 30);
      });
      y += Math.ceil(specs.length / cols) * 48 + 12;
    }

    // ── 시세 동향
    if (d.price_trend) {
      sectionLabel(doc, 40, y, '시세 동향', [16, 185, 129]);
      y += 22;
      y = textBox(doc, d.price_trend, 40, y, W - 80, [240, 253, 244], [187, 247, 208], [6, 78, 59]);
      y += 10;
    }

    // ── AI 분석 요약
    if (d.analysis_summary) {
      sectionLabel(doc, 40, y, 'AI 분석 요약', [245, 158, 11]);
      y += 22;
      y = textBox(doc, d.analysis_summary, 40, y, W - 80, [255, 251, 235], [253, 230, 138], [69, 26, 3]);
      y += 10;
    }

    // ── 푸터
    const footerY = Math.max(y + 20, 800);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, footerY, W, 36, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(0, footerY, W, footerY);

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('※ AI 기반 추정 정보이며 실제 시세와 다를 수 있습니다.', 40, footerY + 21);

    doc.setTextColor(59, 130, 246);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('SnapEstate', W - 40, footerY + 21, { align: 'right' });

    doc.save(`snapestate_${d.building_name || 'report'}.pdf`);
    toast.success('PDF가 다운로드되었습니다');
  } catch (e) {
    console.error(e);
    toast.error('PDF 생성에 실패했습니다');
  }
}

// ── 섹션 레이블 헬퍼
function sectionLabel(doc, x, y, text, color) {
  doc.setFillColor(...color);
  doc.rect(x, y, 3, 14, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(text, x + 10, y + 11);
}

// ── 텍스트 박스 헬퍼 (자동 줄바꿈)
function textBox(doc, text, x, y, width, bgColor, borderColor, textColor) {
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(text, width - 24);
  const boxH = lines.length * 14 + 20;

  doc.setFillColor(...bgColor);
  doc.setDrawColor(...borderColor);
  doc.setLineWidth(1);
  doc.roundedRect(x, y, width, boxH, 6, 6, 'FD');

  // 왼쪽 강조선
  doc.setFillColor(...borderColor);
  doc.rect(x, y, 3, boxH, 'F');

  doc.setTextColor(...textColor);
  lines.forEach((line, i) => {
    doc.text(line, x + 16, y + 16 + i * 14);
  });

  return y + boxH;
}

// ── 이미지 → base64 변환
function loadImageAsBase64(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(null);
    img.src = url;
    setTimeout(() => resolve(null), 5000);
  });
}