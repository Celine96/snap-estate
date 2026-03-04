import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { scoreRecord, parseAddress } from './addressUtils.ts';

async function findRealPrice(base44, address, buildingType, estimatedYear, estimatedArea) {
  const parsed = parseAddress(address);

  if (!parsed.district) return null;

  let records = [];

  if (parsed.isRoad && parsed.roadKey) {
    try {
      records = await base44.asServiceRole.entities.CommercialTransaction.filter(
        { 도로명: { $regex: parsed.roadKey } }, '-계약년월', 200
      );
    } catch (_e) {
      const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
      records = (all || []).filter(r => (r.도로명 || '').includes(parsed.roadKey));
    }
    records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');
  }

  if (records.length === 0) {
    const filterTarget = parsed.dong ? `${parsed.district} ${parsed.dong}` : parsed.district;
    try {
      records = await base44.asServiceRole.entities.CommercialTransaction.filter(
        { 시군구: { $regex: filterTarget } }, '-계약년월', 1000
      );
    } catch (_e) {
      const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
      records = (all || []).filter(r => (r.시군구 || '').includes(filterTarget));
    }
    if (records.length === 0 && parsed.dong) {
      try {
        records = await base44.asServiceRole.entities.CommercialTransaction.filter(
          { 시군구: { $regex: parsed.district } }, '-계약년월', 1000
        );
      } catch (_e) {
        const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
        records = (all || []).filter(r => (r.시군구 || '').includes(parsed.district));
      }
    }
    records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');
  }

  if (records.length === 0) return null;

  const estimatedYearNum = estimatedYear ? parseInt(estimatedYear) : null;
  const estimatedAreaSqm = estimatedArea ? estimatedArea * 3.305785 : null;

  const scored = records.map(row => {
    const result = scoreRecord(row, parsed, {
      estimatedYear: estimatedYearNum,
      estimatedAreaSqm,
    });
    return { ...row, _score: result.score, _matchType: result.matchType, _confidence: result.confidence, _normalizedScore: result.normalizedScore, _matchFactors: result.matchFactors };
  });

  scored.sort((a, b) => b._score !== a._score ? b._score - a._score : (b.계약년월 || '').localeCompare(a.계약년월 || ''));

  const top = scored[0];
  if (top._score < 100) return null;

  const rawPrice = (top.거래금액 || '0').toString().replace(/,/g, '').replace(/[^0-9]/g, '');
  const yyyymm = top.계약년월 || '';
  const 거래일 = yyyymm.length === 6
    ? `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}-${String(top.계약일 || '').padStart(2, '0')}`
    : null;

  return {
    건물명: top.대지위치_표제부 || top.도로명대지위치_표제부 || top.시군구,
    거래금액: parseInt(rawPrice) || 0,
    거래일,
    건축연도: top.건축년도 ? parseInt(top.건축년도) : null,
    전용면적: top.전용연면적 ? parseFloat(top.전용연면적) : null,
    층: top.층 || '',
    법정동: top.시군구,
    지번: top.지번,
    건축물주용도: top.건축물주용도,
    용도지역: top.용도지역,
    거래유형: top.거래유형,
    매칭점수: top._score,
    매칭신뢰도: top._confidence,
    매칭점수_정규화: top._normalizedScore,
    매칭요인: top._matchFactors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const analyses = await base44.asServiceRole.entities.BuildingAnalysis.list('-created_date', 200);
    console.log(`[backfill] 전체 분석 기록: ${analyses.length}건`);

    const results = [];

    for (const item of analyses) {
      const address = item.address;
      if (!address) {
        results.push({ id: item.id, status: 'skip - no address' });
        continue;
      }

      try {
        const estimatedArea = item.estimated_area_pyeong ? parseFloat(item.estimated_area_pyeong) : undefined;
        const top = await findRealPrice(base44, address, item.building_type, item.estimated_year, estimatedArea);

        if (top) {
          await base44.asServiceRole.entities.BuildingAnalysis.update(item.id, {
            real_price_data: top,
            price_type: '최근 실거래가'
          });
          results.push({
            id: item.id,
            building: item.building_name,
            address,
            status: 'updated',
            matched_jibun: top.지번,
            score: top.매칭점수,
            confidence: top.매칭신뢰도,
            price: top.거래금액
          });
        } else {
          results.push({ id: item.id, building: item.building_name, address, status: 'no_match' });
        }
      } catch (e) {
        results.push({ id: item.id, address, status: `error: ${e.message}` });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    return Response.json({
      summary: { total: analyses.length, updated, no_match: analyses.length - updated },
      details: results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
