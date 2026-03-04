import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── 인라인 주소 파싱 유틸리티 ──

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
  const withBunji = address.match(/(\d+(?:-\d+)?)\s*번지/);
  if (withBunji) return withBunji[1];
  const trailing = address.match(/(?:^|\s)(\d+(?:-\d+)?)(?:\s*$)/);
  if (trailing) return trailing[1];
  return null;
}

function extractJibunSafe(address) {
  if (!address) return null;
  if (isRoadAddress(address)) return null;
  return extractJibun(address);
}

function normalizeBunji(str) {
  if (!str) return str;
  return str.replace(/번지\s*$/, '').trim();
}

function jibunMatches(inputJibun, recordJibun) {
  if (!inputJibun || !recordJibun) return false;
  return inputJibun.split('-')[0] === recordJibun.split('-')[0];
}

function jibunExactMatches(inputJibun, recordJibun) {
  if (!inputJibun || !recordJibun) return false;
  return inputJibun === recordJibun;
}

function getJibunCandidates(row) {
  const candidates = [];
  if (row.지번) {
    const normalized = normalizeBunji(row.지번);
    const j = extractJibun(normalized) || extractJibun(row.지번);
    if (j) candidates.push(j);
  }
  if (row.대지위치_표제부 && !isRoadAddress(row.대지위치_표제부)) {
    const normalized = normalizeBunji(row.대지위치_표제부);
    const j = extractJibun(normalized) || extractJibun(row.대지위치_표제부);
    if (j && !candidates.includes(j)) candidates.push(j);
  }
  return candidates;
}

function extractRoadKey(address) {
  const roadMatch = address.match(/([가-힣]+(?:\d+)?(?:로|길)(?:\d+길)?)\s*([\d-]+)/);
  return roadMatch ? `${roadMatch[1]} ${roadMatch[2]}`.trim() : null;
}

function parseAddress(address) {
  const district = extractDistrict(address);
  const dong = extractDong(address);
  const inputJibun = extractJibunSafe(address);
  const isRoad = isRoadAddress(address);
  const roadKey = isRoad ? extractRoadKey(address) : null;
  return {
    district,
    dong,
    inputJibun,
    isRoad,
    roadKey,
    hasJibunOrRoad: !!(inputJibun || roadKey),
  };
}

function roadProximityScore(inputRoadKey, rowRoad) {
  if (!inputRoadKey || !rowRoad) return null;
  const inputMatch = inputRoadKey.match(/^(.+?)\s+(\d+)/);
  const rowMatch = rowRoad.match(/(.+?(?:로|길)(?:\d+길)?)\s*(\d+)/);
  if (!inputMatch || !rowMatch) return null;
  if (inputMatch[1] !== rowMatch[1]) return null;
  const diff = Math.abs(parseInt(inputMatch[2]) - parseInt(rowMatch[2]));
  if (diff === 0) return null;
  if (diff <= 10) return { score: 60, factor: `도로명 근접 매칭 (${diff}번 차이)` };
  return null;
}

const MAX_SCORE = 205;

function scoreRecord(row, parsed, input) {
  let score = 0;
  let matchType = 'none';
  const matchFactors = [];

  if (parsed.roadKey) {
    const rowRoad = (row.도로명 || row.도로명대지위치_표제부 || '').replace(/\s*\([^)]+\)/, '').trim();
    if (rowRoad.includes(parsed.roadKey)) {
      score += 120;
      matchType = 'road_exact';
      matchFactors.push('도로명 정확 매칭');
    } else {
      const prox = roadProximityScore(parsed.roadKey, rowRoad);
      if (prox) {
        score += prox.score;
        matchType = 'road_nearby';
        matchFactors.push(prox.factor);
      }
    }
  }

  if (parsed.inputJibun && matchType === 'none') {
    const inputHasSub = parsed.inputJibun.includes('-');
    const candidates = getJibunCandidates(row);
    for (const candidate of candidates) {
      if (jibunExactMatches(parsed.inputJibun, candidate)) {
        score += 120;
        matchType = 'jibun_exact';
        matchFactors.push('지번 정확 매칭');
        break;
      } else if (!inputHasSub && jibunMatches(parsed.inputJibun, candidate)) {
        score += 80;
        matchType = 'jibun_main';
        matchFactors.push('지번 본번 매칭');
        break;
      }
    }
  }

  const dongMatched = parsed.dong && (row.시군구 || row.법정동 || '').includes(parsed.dong);
  if (dongMatched) {
    if (!parsed.hasJibunOrRoad && matchType === 'none') {
      score += 50;
      matchType = 'dong_only';
      matchFactors.push('동 매칭 (핵심)');
    } else {
      score += 20;
      matchFactors.push('동 매칭');
    }
  }

  if (matchType === 'none') return { score: 0, matchType: 'none', confidence: 'none', normalizedScore: 0, matchFactors: [] };

  if (input.buildingName && input.buildingName.length > 1) {
    const name = row.건물명 || '';
    if (name && (name.includes(input.buildingName) || input.buildingName.includes(name))) {
      score += 20;
      matchFactors.push('건물명 매칭');
    }
  }

  if (row.매칭단계 && row.매칭단계 !== '매칭실패') {
    score += 10;
    matchFactors.push('표제부 매칭');
  }

  const year = row.건축년도 ? parseInt(row.건축년도) : null;
  if (input.estimatedYear && year) {
    const diff = Math.abs(input.estimatedYear - year);
    const yearScore = Math.max(0, 10 - diff);
    if (yearScore > 0) {
      score += yearScore;
      matchFactors.push(diff === 0 ? '건축연도 일치' : `건축연도 유사 (${diff}년 차이)`);
    }
  }

  const area = row.전용연면적 ? parseFloat(row.전용연면적)
    : row.전용면적 ? parseFloat(row.전용면적)
    : row.대지면적 ? parseFloat(row.대지면적) : null;
  if (input.estimatedAreaSqm && area && area > 0) {
    const ratio = Math.abs(input.estimatedAreaSqm - area) / Math.max(input.estimatedAreaSqm, area);
    if (ratio <= 0.05) {
      score += 15;
      matchFactors.push(`면적 유사 (${Math.round(ratio * 100)}% 차이)`);
    } else if (ratio <= 0.10) {
      score += 10;
      matchFactors.push(`면적 유사 (${Math.round(ratio * 100)}% 차이)`);
    } else if (ratio <= 0.25) {
      score += 5;
      matchFactors.push(`면적 참고 (${Math.round(ratio * 100)}% 차이)`);
    }
  }

  const normalizedScore = Math.round((score / MAX_SCORE) * 100);
  let confidence = 'none';
  if (normalizedScore >= 70) confidence = 'high';
  else if (normalizedScore >= 45) confidence = 'medium';
  else if (normalizedScore >= 20) confidence = 'low';

  return { score, matchType, confidence, normalizedScore, matchFactors };
}

