import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// 주소에서 동(洞) 추출
function extractDong(address) {
  const match = address.match(/([가-힣]+동\d*가?|[가-힣]+가\d*)/);
  return match?.[1] || null;
}

// 주소에서 구(區) 추출
function extractDistrict(address) {
  const match = address.match(/([가-힣]+구)/);
  return match?.[1] || null;
}

// 도로명 주소 여부 판단 (로/길 패턴)
function isRoadAddress(address) {
  return /[가-힣0-9]+(로|길)\s*\d/.test(address);
}

// 지번 주소에서 순수 지번 추출
function extractJibun(address) {
  if (!address) return null;

  // "번지" 앞 숫자 (예: "논현동 16-39번지" → "16-39")
  const withBunji = address.match(/(\d+(?:-\d+)?)\s*번지/);
  if (withBunji) return withBunji[1];

  // 마지막에 오는 순수 지번 패턴 (공백 뒤 숫자-숫자 or 숫자)
  const trailing = address.match(/(?:^|\s)(\d+(?:-\d+)?)(?:\s*$)/);
  if (trailing) return trailing[1];

  return null;
}

// 도로명이 아닌 순수 지번 주소에서만 지번 추출
function extractJibunFromAddress(address) {
  if (!address) return null;
  if (isRoadAddress(address)) return null;
  return extractJibun(address);
}

// "번지" 문자열 정규화 (레코드 지번 필드가 전체 주소 형태일 때 처리)
function normalizeBunji(str) {
  if (!str) return str;
  return str.replace(/번지\s*$/, '').trim();
}

// 두 지번 문자열 본번 기준 매칭
function jibunMatches(inputJibun, recordJibun) {
  if (!inputJibun || !recordJibun) return false;
  const inputMain = inputJibun.split('-')[0];
  const recordMain = recordJibun.split('-')[0];
  return inputMain === recordMain;
}

// 지번 정확 매칭 여부 (부번까지)
function jibunExactMatches(inputJibun, recordJibun) {
  if (!inputJibun || !recordJibun) return false;
  return inputJibun === recordJibun;
}

// 레코드에서 지번 후보들 추출 ("번지" 제거 후 순수 번호 추출)
function getJibunCandidates(row) {
  const candidates = [];
  const sources = [row.지번, row.대지위치_표제부, row.도로명대지위치_표제부];
  for (const s of sources) {
    if (!s) continue;
    // 먼저 "번지" 제거 후 순수 지번 추출 시도
    const normalized = normalizeBunji(s);
    const j = extractJibun(normalized) || extractJibun(s);
    if (j) candidates.push(j);
  }
  return candidates;
}

