import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ─── 주소 파싱 & 스코어링 (searchCommercialPrice와 동일 로직) ────────────────
function extractDong(address) {
  return address.match(/([가-힣]+동\d*가?|[가-힣]+가\d*)/)?.[1] || null;
}
function extractDistrict(address) {
  return address.match(/([가-힣]+구)/)?.[1] || null;
}
function isRoadAddress(address) {
  return /[가-힣0-9]+(로|길)\s*\d/.test(address);
}
function extractJibun(address) {
  if (!address) return null;
  const withBunji = address.match(/(\d+(?:-\d+)?)\s*번지/);
  if (withBunji) return withBunji[1];
  return address.match(/(?:^|\s)(\d+(?:-\d+)?)(?:\s*$)/)?.[1] || null;
}
function extractJibunSafe(address) {
  if (!address || isRoadAddress(address)) return null;
  return extractJibun(address);
}
function normalizeBunji(str) {
  return str ? str.replace(/번지\s*$/, '').trim() : str;
}
function jibunMatches(a, b) { return !!(a && b && a.split('-')[0] === b.split('-')[0]); }
function jibunExactMatches(a, b) { return !!(a && b && a === b); }
function getJibunCandidates(row) {
  const candidates = [];
  if (row.지번) {
    const j = extractJibun(normalizeBunji(row.지번)) || extractJibun(row.지번);
    if (j) candidates.push(j);
  }
  if (row.대지위치_표제부 && !isRoadAddress(row.대지위치_표제부)) {
    const j = extractJibun(normalizeBunji(row.대지위치_표제부)) || extractJibun(row.대지위치_표제부);
    if (j && !candidates.includes(j)) candidates.push(j);
  }
  return candidates;
}
function extractRoadKey(address) {
  const m = address.match(/([가-힣]+(?:\d+)?(?:로|길)(?:\d+길)?)\s*([\d-]+)/);
  return m ? `${m[1]} ${m[2]}`.trim() : null;
}
function parseAddress(address) {
  if (!address) return { district: null, dong: null, inputJibun: null, isRoad: false, roadKey: null, hasJibunOrRoad: false };
  const district = extractDistrict(address);
  const dong = extractDong(address);
  const inputJibun = extractJibunSafe(address);
  const isRoad = isRoadAddress(address);
  const roadKey = isRoad ? extractRoadKey(address) : null;
  return { district, dong, inputJibun, isRoad, roadKey, hasJibunOrRoad: !!(inputJibun || roadKey) };
}
function roadProximityScore(inputRoadKey, rowRoad) {
  const im = inputRoadKey.match(/^(.+?)\s+(\d+)/);
  const rm = rowRoad.match(/(.+?(?:로|길)(?:\d+길)?)\s*(\d+)/);
  if (!im || !rm || im[1] !== rm[1]) return null;
  const diff = Math.abs(parseInt(im[2]) - parseInt(rm[2]));
  if (diff === 0) return null;
  if (diff <= 10) return { score: 60, factor: `도로명 근접 매칭 (${diff}번 차이)` };
  return null;
}
const MAX_SCORE = 205;
function scoreRecord(row, parsed, input = {}) {
  let score = 0;
  let matchType = 'none';
  const matchFactors = [];

  if (parsed.roadKey) {
    const rowRoad = (row.도로명 || row.도로명대지위치_표제부 || '').replace(/\s*\([^)]+\)/, '').trim();
    if (rowRoad.includes(parsed.roadKey)) {
      score += 120; matchType = 'road_exact'; matchFactors.push('도로명 정확 매칭');
    } else {
      const prox = roadProximityScore(parsed.roadKey, rowRoad);
      if (prox) { score += prox.score; matchType = 'road_nearby'; matchFactors.push(prox.factor); }
    }
  }
  if (parsed.inputJibun && matchType === 'none') {
    const inputHasSub = parsed.inputJibun.includes('-');
    for (const candidate of getJibunCandidates(row)) {
      if (jibunExactMatches(parsed.inputJibun, candidate)) {
        score += 120; matchType = 'jibun_exact'; matchFactors.push('지번 정확 매칭'); break;
      } else if (!inputHasSub && jibunMatches(parsed.inputJibun, candidate)) {
        score += 80; matchType = 'jibun_main'; matchFactors.push('지번 본번 매칭'); break;
      }
    }
  }
  const dongMatched = parsed.dong && (row.시군구 || row.법정동 || '').includes(parsed.dong);
  if (dongMatched) {
    if (!parsed.hasJibunOrRoad && matchType === 'none') {
      score += 50; matchType = 'dong_only'; matchFactors.push('동 매칭 (핵심)');
    } else { score += 20; matchFactors.push('동 매칭'); }
  }
  if (matchType === 'none') return { score: 0, matchType: 'none', confidence: 'none', normalizedScore: 0 };

  if (input.buildingName?.length > 1) {
    const name = row.건물명 || '';
    if (name && (name.includes(input.buildingName) || input.buildingName.includes(name))) {
      score += 20; matchFactors.push('건물명 매칭');
    }
  }
  if (row.매칭단계 && row.매칭단계 !== '매칭실패') { score += 10; }
  if (input.estimatedYear && row.건축년도) {
    const diff = Math.abs(input.estimatedYear - parseInt(row.건축년도));
    score += Math.max(0, 10 - diff);
  }
  const area = row.전용연면적 ? parseFloat(row.전용연면적) : row.전용면적 ? parseFloat(row.전용면적) : null;
  if (input.estimatedAreaSqm && area > 0) {
    const ratio = Math.abs(input.estimatedAreaSqm - area) / Math.max(input.estimatedAreaSqm, area);
    if (ratio <= 0.05) score += 15;
    else if (ratio <= 0.10) score += 10;
    else if (ratio <= 0.25) score += 5;
  }

  const normalizedScore = Math.round((score / MAX_SCORE) * 100);
  const confidence = normalizedScore >= 70 ? 'high' : normalizedScore >= 45 ? 'medium' : normalizedScore >= 20 ? 'low' : 'none';
  return { score, matchType, confidence, normalizedScore, matchFactors };
}