// ── 메인 핸들러 ──

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address, buildingType, estimatedYear, estimatedArea } = await req.json();

    if (!address) return Response.json({ success: false, message: '주소 없음' });

    const parsed = parseAddress(address);

    console.log(`[검색] district=${parsed.district}, dong=${parsed.dong}, jibun=${parsed.inputJibun}, 도로명=${parsed.isRoad}, roadKey=${parsed.roadKey}`);

    if (!parsed.district) return Response.json({ success: false, message: '지역구 식별 불가' });

    let records = [];

    if (parsed.isRoad && parsed.roadKey) {
      try {
        records = await base44.asServiceRole.entities.CommercialTransaction.filter(
          { 도로명: { $regex: parsed.roadKey } },
          '-계약년월',
          200
        );
      } catch (_e) {
        const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
        records = (all || []).filter(r => (r.도로명 || '').includes(parsed.roadKey));
      }
      records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');
      console.log(`[검색] 도로명 매칭 ${records.length}건`);
    }

    if (records.length === 0) {
      const filterTarget = parsed.dong ? `${parsed.district} ${parsed.dong}` : parsed.district;
      try {
        records = await base44.asServiceRole.entities.CommercialTransaction.filter(
          { 시군구: { $regex: filterTarget } },
          '-계약년월',
          1000
        );
      } catch (_e) {
        const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
        records = (all || []).filter(r => (r.시군구 || '').includes(filterTarget));
      }

      if (records.length === 0 && parsed.dong) {
        try {
          records = await base44.asServiceRole.entities.CommercialTransaction.filter(
            { 시군구: { $regex: parsed.district } },
            '-계약년월',
            1000
          );
        } catch (_e) {
          const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
          records = (all || []).filter(r => (r.시군구 || '').includes(parsed.district));
        }
      }
      records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');
    }

    console.log(`[검색] 후보 ${records.length}건`);

    if (records.length === 0) return Response.json({ success: false, message: '해당 지역 거래 데이터 없음' });

    const estimatedYearNum = estimatedYear ? parseInt(estimatedYear) : null;
    const estimatedAreaSqm = estimatedArea ? estimatedArea * 3.305785 : null;

    const scored = records.map(row => {
      const result = scoreRecord(row, parsed, {
        estimatedYear: estimatedYearNum,
        estimatedAreaSqm,
      });
      return { ...row, _score: result.score, _matchType: result.matchType, _confidence: result.confidence, _normalizedScore: result.normalizedScore, _matchFactors: result.matchFactors };
    });

    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return (b.계약년월 || '').localeCompare(a.계약년월 || '');
    });

    console.log(`[검색] 상위 결과:`, scored.slice(0, 3).map(r => ({
      시군구: r.시군구, 지번: r.지번, 도로명: r.도로명, 거래금액: r.거래금액, score: r._score, matchType: r._matchType
    })));

    const minScore = parsed.hasJibunOrRoad ? 80 : 50;
    const validScored = scored.filter(r => r._score >= minScore);
    if (validScored.length === 0) return Response.json({ success: false, message: '유효한 매칭 없음' });

    const results = validScored.slice(0, 5).map(({ _score, _matchType, _confidence, _normalizedScore, _matchFactors, id, created_date, updated_date, created_by, ...row }) => {
      const rawPrice = (row.거래금액 || '0').toString().replace(/,/g, '').replace(/[^0-9]/g, '');
      const yyyymm = row.계약년월 || '';
      const 거래일 = yyyymm.length === 6
        ? `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}-${String(row.계약일 || '').padStart(2, '0')}`
        : null;

      return {
        건물명: row.대지위치_표제부 || row.도로명대지위치_표제부 || row.시군구,
        거래금액: parseInt(rawPrice) || 0,
        거래일,
        건축연도: row.건축년도 ? parseInt(row.건축년도) : null,
        전용면적: row.전용연면적 ? parseFloat(row.전용연면적) : null,
        층: row.층 || '',
        법정동: row.시군구,
        지번: row.지번,
        건축물주용도: row.건축물주용도,
        용도지역: row.용도지역,
        거래유형: row.거래유형,
        매칭점수: _score,
        매칭유형: _matchType,
        매칭신뢰도: _confidence,
        매칭점수_정규화: _normalizedScore,
        매칭요인: _matchFactors,
      };
    });

    return Response.json({ success: true, data: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});