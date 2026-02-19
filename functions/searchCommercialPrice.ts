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

// 주소/지번 문자열에서 순수 지번 숫자 추출 (예: "강남구 대치동 949번지" → "949", "949-12" → "949")
function extractJibun(address) {
  // 전체 주소에서 마지막 지번 패턴 추출
  const match = address.match(/(\d+(?:-\d+)?)\s*번지?$/);
  if (match) return match[1];
  // 지번만 있는 경우 (예: "949", "949-12")
  const simple = address.match(/^(\d+(?:-\d+)?)$/);
  if (simple) return simple[1];
  return null;
}

// 두 지번 문자열의 매칭 여부 (본번 기준)
function jibunMatches(inputJibun, recordJibun) {
  if (!inputJibun || !recordJibun) return false;
  const inputMain = inputJibun.split('-')[0];
  const recordMain = recordJibun.split('-')[0];
  return inputMain === recordMain;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { address, buildingType, estimatedYear, estimatedArea } = await req.json();

    if (!address) {
      return Response.json({ success: false, message: '주소 없음' });
    }

    const district = extractDistrict(address);
    const dong = extractDong(address);
    const inputJibun = extractJibun(address);

    console.log(`[QA] 검색: district=${district}, dong=${dong}, jibun=${inputJibun}`);

    if (!district) {
      return Response.json({ success: false, message: '지역구 식별 불가' });
    }

    // 동 수준 필터링 우선, 없으면 구 수준
    let records = [];
    const filterTarget = dong
      ? `${district} ${dong}`
      : district;

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

    // 동 필터로 결과 없으면 구 전체로 재시도
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

    // 해제된 거래 제외
    records = records.filter(r => !r.해제사유발생일 || r.해제사유발생일 === '-');

    console.log(`[QA] 후보 레코드 수: ${records.length}`);

    if (records.length === 0) {
      return Response.json({ success: false, message: '해당 지역 거래 데이터 없음' });
    }

    const estimatedYearNum = estimatedYear ? parseInt(estimatedYear) : null;
    const estimatedAreaSqm = estimatedArea ? estimatedArea * 3.305785 : null;

    const scored = records.map(row => {
      let score = 0;

      // ① 지번 매칭 (가장 높은 가중치)
      const rowJibun = extractJibun(row.지번 || '');
      const rowJibunFromLabel = extractJibun(row.대지위치_표제부 || '') 
                              || extractJibun(row.도로명대지위치_표제부 || '');

      if (inputJibun) {
        if (jibunMatches(inputJibun, rowJibun)) score += 100;
        else if (jibunMatches(inputJibun, rowJibunFromLabel)) score += 80;
      }

      // ② 동 매칭
      if (dong && (row.시군구 || '').includes(dong)) score += 30;

      // ③ 매칭단계 보너스 (정식 매칭된 데이터)
      if (row.매칭단계 && row.매칭단계 !== '매칭실패') score += 20;

      // ④ 건축연도 유사도
      const year = row.건축년도 ? parseInt(row.건축년도) : null;
      if (estimatedYearNum && year) {
        const diff = Math.abs(estimatedYearNum - year);
        score += Math.max(0, 15 - diff * 1.5);
      }

      // ⑤ 면적 유사도
      const area = row.전용연면적 ? parseFloat(row.전용연면적)
                  : row.대지면적 ? parseFloat(row.대지면적) : null;
      if (estimatedAreaSqm && area && area > 0) {
        const ratio = Math.abs(estimatedAreaSqm - area) / Math.max(estimatedAreaSqm, area);
        score += Math.max(0, 10 - ratio * 10);
      }

      return { ...row, _score: score };
    });

    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return (b.계약년월 || '').localeCompare(a.계약년월 || '');
    });

    console.log(`[QA] 상위 결과:`, scored.slice(0, 3).map(r => ({
      시군구: r.시군구, 지번: r.지번, 거래금액: r.거래금액, score: r._score
    })));

    const results = scored.slice(0, 5).map(({ _score, id, created_date, updated_date, created_by, ...row }) => {
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
        매칭점수: _score
      };
    });

    return Response.json({ success: true, data: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});