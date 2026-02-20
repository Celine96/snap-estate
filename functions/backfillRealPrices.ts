import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── 검색 로직 (searchCommercialPrice와 동일) ──────────────────────────

function extractDong(address) {
  const match = address.match(/([가-힣]+동\d*가?|[가-힣]+가\d*)/);
  return match?.[1] || null;
}
function extractDistrict(address) {
  const match = address.match(/([가-힣]+구)/);
  return match?.[1] || null;
}
function isRoadAddress(address) {
  return /[가-힣0-9]+(로|길)\s*\d/.test(address);
}
function extractJibun(address) {
  if (!address) return null;
  if (isRoadAddress(address)) return null;
  const withBunji = address.match(/(\d+(?:-\d+)?)\s*번지/);
  if (withBunji) return withBunji[1];
  const trailing = address.match(/(?:^|\s)(\d+(?:-\d+)?)(?:\s*$)/);
  if (trailing) return trailing[1];
  return null;
}
function jibunMatches(a, b) {
  if (!a || !b) return false;
  return a.split('-')[0] === b.split('-')[0];
}
function jibunExactMatches(a, b) {
  return !!a && !!b && a === b;
}
function normalizeBunji(str) {
  if (!str) return str;
  return str.replace(/번지\s*$/, '').trim();
}
function getJibunCandidates(row) {
  return [row.지번, row.대지위치_표제부, row.도로명대지위치_표제부]
    .filter(Boolean)
    .map(s => extractJibun(normalizeBunji(s)) || extractJibun(s))
    .filter(Boolean);
}

async function findRealPrice(base44, address, buildingType, estimatedYear, estimatedArea) {
  const district = extractDistrict(address);
  const dong = extractDong(address);
  const inputJibun = extractJibun(address);
  const roadAddress = isRoadAddress(address);

  if (!district) return null;

  let records = [];

  if (roadAddress) {
    const roadMatch = address.match(/([가-힣]+(?:\d+)?(?:로|길)(?:\d+길)?)\s*([\d-]+)/);
    const roadKey = roadMatch ? `${roadMatch[1]} ${roadMatch[2]}`.trim() : null;
    if (roadKey) {
      try {
        records = await base44.asServiceRole.entities.CommercialTransaction.filter(
          { 도로명: { $regex: roadKey } }, '-계약년월', 200
        );
      } catch (_e) {
        const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
        records = (all || []).filter(r => (r.도로명 || '').includes(roadKey));
      }
      records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');
    }
  }

  if (records.length === 0) {
    const filterTarget = dong ? `${district} ${dong}` : district;
    try {
      records = await base44.asServiceRole.entities.CommercialTransaction.filter(
        { 시군구: { $regex: filterTarget } }, '-계약년월', 1000
      );
    } catch (_e) {
      const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
      records = (all || []).filter(r => (r.시군구 || '').includes(filterTarget));
    }
    if (records.length === 0 && dong) {
      try {
        records = await base44.asServiceRole.entities.CommercialTransaction.filter(
          { 시군구: { $regex: district } }, '-계약년월', 1000
        );
      } catch (_e) {
        const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
        records = (all || []).filter(r => (r.시군구 || '').includes(district));
      }
    }
    records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');
  }

  if (records.length === 0) return null;

  const estimatedYearNum = estimatedYear ? parseInt(estimatedYear) : null;
  const estimatedAreaSqm = estimatedArea ? estimatedArea * 3.305785 : null;

  const scored = records.map(row => {
    let score = 0;
    if (roadAddress) {
      const rowRoad = row.도로명 || row.도로명대지위치_표제부 || '';
      if (rowRoad && address.includes(rowRoad.replace(/\s*\([^)]+\)/, '').trim())) score += 120;
      else if (rowRoad && rowRoad.includes(address.replace(/서울특별시\s+/, '').replace(/강남구\s+/, ''))) score += 80;
    }
    if (inputJibun) {
      const candidates = getJibunCandidates(row);
      for (const c of candidates) {
        if (jibunExactMatches(inputJibun, c)) { score += 120; break; }
        else if (jibunMatches(inputJibun, c)) { score += 80; break; }
      }
    }
    if (dong && (row.시군구 || '').includes(dong)) score += 30;
    if (row.매칭단계 && row.매칭단계 !== '매칭실패') score += 20;
    const year = row.건축년도 ? parseInt(row.건축년도) : null;
    if (estimatedYearNum && year) score += Math.max(0, 15 - Math.abs(estimatedYearNum - year) * 1.5);
    const area = row.전용연면적 ? parseFloat(row.전용연면적) : row.대지면적 ? parseFloat(row.대지면적) : null;
    if (estimatedAreaSqm && area && area > 0) {
      const ratio = Math.abs(estimatedAreaSqm - area) / Math.max(estimatedAreaSqm, area);
      score += Math.max(0, 10 - ratio * 10);
    }
    return { ...row, _score: score };
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
    매칭점수: top._score
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