import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * 국토교통부 부동산 실거래가 조회 (건물 유형 자동 감지)
 * - 최근 2년간 월별 API 조회 (최신순 역순)
 * - 통합 스코어링 + 표제부 마스킹 지번 복원
 */

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

// ── 시군구 코드 ──

const SIGUNGU_ENTRIES = [
  ['서울', '종로구', '11110'], ['서울', '중구', '11140'], ['서울', '용산구', '11170'],
  ['서울', '성동구', '11200'], ['서울', '광진구', '11215'], ['서울', '동대문구', '11230'],
  ['서울', '중랑구', '11260'], ['서울', '성북구', '11290'], ['서울', '강북구', '11305'],
  ['서울', '도봉구', '11320'], ['서울', '노원구', '11350'], ['서울', '은평구', '11380'],
  ['서울', '서대문구', '11410'], ['서울', '마포구', '11440'], ['서울', '양천구', '11470'],
  ['서울', '강서구', '11500'], ['서울', '구로구', '11530'], ['서울', '금천구', '11545'],
  ['서울', '영등포구', '11560'], ['서울', '동작구', '11590'], ['서울', '관악구', '11620'],
  ['서울', '서초구', '11650'], ['서울', '강남구', '11680'], ['서울', '송파구', '11710'],
  ['서울', '강동구', '11740'],
  ['부산', '중구', '26110'], ['부산', '서구', '26140'], ['부산', '동구', '26170'],
  ['부산', '영도구', '26200'], ['부산', '부산진구', '26230'], ['부산', '동래구', '26260'],
  ['부산', '남구', '26290'], ['부산', '북구', '26320'], ['부산', '해운대구', '26350'],
  ['부산', '사하구', '26380'], ['부산', '금정구', '26410'], ['부산', '강서구', '26440'],
  ['부산', '연제구', '26470'], ['부산', '수영구', '26500'], ['부산', '사상구', '26530'],
  ['부산', '기장군', '26710'],
  ['대구', '중구', '27110'], ['대구', '동구', '27140'], ['대구', '서구', '27170'],
  ['대구', '남구', '27200'], ['대구', '북구', '27230'], ['대구', '수성구', '27260'],
  ['대구', '달서구', '27290'], ['대구', '달성군', '27710'],
  ['인천', '중구', '28110'], ['인천', '동구', '28140'], ['인천', '미추홀구', '28177'],
  ['인천', '연수구', '28185'], ['인천', '남동구', '28200'], ['인천', '부평구', '28237'],
  ['인천', '계양구', '28245'], ['인천', '서구', '28260'], ['인천', '강화군', '28710'],
  ['인천', '옹진군', '28720'],
  ['광주', '동구', '29110'], ['광주', '서구', '29140'], ['광주', '남구', '29155'],
  ['광주', '북구', '29170'], ['광주', '광산구', '29200'],
  ['대전', '동구', '30110'], ['대전', '중구', '30140'], ['대전', '서구', '30170'],
  ['대전', '유성구', '30200'], ['대전', '대덕구', '30230'],
  ['울산', '중구', '31110'], ['울산', '남구', '31140'], ['울산', '동구', '31170'],
  ['울산', '북구', '31200'], ['울산', '울주군', '31710'],
  ['세종', '세종시', '36110'],
  ['경기', '수원시', '41110'], ['경기', '성남시', '41130'], ['경기', '의정부시', '41150'],
  ['경기', '안양시', '41170'], ['경기', '부천시', '41190'], ['경기', '광명시', '41210'],
  ['경기', '평택시', '41220'], ['경기', '동두천시', '41250'], ['경기', '안산시', '41270'],
  ['경기', '고양시', '41280'], ['경기', '과천시', '41290'], ['경기', '구리시', '41310'],
  ['경기', '남양주시', '41360'], ['경기', '오산시', '41370'], ['경기', '시흥시', '41390'],
  ['경기', '군포시', '41410'], ['경기', '의왕시', '41430'], ['경기', '하남시', '41450'],
  ['경기', '용인시', '41460'], ['경기', '파주시', '41480'], ['경기', '이천시', '41500'],
  ['경기', '안성시', '41550'], ['경기', '김포시', '41570'], ['경기', '화성시', '41590'],
  ['경기', '광주시', '41610'], ['경기', '양주시', '41630'], ['경기', '포천시', '41650'],
  ['경기', '여주시', '41670'], ['경기', '연천군', '41800'], ['경기', '가평군', '41820'],
  ['경기', '양평군', '41830'],
  ['강원', '춘천시', '42110'], ['강원', '원주시', '42130'], ['강원', '강릉시', '42150'],
  ['강원', '동해시', '42170'], ['강원', '태백시', '42190'], ['강원', '속초시', '42210'],
  ['강원', '삼척시', '42230'],
  ['충북', '청주시', '43110'], ['충북', '충주시', '43130'], ['충북', '제천시', '43150'],
  ['충남', '천안시', '44130'], ['충남', '공주시', '44150'], ['충남', '보령시', '44180'],
  ['충남', '아산시', '44200'], ['충남', '서산시', '44210'], ['충남', '논산시', '44230'],
  ['충남', '당진시', '44270'],
  ['전북', '전주시', '45110'], ['전북', '군산시', '45130'], ['전북', '익산시', '45140'],
  ['전남', '목포시', '46110'], ['전남', '여수시', '46130'], ['전남', '순천시', '46150'],
  ['경북', '포항시', '47110'], ['경북', '경주시', '47130'], ['경북', '김천시', '47150'],
  ['경북', '안동시', '47170'], ['경북', '구미시', '47190'],
  ['경남', '창원시', '48120'], ['경남', '진주시', '48170'], ['경남', '통영시', '48220'],
  ['경남', '사천시', '48240'], ['경남', '김해시', '48250'], ['경남', '밀양시', '48270'],
  ['경남', '거제시', '48310'], ['경남', '양산시', '48330'],
  ['제주', '제주시', '50110'], ['제주', '서귀포시', '50130'],
];