// ─── DB에서 실거래가 조회 ─────────────────────────────────────────────────────
async function findRealPriceFromDB(base44, address, estimatedYear, estimatedArea) {
  const parsed = parseAddress(address);
  if (!parsed.district) return null;

  let records = [];

  if (parsed.isRoad && parsed.roadKey) {
    try {
      records = await base44.asServiceRole.entities.CommercialTransaction.filter(
        { 도로명: { $regex: parsed.roadKey } }, '-계약년월', 200
      );
    } catch (_e) {
      const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 5000);
      records = (all || []).filter(r => (r.도로명 || '').includes(parsed.roadKey));
    }
    records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');
  }

  if (records.length === 0) {
    const filterTarget = parsed.dong ? `${parsed.district} ${parsed.dong}` : parsed.district;
    try {
      records = await base44.asServiceRole.entities.CommercialTransaction.filter(
        { 시군구: { $regex: filterTarget } }, '-계약년월', 500
      );
    } catch (_e) {
      const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 5000);
      records = (all || []).filter(r => (r.시군구 || '').includes(filterTarget));
    }
    records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');
  }

  if (records.length === 0) return null;

  const estimatedAreaSqm = estimatedArea ? estimatedArea * 3.305785 : null;
  const scored = records.map(row => {
    const result = scoreRecord(row, parsed, { estimatedYear: estimatedYear ? parseInt(estimatedYear) : null, estimatedAreaSqm });
    return { ...row, _score: result.score, _confidence: result.confidence, _normalizedScore: result.normalizedScore };
  });
  scored.sort((a, b) => b._score - a._score);

  const top = scored[0];
  const minScore = parsed.hasJibunOrRoad ? 80 : 50;
  if (top._score < minScore) return null;

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
    매칭신뢰도: top._confidence || 'low',
    데이터출처: 'DB',
  };
}

