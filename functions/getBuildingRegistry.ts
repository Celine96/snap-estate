/**
 * 건축물대장 표제부 API 연동
 * - 국토교통부 건축물대장 표제부(getBrTitleInfo) 조회
 * - 마스킹 지번 복원 (REXA 참고 3단계 매칭)
 */
import { fetchWithRetry, findSigunguCode, extractDong } from './addressUtils.ts';

const BR_API_URL = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo';

/** 법정동 코드 조회를 위한 API */
const BJDONG_API_URL = 'https://apis.data.go.kr/1613000/BldRgstHubService/getBrBasisOulnInfo';

interface BrTitleItem {
  platPlc: string;       // 대지위치
  newPlatPlc: string;    // 도로명대지위치
  bldNm: string;         // 건물명
  mainPurpsCdNm: string; // 주용도
  useAprDay: string;     // 사용승인일
  totArea: string;       // 연면적
  grndFlrCnt: string;    // 지상층수
  ugrndFlrCnt: string;   // 지하층수
  platArea: string;      // 대지면적
  bjdongCd: string;      // 법정동코드
  bun: string;           // 번 (본번)
  ji: string;            // 지 (부번)
}

interface RestoredJibun {
  jibun: string;
  buildingName: string | null;
  matchStage: number;    // 1=정확, 2=건축년도+면적, 3=오차범위
}

/**
 * 표제부 API에서 해당 동의 건물 목록 조회
 */