const CITY_ALIASES = {
  '서울특별시': '서울', '서울시': '서울', '서울': '서울',
  '부산광역시': '부산', '부산시': '부산', '부산': '부산',
  '대구광역시': '대구', '대구시': '대구', '대구': '대구',
  '인천광역시': '인천', '인천시': '인천', '인천': '인천',
  '광주광역시': '광주', '광주시': '광주', '광주': '광주',
  '대전광역시': '대전', '대전시': '대전', '대전': '대전',
  '울산광역시': '울산', '울산시': '울산', '울산': '울산',
  '세종특별자치시': '세종', '세종시': '세종', '세종': '세종',
  '경기도': '경기', '경기': '경기',
  '강원특별자치도': '강원', '강원도': '강원', '강원': '강원',
  '충청북도': '충북', '충북': '충북',
  '충청남도': '충남', '충남': '충남',
  '전라북도': '전북', '전북특별자치도': '전북', '전북': '전북',
  '전라남도': '전남', '전남': '전남',
  '경상북도': '경북', '경북': '경북',
  '경상남도': '경남', '경남': '경남',
  '제주특별자치도': '제주', '제주도': '제주', '제주': '제주',
};

function findSigunguCode(address) {
  if (!address) return null;

  let cityKey = null;
  for (const [alias, normalized] of Object.entries(CITY_ALIASES)) {
    if (address.includes(alias)) {
      cityKey = normalized;
      break;
    }
  }

  const guMatch = address.match(/([가-힣]+(?:구|시|군))/g);
  if (!guMatch) return null;

  for (const gu of guMatch) {
    for (const [city, district, code] of SIGUNGU_ENTRIES) {
      if (district === gu) {
        if (!cityKey || city === cityKey) {
          return code;
        }
      }
    }
  }

  for (const gu of guMatch) {
    const matches = SIGUNGU_ENTRIES.filter(([, d]) => d === gu);
    if (matches.length === 1) return matches[0][2];
  }

  return null;
}

// ── fetch with retry ──

async function fetchWithRetry(url, options = {}, maxRetries = 2, timeoutMs = 8000) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (response.status >= 500 && attempt < maxRetries) {
        lastError = new Error(`HTTP ${response.status}`);
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('fetchWithRetry failed');
}

// ── 표제부 마스킹 지번 복원 ──

const BR_API_URL = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo';