// ─── 국토교통부 API에서 실거래가 조회 ──────────────────────────────────────────
async function findRealPriceFromGov(address, buildingType, apiKey) {
  const parsed = parseAddress(address);
  if (!parsed.district) return null;

  // 시군구 코드 매핑 (주요 지역만)
  const sigunguMap = {
    '강남구': '11680', '서초구': '11650', '송파구': '11710', '강동구': '11740',
    '강서구': '11500', '양천구': '11470', '영등포구': '11560', '구로구': '11530',
    '금천구': '11545', '동작구': '11590', '관악구': '11620', '마포구': '11440',
    '서대문구': '11410', '은평구': '11380', '종로구': '11110', '중구': '11140',
    '용산구': '11170', '성동구': '11200', '광진구': '11215', '동대문구': '11230',
    '중랑구': '11260', '성북구': '11290', '강북구': '11305', '도봉구': '11320',
    '노원구': '11350', '태릉': '11350',
    '수원시 영통구': '41117', '수원시 권선구': '41113', '수원시 장안구': '41111', '수원시 팔달구': '41115',
    '성남시 분당구': '41135', '성남시 수정구': '41131', '성남시 중원구': '41133',
    '용인시 수지구': '41465', '용인시 기흥구': '41463', '용인시 처인구': '41461',
    '고양시 일산동구': '41285', '고양시 일산서구': '41287', '고양시 덕양구': '41281',
    '부천시': '41190', '안산시 단원구': '41273', '안산시 상록구': '41271',
    '안양시 동안구': '41173', '안양시 만안구': '41171',
  };

  let sigunguCd = null;
  for (const [key, code] of Object.entries(sigunguMap)) {
    if (address.includes(key)) { sigunguCd = code; break; }
  }
  if (!sigunguCd) return null;

  const typeEndpointMap = {
    '상가': 'getNrtTradeInfo',
    '오피스': 'getNrtTradeInfo',
    '오피스텔': 'getRTMSDataSvcOffiTrade',
    '아파트': 'getRTMSDataSvcAptTradeDev',
    '빌라/다세대': 'getRTMSDataSvcRHTrade',
    '단독주택': 'getRTMSDataSvcSHTrade',
    '기타': 'getNrtTradeInfo',
  };
  const endpoint = typeEndpointMap[buildingType] || 'getNrtTradeInfo';

  const now = new Date();
  const dealYmd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  const url = `https://apis.data.go.kr/1613000/RTMSDataSvc${endpoint.replace('getRTMSDataSvc', '').replace('getNrtTradeInfo', '')}/${endpoint}?serviceKey=${apiKey}&pageNo=1&numOfRows=10&LAWD_CD=${sigunguCd}&DEAL_YMD=${dealYmd}&type=json`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const items = data?.response?.body?.items?.item;
    if (!items || !Array.isArray(items) || items.length === 0) return null;

    // 동/지번으로 필터링
    let filtered = items;
    if (parsed.dong) {
      const donFiltered = items.filter(item => (item.법정동 || item.도로명 || '').includes(parsed.dong));
      if (donFiltered.length > 0) filtered = donFiltered;
    }

    const top = filtered[0];
    const rawAmount = (top.거래금액 || '0').toString().replace(/,/g, '').replace(/[^0-9]/g, '');
    const dealYear = top.년 || top.거래년도 || '';
    const dealMonth = top.월 || top.거래월 || '';
    const dealDay = top.일 || top.거래일 || '';
    const 거래일 = dealYear && dealMonth ? `${dealYear}-${String(dealMonth).padStart(2, '0')}-${String(dealDay).padStart(2, '0')}` : null;

    return {
      건물명: top.건물명 || top.아파트 || top.연립다세대 || '',
      거래금액: parseInt(rawAmount) || 0,
      거래일,
      건축연도: top.건축년도 ? parseInt(top.건축년도) : null,
      전용면적: top.전용면적 ? parseFloat(top.전용면적) : null,
      층: top.층 || '',
      법정동: top.법정동 || '',
      지번: top.지번 || '',
      건축물주용도: buildingType,
      용도지역: top.용도지역 || '',
      매칭신뢰도: 'medium',
      데이터출처: '국토교통부 API',
    };
  } catch (_e) {
    return null;
  }
}

// ─── 메인 핸들러 ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const forceAll = body.forceAll === true; // true면 이미 매칭된 것도 재시도

    const analyses = await base44.asServiceRole.entities.BuildingAnalysis.list('-created_date', 500);
    console.log(`[backfill] 전체 분석 기록: ${analyses.length}건`);

    const apiKey = Deno.env.get('MOLIT_API_KEY') || '';
    const results = [];

    for (const item of analyses) {
      const address = item.address;
      if (!address) {
        results.push({ id: item.id, status: 'skip - no address' });
        continue;
      }

      // forceAll=false면 이미 실거래가 있는 것 스킵
      if (!forceAll && item.real_price_data?.거래금액 > 0) {
        results.push({ id: item.id, building: item.building_name, address, status: 'skip - already has price' });
        continue;
      }

      try {
        const estimatedArea = item.estimated_area_pyeong ? parseFloat(item.estimated_area_pyeong) : undefined;

        // 1차: DB
        let priceData = await findRealPriceFromDB(base44, address, item.estimated_year, estimatedArea);
        let priceType = '최근 실거래가';

        // 2차: 국토부 API fallback
        if (!priceData && apiKey) {
          priceData = await findRealPriceFromGov(address, item.building_type, apiKey);
          priceType = '국토교통부 실거래가';
        }

        if (priceData) {
          const updatePayload = {
            real_price_data: priceData,
            price_type: priceType,
          };

          // 표제부 데이터로 건물 스펙도 업데이트 (값이 없는 경우만)
          if (!item.estimated_year && priceData.건축연도) {
            updatePayload.estimated_year = String(priceData.건축연도);
          }
          if (!item.estimated_area_pyeong && priceData.전용면적) {
            updatePayload.estimated_area_pyeong = String(Math.round(priceData.전용면적 / 3.305785));
          }

          await base44.asServiceRole.entities.BuildingAnalysis.update(item.id, updatePayload);
          results.push({
            id: item.id,
            building: item.building_name,
            address,
            status: 'updated',
            source: priceData.데이터출처,
            price: priceData.거래금액,
            confidence: priceData.매칭신뢰도,
          });
        } else {
          results.push({ id: item.id, building: item.building_name, address, status: 'no_match' });
        }
      } catch (e) {
        results.push({ id: item.id, address, status: `error: ${e.message}` });
      }
    }

    const updated = results.filter(r => r.status === 'updated').length;
    const skipped = results.filter(r => r.status.startsWith('skip')).length;
    const noMatch = results.filter(r => r.status === 'no_match').length;

    return Response.json({
      summary: { total: analyses.length, updated, skipped, no_match: noMatch },
      details: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});