// 도로명에서 핵심 키 추출
function extractRoadKey(address) {
  const roadMatch = address.match(/([가-힣]+(?:\d+)?(?:로|길)(?:\d+길)?)\s*([\d-]+)/);
  return roadMatch ? `${roadMatch[1]} ${roadMatch[2]}`.trim() : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address, buildingType, estimatedYear, estimatedArea } = await req.json();

    if (!address) return Response.json({ success: false, message: '주소 없음' });

    const district = extractDistrict(address);
    const dong = extractDong(address);
    const inputJibun = extractJibunFromAddress(address);
    const roadAddr = isRoadAddress(address);
    const roadKey = roadAddr ? extractRoadKey(address) : null;

    console.log(`[검색] district=${district}, dong=${dong}, jibun=${inputJibun}, 도로명=${roadAddr}, roadKey=${roadKey}`);

    if (!district) return Response.json({ success: false, message: '지역구 식별 불가' });

    // ── 1차: 도로명 주소로 검색 ──
    let records = [];

    if (roadAddr && roadKey) {
      try {
        records = await base44.asServiceRole.entities.CommercialTransaction.filter(
          { 도로명: { $regex: roadKey } },
          '-계약년월',
          200
        );
      } catch (_e) {
        const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
        records = (all || []).filter(r => (r.도로명 || '').includes(roadKey));
      }
      records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');
      console.log(`[검색] 도로명 매칭 ${records.length}건`);
    }

    // ── 2차: 동/구 기반 검색 (도로명 결과 없거나 지번 주소일 때) ──
    if (records.length === 0) {
      const filterTarget = dong ? `${district} ${dong}` : district;
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

      // 동 기반 결과 없으면 구 전체로 확대
      if (records.length === 0 && dong) {
        try {
          records = await base44.asServiceRole.entities.CommercialTransaction.filter(
            { 시군구: { $regex: district } },
            '-계약년월',
            1000
          );
        } catch (_e) {
          const all = await base44.asServiceRole.entities.CommercialTransaction.list('-계약년월', 15000);
          records = (all || []).filter(r => (r.시군구 || '').includes(district));
        }
      }
      records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');
    }

    console.log(`[검색] 후보 ${records.length}건`);

    if (records.length === 0) return Response.json({ success: false, message: '해당 지역 거래 데이터 없음' });

    const estimatedYearNum = estimatedYear ? parseInt(estimatedYear) : null;
    const estimatedAreaSqm = estimatedArea ? estimatedArea * 3.305785 : null;
    const hasJibunOrRoad = !!(inputJibun || roadKey); // 지번/도로명 번호가 있는지 여부

    const scored = records.map(row => {
      let score = 0;
      let matchType = 'none'; // 매칭 유형 추적

      // ① 도로명 매칭
      if (roadKey) {
        const rowRoad = (row.도로명 || row.도로명대지위치_표제부 || '').replace(/\s*\([^)]+\)/, '').trim();
        if (rowRoad.includes(roadKey)) {
          score += 120;
          matchType = 'road_exact';
        }
      }

      // ② 지번 매칭
      if (inputJibun && matchType === 'none') {
        const inputHasSub = inputJibun.includes('-');
        const candidates = getJibunCandidates(row);
        for (const candidate of candidates) {
          if (jibunExactMatches(inputJibun, candidate)) {
            score += 120;
            matchType = 'jibun_exact';
            break;
          } else if (!inputHasSub && jibunMatches(inputJibun, candidate)) {
            score += 80;
            matchType = 'jibun_main';
            break;
          }
        }
      }

      // ③ 동 매칭 (지번/도로명 번호가 없는 경우 핵심 매칭으로 승격)
      const dongMatched = dong && (row.시군구 || '').includes(dong);
      if (dongMatched) {
        if (!hasJibunOrRoad && matchType === 'none') {
          // 지번 번호 없이 "강남구 논현동"만 있는 경우 → 동 매칭을 핵심으로 사용
          score += 50;
          matchType = 'dong_only';
        } else {
          score += 20;
        }
      }

      // 매칭 유형이 없으면 0점 처리
      if (matchType === 'none') return { ...row, _score: 0 };

      // ④ 매칭단계 보너스
      if (row.매칭단계 && row.매칭단계 !== '매칭실패') score += 10;

      // ⑤ 건축연도 유사도 (보조 점수)
      const year = row.건축년도 ? parseInt(row.건축년도) : null;
      if (estimatedYearNum && year) {
        const diff = Math.abs(estimatedYearNum - year);
        score += Math.max(0, 10 - diff);
      }

      // ⑥ 면적 유사도 (보조 점수)
      const area = row.전용연면적 ? parseFloat(row.전용연면적)
                  : row.대지면적 ? parseFloat(row.대지면적) : null;
      if (estimatedAreaSqm && area && area > 0) {
        const ratio = Math.abs(estimatedAreaSqm - area) / Math.max(estimatedAreaSqm, area);
        score += Math.max(0, 5 - ratio * 5);
      }

      return { ...row, _score: score, _matchType: matchType };
    });

    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return (b.계약년월 || '').localeCompare(a.계약년월 || '');
    });

    console.log(`[검색] 상위 결과:`, scored.slice(0, 3).map(r => ({
      시군구: r.시군구, 지번: r.지번, 도로명: r.도로명, 거래금액: r.거래금액, score: r._score, matchType: r._matchType
    })));

    // 매칭 유형별 최소 점수 기준
    // 지번/도로명 번호가 있을 때: 80점 이상 (정확한 매칭 요구)
    // 동만 있을 때: 50점 이상 (동 + 보조 점수로 최선의 결과 반환)
    const minScore = hasJibunOrRoad ? 80 : 50;
    const validScored = scored.filter(r => r._score >= minScore);
    if (validScored.length === 0) return Response.json({ success: false, message: '유효한 매칭 없음' });

    const results = validScored.slice(0, 5).map(({ _score, _matchType, id, created_date, updated_date, created_by, ...row }) => {
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
        매칭유형: _matchType
      };
    });

    return Response.json({ success: true, data: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});