async function queryBrTitle(sigunguCode, bjdongCd, bun, ji, apiKey) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    sigunguCd: sigunguCode,
    bjdongCd: bjdongCd || '',
    numOfRows: '100',
    pageNo: '1',
  });

  if (bun) params.set('bun', bun.toString().padStart(4, '0'));
  if (ji) params.set('ji', ji.toString().padStart(4, '0'));

  const response = await fetchWithRetry(`${BR_API_URL}?${params}`);
  const xmlText = await response.text();

  const items = [];
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const xml = match[1];
    const get = (tag) => {
      const regex = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]+)\\]\\]><\\/${tag}>|<${tag}>([^<]*)<\\/${tag}>`);
      const m = xml.match(regex);
      return m ? (m[1] || m[2] || '').trim() : '';
    };

    items.push({
      platPlc: get('platPlc'),
      newPlatPlc: get('newPlatPlc'),
      bldNm: get('bldNm'),
      useAprDay: get('useAprDay'),
      totArea: get('totArea'),
      bun: get('bun'),
      ji: get('ji'),
    });
  }

  return items;
}

function expandMaskedNumber(masked) {
  const replaced = masked.replace(/\*/g, '0');
  const replacedMax = masked.replace(/\*/g, '9');
  return { min: parseInt(replaced), max: parseInt(replacedMax) };
}

function formatJibun(bun, ji) {
  const main = parseInt(bun) || 0;
  const sub = parseInt(ji) || 0;
  return sub > 0 ? `${main}-${sub}` : `${main}`;
}

async function restoreMaskedJibun(opts) {
  const { sigunguCode, dong, maskedJibun, buildYear, area, apiKey } = opts;

  if (!maskedJibun || !maskedJibun.includes('*')) return null;

  const parts = maskedJibun.split('-');
  const mainMasked = parts[0];
  const subMasked = parts.length > 1 ? parts[1] : null;
  const mainRange = expandMaskedNumber(mainMasked);

  let allItems = [];

  if (mainRange.max - mainRange.min <= 10) {
    for (let bun = mainRange.min; bun <= mainRange.max; bun++) {
      try {
        const items = await queryBrTitle(sigunguCode, '', String(bun), '', apiKey);
        allItems = allItems.concat(items);
      } catch (_e) {
        // ignore
      }
    }
  } else {
    try {
      allItems = await queryBrTitle(sigunguCode, '', '', '', apiKey);
    } catch (_e) {
      return null;
    }
  }

  if (dong) {
    allItems = allItems.filter(item => item.platPlc.includes(dong));
  }

  allItems = allItems.filter(item => {
    const bun = parseInt(item.bun);
    return bun >= mainRange.min && bun <= mainRange.max;
  });

  if (subMasked) {
    const subRange = expandMaskedNumber(subMasked);
    allItems = allItems.filter(item => {
      const ji = parseInt(item.ji) || 0;
      return ji >= subRange.min && ji <= subRange.max;
    });
  }

  if (allItems.length === 0) return null;

  if (allItems.length === 1) {
    const item = allItems[0];
    return { jibun: formatJibun(item.bun, item.ji), buildingName: item.bldNm || null, matchStage: 1 };
  }

  if (buildYear && area) {
    const stage2 = allItems.filter(item => {
      const itemYear = item.useAprDay ? parseInt(item.useAprDay.substring(0, 4)) : null;
      const itemArea = item.totArea ? parseFloat(item.totArea) : null;
      return itemYear === buildYear && itemArea && Math.abs(itemArea - area) < 1;
    });
    if (stage2.length === 1) {
      const item = stage2[0];
      return { jibun: formatJibun(item.bun, item.ji), buildingName: item.bldNm || null, matchStage: 2 };
    }
  }

  if (buildYear || area) {
    const stage3 = allItems.filter(item => {
      const itemYear = item.useAprDay ? parseInt(item.useAprDay.substring(0, 4)) : null;
      const itemArea = item.totArea ? parseFloat(item.totArea) : null;
      let yearOk = !buildYear;
      if (buildYear && itemYear) yearOk = Math.abs(buildYear - itemYear) <= 2;
      let areaOk = !area;
      if (area && itemArea) areaOk = Math.abs(area - itemArea) / Math.max(area, itemArea) <= 0.10;
      return yearOk && areaOk;
    });

    if (stage3.length === 1) {
      const item = stage3[0];
      return { jibun: formatJibun(item.bun, item.ji), buildingName: item.bldNm || null, matchStage: 3 };
    }

    if (stage3.length > 1 && area) {
      stage3.sort((a, b) => {
        const aArea = parseFloat(a.totArea) || 0;
        const bArea = parseFloat(b.totArea) || 0;
        return Math.abs(area - aArea) - Math.abs(area - bArea);
      });
      const item = stage3[0];
      return { jibun: formatJibun(item.bun, item.ji), buildingName: item.bldNm || null, matchStage: 3 };
    }
  }

  return null;
}

// ── 메인 핸들러 ──

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { address, buildingName, buildingType, estimatedYear, estimatedArea } = await req.json();

    const apiKey = Deno.env.get('Decoding_Api_Key');

    if (!apiKey) {
      return Response.json({ success: false, message: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    const sigunguCode = findSigunguCode(address);

    if (!sigunguCode) {
      return Response.json({
        success: false,
        message: '지원되는 지역이 아닙니다. (시군구 정보를 찾을 수 없습니다)',
        data: null
      });
    }

    let serviceName = '';
    let apiEndpoint = '';

    if (buildingType === '아파트') {
      serviceName = 'RTMSDataSvcAptTradeDev';
      apiEndpoint = 'getRTMSDataSvcAptTradeDev';
    } else if (buildingType === '오피스텔') {
      serviceName = 'RTMSDataSvcOffiTrade';
      apiEndpoint = 'getRTMSDataSvcOffiTrade';
    } else if (buildingType === '상가' || buildingType === '오피스') {
      serviceName = 'RTMSDataSvcNrgTrade';
      apiEndpoint = 'getRTMSDataSvcNrgTrade';
    } else if (buildingType === '빌라/다세대' || buildingType === '단독주택') {
      serviceName = 'RTMSDataSvcRHTrade';
      apiEndpoint = 'getRTMSDataSvcRHTrade';
    } else {
      serviceName = 'RTMSDataSvcNrgTrade';
      apiEndpoint = 'getRTMSDataSvcNrgTrade';
    }

    const url = `https://apis.data.go.kr/1613000/${serviceName}/${apiEndpoint}`;
    const items = [];

    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth() + 1;
    const MONTHS_TO_SEARCH = 24;

    console.log(`[국토부API] ${url} | 시군구=${sigunguCode} | 유형=${buildingType} | 최근 ${MONTHS_TO_SEARCH}개월`);

    for (let i = 0; i < MONTHS_TO_SEARCH; i++) {
      let y = endYear;
      let m = endMonth - i;
      while (m <= 0) { m += 12; y--; }
      const dealYmd = `${y}${String(m).padStart(2, '0')}`;

      const params = new URLSearchParams({
        serviceKey: apiKey,
        LAWD_CD: sigunguCode,
        DEAL_YMD: dealYmd,
        numOfRows: '100',
        pageNo: '1'
      });

      try {
        const response = await fetchWithRetry(`${url}?${params}`);
        const xmlText = await response.text();

        const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);

        for (const match of itemMatches) {
          const itemXml = match[1];

          const getTagValue = (tag) => {
            const regex = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]+)\\]\\]><\\/${tag}>|<${tag}>([^<]*)<\\/${tag}>`);
            const m = itemXml.match(regex);
            return m ? (m[1] || m[2] || '').trim() : '';
          };

          let itemData = {};

          if (buildingType === '아파트') {
            itemData = {
              건물명: getTagValue('aptNm') || getTagValue('아파트'),
              거래금액: getTagValue('dealAmount') || getTagValue('거래금액'),
              건축연도: getTagValue('buildYear') || getTagValue('건축년도'),
              층: getTagValue('floor') || getTagValue('층'),
              전용면적: getTagValue('excluUseAr') || getTagValue('excluUseArea') || getTagValue('전용면적'),
              거래일: `${getTagValue('dealYear') || getTagValue('년')}-${getTagValue('dealMonth') || getTagValue('월')}-${getTagValue('dealDay') || getTagValue('일')}`,
              법정동: getTagValue('umdNm') || getTagValue('법정동'),
              지번: getTagValue('jibun') || getTagValue('지번'),
              용도: '아파트'
            };
          } else if (buildingType === '오피스텔') {
            itemData = {
              건물명: getTagValue('offiNm') || getTagValue('단지'),
              거래금액: getTagValue('dealAmount') || getTagValue('거래금액'),
              건축연도: getTagValue('buildYear') || getTagValue('건축년도'),
              층: getTagValue('floor') || getTagValue('층'),
              전용면적: getTagValue('excluUseAr') || getTagValue('excluUseArea') || getTagValue('전용면적'),
              거래일: `${getTagValue('dealYear') || getTagValue('년')}-${getTagValue('dealMonth') || getTagValue('월')}-${getTagValue('dealDay') || getTagValue('일')}`,
              법정동: getTagValue('umdNm') || getTagValue('법정동'),
              지번: getTagValue('jibun') || getTagValue('지번'),
              용도: '오피스텔'
            };
          } else {
            itemData = {
              건물명: '',
              거래금액: getTagValue('dealAmount'),
              건축연도: getTagValue('buildYear'),
              층: getTagValue('floor'),
              전용면적: getTagValue('buildingAr'),
              거래일: `${getTagValue('dealYear')}-${getTagValue('dealMonth')}-${getTagValue('dealDay')}`,
              법정동: getTagValue('umdNm'),
              지번: getTagValue('jibun'),
              건물유형: getTagValue('buildingType'),
              건물주용도: getTagValue('buildingUse'),
              용도: getTagValue('buildingUse') || buildingType
            };
          }

          if (itemData.거래금액) {
            items.push(itemData);
          }
        }
      } catch (error) {
        console.log(`${dealYmd} 조회 실패:`, error.message);
      }

      if (items.length >= 200) {
        console.log(`[국토부API] ${items.length}건 수집 완료, 조기 종료 (${i + 1}개월 조회)`);
        break;
      }
    }

    console.log(`[국토부API] 총 ${items.length}건 수집`);

    if (items.length === 0) {
      return Response.json({ success: false, message: '해당 지역 거래 데이터 없음', data: null });
    }

    // 마스킹 지번 복원
    const maskedItems = items.filter(item => item.지번 && item.지번.includes('*'));
    if (maskedItems.length > 0) {
      console.log(`[국토부API] 마스킹 지번 ${maskedItems.length}건 복원 시도`);
      for (const item of maskedItems) {
        try {
          const restored = await restoreMaskedJibun({
            sigunguCode,
            dong: item.법정동,
            maskedJibun: item.지번,
            buildYear: item.건축연도 ? parseInt(item.건축연도) : null,
            area: item.전용면적 ? parseFloat(item.전용면적) : null,
            apiKey,
          });
          if (restored) {
            item.지번_원본 = item.지번;
            item.지번 = restored.jibun;
            if (restored.buildingName) item.건물명_표제부 = restored.buildingName;
            console.log(`[표제부] 복원: ${item.지번_원본} → ${item.지번}`);
          }
        } catch (e) {
          console.log(`[표제부] 복원 실패 (${item.지번}):`, e.message);
        }
      }
    }

    const parsed = parseAddress(address);
    const estimatedYearNum = estimatedYear ? parseInt(estimatedYear) : null;
    const estimatedAreaSqm = estimatedArea ? estimatedArea * 3.305785 : null;

    console.log(`[국토부API] 동=${parsed.dong}, 지번=${parsed.inputJibun}`);

    const scored = items.map(item => {
      const row = { ...item, 시군구: item.법정동 || '' };
      const result = scoreRecord(row, parsed, {
        estimatedYear: estimatedYearNum,
        estimatedAreaSqm,
        buildingName,
      });
      return { ...item, _score: result.score, _matchType: result.matchType, _confidence: result.confidence, _normalizedScore: result.normalizedScore, _matchFactors: result.matchFactors };
    });

    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return (b.거래일 || '').localeCompare(a.거래일 || '');
    });

    const minScore = parsed.inputJibun ? 50 : (parsed.dong ? 50 : 0);
    const validItems = scored.filter(r => r._score >= minScore);

    console.log(`[국토부API] 상위:`, (validItems.length > 0 ? validItems : scored).slice(0, 3).map(r => ({
      건물명: r.건물명, 법정동: r.법정동, 지번: r.지번, 거래금액: r.거래금액, score: r._score, confidence: r._confidence
    })));

    const results = (validItems.length > 0 ? validItems : scored).slice(0, 10)
      .map(({ _score, _matchType, _confidence, _normalizedScore, _matchFactors, ...item }) => ({
        ...item,
        매칭신뢰도: _confidence,
        매칭점수_정규화: _normalizedScore,
        매칭요인: _matchFactors,
      }));

    return Response.json({
      success: true,
      message: `${results.length}건의 실거래가 데이터를 찾았습니다.`,
      buildingType,
      totalCount: items.length,
      filteredCount: results.length,
      data: results
    });

  } catch (error) {
    console.error('실거래가 조회 오류:', error);
    return Response.json({
      success: false,
      message: `API 호출 오류: ${error.message}`,
      data: null
    }, { status: 500 });
  }
});