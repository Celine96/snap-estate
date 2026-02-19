import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address, buildingType, estimatedYear, estimatedArea } = await req.json();

    if (!address) {
      return Response.json({ success: false, message: '주소 없음' });
    }

    // Extract district (구) from address
    const districtMatch = address.match(/([가-힣]+구)/);
    const district = districtMatch?.[1];

    if (!district) {
      return Response.json({ success: false, message: '지역구 식별 불가' });
    }

    // Try MongoDB regex filter first; fall back to loading all records
    let records = [];
    try {
      records = await base44.asServiceRole.entities.CommercialTransaction.filter(
        { 시군구: { $regex: district } },
        '-계약년월',
        500
      );
    } catch (_e) {
      const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
      records = (all || []).filter(r => (r.시군구 || '').includes(district));
    }

    // Exclude cancelled transactions
    records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');

    if (records.length === 0) {
      return Response.json({ success: false, message: '해당 지역 거래 데이터 없음' });
    }

    // Score by spec similarity
    const estimatedYearNum = estimatedYear ? parseInt(estimatedYear) : null;
    const estimatedAreaSqm = estimatedArea ? estimatedArea * 3.305785 : null;

    const scored = records.map(row => {
      let score = 0;

      const year = row.건축년도 ? parseInt(row.건축년도) : null;
      const area = row.전용연면적 ? parseFloat(row.전용연면적)
                  : row.대지면적 ? parseFloat(row.대지면적) : null;

      if (estimatedYearNum && year) {
        const diff = Math.abs(estimatedYearNum - year);
        score += Math.max(0, 20 - diff * 2);
      }

      if (estimatedAreaSqm && area && area > 0) {
        const ratio = Math.abs(estimatedAreaSqm - area) / Math.max(estimatedAreaSqm, area);
        score += Math.max(0, 10 - ratio * 10);
      }

      if (row.매칭단계 && row.매칭단계 !== '매칭실패') score += 10;

      return { ...row, _score: score };
    });

    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return (b.계약년월 || '').localeCompare(a.계약년월 || '');
    });

    const results = scored.slice(0, 5).map(({ _score, id, created_date, updated_date, created_by, ...row }) => {
      const rawPrice = (row.거래금액 || '0').toString().replace(/,/g, '').replace(/[^0-9]/g, '');
      const yyyymm = row.계약년월 || '';
      const 거래일 = yyyymm.length === 6
        ? `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}-${String(row.계약일 || '').padStart(2, '0')}`
        : null;

      return {
        건물명: row.대지위치_표제부 || row.도로명대지위치_표제부 || row.도로명 || row.시군구,
        거래금액: parseInt(rawPrice) || 0,
        거래일,
        건축연도: row.건축년도 ? parseInt(row.건축년도) : null,
        전용면적: row.전용연면적 ? parseFloat(row.전용연면적) : null,
        층: row.층 || '',
        법정동: row.시군구,
        지번: row.지번,
        건축물주용도: row.건축물주용도,
        용도지역: row.용도지역,
        거래유형: row.거래유형
      };
    });

    return Response.json({ success: true, data: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});