async function queryBrTitle(
  sigunguCode: string,
  bjdongCd: string,
  bun: string,
  ji: string,
  apiKey: string
): Promise<BrTitleItem[]> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    sigunguCd: sigunguCode,
    bjdongCd,
    numOfRows: '100',
    pageNo: '1',
  });

  // 본번/부번이 있으면 추가
  if (bun) params.set('bun', bun.padStart(4, '0'));
  if (ji) params.set('ji', ji.padStart(4, '0'));

  const response = await fetchWithRetry(`${BR_API_URL}?${params}`);
  const xmlText = await response.text();

  const items: BrTitleItem[] = [];
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);

  for (const match of itemMatches) {
    const xml = match[1];
    const get = (tag: string) => {
      const regex = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]+)\\]\\]><\\/${tag}>|<${tag}>([^<]*)<\\/${tag}>`);
      const m = xml.match(regex);
      return m ? (m[1] || m[2] || '').trim() : '';
    };

    items.push({
      platPlc: get('platPlc'),
      newPlatPlc: get('newPlatPlc'),
      bldNm: get('bldNm'),
      mainPurpsCdNm: get('mainPurpsCdNm'),
      useAprDay: get('useAprDay'),
      totArea: get('totArea'),
      grndFlrCnt: get('grndFlrCnt'),
      ugrndFlrCnt: get('ugrndFlrCnt'),
      platArea: get('platArea'),
      bjdongCd: get('bjdongCd'),
      bun: get('bun'),
      ji: get('ji'),
    });
  }

  return items;
}

/**
 * 법정동 코드 조회 (동 이름 → 코드)
 * 시군구 코드 + 동 이름으로 법정동 코드 추출
 */
async function findBjdongCode(sigunguCode: string, dongName: string, apiKey: string): Promise<string | null> {
  // 법정동 코드는 시군구코드(5자리) + 법정동코드(5자리) 구조
  // 일반적으로 건축물대장 API는 시군구코드와 별도 법정동코드를 요구
  // 동 코드를 알아내기 위해 기본 조회 후 bjdongCd 필드 사용

  // 간편 매핑: 대부분의 경우 동 이름으로 표제부를 검색해서 bjdongCd를 가져올 수 있음
  // 여기서는 빈 bjdongCd로 넓은 범위 조회 후 동 이름 필터링으로 대체
  return null;
}

/**
 * 마스킹 지번에서 본번/부번 후보 생성
 * 예: "1**" → 본번 100~199, "12*" → 본번 120~129
 */
function expandMaskedNumber(masked: string): { min: number; max: number } {
  const replaced = masked.replace(/\*/g, '0');
  const replacedMax = masked.replace(/\*/g, '9');
  return { min: parseInt(replaced), max: parseInt(replacedMax) };
}

function parseMaskedJibun(maskedJibun: string): { mainMasked: string; subMasked: string | null } {
  const parts = maskedJibun.split('-');
  return {
    mainMasked: parts[0],
    subMasked: parts.length > 1 ? parts[1] : null,
  };
}

/**
 * 마스킹 지번 복원 (3단계 매칭)
 *
 * @param opts.sigunguCode - 시군구 코드
 * @param opts.dong - 법정동명
 * @param opts.maskedJibun - 마스킹된 지번 (예: "1**", "12*-3")
 * @param opts.buildYear - 건축연도 (실거래 데이터)
 * @param opts.area - 전용면적 ㎡ (실거래 데이터)
 * @param opts.apiKey - 공공 API 키
 */
export async function restoreMaskedJibun(opts: {
  sigunguCode: string;
  dong: string | null;
  maskedJibun: string;
  buildYear: number | null;
  area: number | null;
  apiKey: string;
}): Promise<RestoredJibun | null> {
  const { sigunguCode, dong, maskedJibun, buildYear, area, apiKey } = opts;

  if (!maskedJibun || !maskedJibun.includes('*')) return null;

  const { mainMasked, subMasked } = parseMaskedJibun(maskedJibun);
  const mainRange = expandMaskedNumber(mainMasked);

  // 표제부 조회: 동 전체 건물 목록 (본번 범위로 필터)
  // bjdongCd를 모르므로 빈 값으로 조회하고 결과에서 동 이름 필터링
  let allItems: BrTitleItem[] = [];

  // 본번 범위가 좁으면(10개 이하) 개별 조회, 넓으면 전체 조회 후 필터
  if (mainRange.max - mainRange.min <= 10) {
    for (let bun = mainRange.min; bun <= mainRange.max; bun++) {
      try {
        const items = await queryBrTitle(sigunguCode, '', String(bun), '', apiKey);
        allItems = allItems.concat(items);
      } catch (_e) {
        // 개별 실패 무시
      }
    }
  } else {
    // 범위가 넓으면 동 전체 조회 시도 (API 제한으로 결과 적을 수 있음)
    try {
      allItems = await queryBrTitle(sigunguCode, '', '', '', apiKey);
    } catch (_e) {
      return null;
    }
  }

  // 동 이름으로 필터링
  if (dong) {
    allItems = allItems.filter(item => item.platPlc.includes(dong));
  }

  // 본번 범위 필터링
  allItems = allItems.filter(item => {
    const bun = parseInt(item.bun);
    return bun >= mainRange.min && bun <= mainRange.max;
  });

  // 부번 범위 필터링
  if (subMasked) {
    const subRange = expandMaskedNumber(subMasked);
    allItems = allItems.filter(item => {
      const ji = parseInt(item.ji) || 0;
      return ji >= subRange.min && ji <= subRange.max;
    });
  }

  if (allItems.length === 0) return null;

  // 1단계: 결과가 1건이면 정확 매칭
  if (allItems.length === 1) {
    const item = allItems[0];
    const jibun = formatJibun(item.bun, item.ji);
    return { jibun, buildingName: item.bldNm || null, matchStage: 1 };
  }

  // 2단계: 건축년도 + 연면적 정확 매칭
  if (buildYear && area) {
    const stage2 = allItems.filter(item => {
      const itemYear = item.useAprDay ? parseInt(item.useAprDay.substring(0, 4)) : null;
      const itemArea = item.totArea ? parseFloat(item.totArea) : null;
      return itemYear === buildYear && itemArea && Math.abs(itemArea - area) < 1;
    });
    if (stage2.length === 1) {
      const item = stage2[0];
      const jibun = formatJibun(item.bun, item.ji);
      return { jibun, buildingName: item.bldNm || null, matchStage: 2 };
    }
  }

  // 3단계: 오차범위 매칭 (건축년도 ±2년, 면적 ±10%)
  if (buildYear || area) {
    const stage3 = allItems.filter(item => {
      const itemYear = item.useAprDay ? parseInt(item.useAprDay.substring(0, 4)) : null;
      const itemArea = item.totArea ? parseFloat(item.totArea) : null;

      let yearOk = !buildYear; // 건축년도 없으면 패스
      if (buildYear && itemYear) {
        yearOk = Math.abs(buildYear - itemYear) <= 2;
      }

      let areaOk = !area; // 면적 없으면 패스
      if (area && itemArea) {
        areaOk = Math.abs(area - itemArea) / Math.max(area, itemArea) <= 0.10;
      }

      return yearOk && areaOk;
    });

    if (stage3.length === 1) {
      const item = stage3[0];
      const jibun = formatJibun(item.bun, item.ji);
      return { jibun, buildingName: item.bldNm || null, matchStage: 3 };
    }

    // 여러 건이면 면적이 가장 가까운 것 선택
    if (stage3.length > 1 && area) {
      stage3.sort((a, b) => {
        const aArea = parseFloat(a.totArea) || 0;
        const bArea = parseFloat(b.totArea) || 0;
        return Math.abs(area - aArea) - Math.abs(area - bArea);
      });
      const item = stage3[0];
      const jibun = formatJibun(item.bun, item.ji);
      return { jibun, buildingName: item.bldNm || null, matchStage: 3 };
    }
  }

  return null;
}

function formatJibun(bun: string, ji: string): string {
  const main = parseInt(bun) || 0;
  const sub = parseInt(ji) || 0;
  return sub > 0 ? `${main}-${sub}` : `${main}`;
}

// ── 서버 엔드포인트 (직접 조회용) ──

Deno.serve(async (req) => {
  try {
    const { address, sigunguCode: inputCode } = await req.json();
    const apiKey = Deno.env.get('Decoding_Api_Key');
    if (!apiKey) {
      return Response.json({ success: false, message: 'API 키 없음' }, { status: 500 });
    }

    const code = inputCode || findSigunguCode(address);
    if (!code) {
      return Response.json({ success: false, message: '시군구 코드 없음' });
    }

    const dong = extractDong(address || '');

    // 주소에서 본번/부번 추출
    const jibunMatch = (address || '').match(/(\d+)(?:-(\d+))?(?:\s*$|\s*번지)/);
    const bun = jibunMatch?.[1] || '';
    const ji = jibunMatch?.[2] || '';

    const items = await queryBrTitle(code, '', bun, ji, apiKey);
    const filtered = dong ? items.filter(i => i.platPlc.includes(dong)) : items;

    return Response.json({
      success: true,
      count: filtered.length,
      data: filtered.map(item => ({
        대지위치: item.platPlc,
        도로명: item.newPlatPlc,
        건물명: item.bldNm,
        주용도: item.mainPurpsCdNm,
        사용승인일: item.useAprDay,
        연면적: item.totArea ? parseFloat(item.totArea) : null,
        지상층수: item.grndFlrCnt ? parseInt(item.grndFlrCnt) : null,
        지하층수: item.ugrndFlrCnt ? parseInt(item.ugrndFlrCnt) : null,
        본번: parseInt(item.bun) || 0,
        부번: parseInt(item.ji) || 0,
      })),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
