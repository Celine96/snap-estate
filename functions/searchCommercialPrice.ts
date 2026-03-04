import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { parseAddress, scoreRecord } from './addressUtils.ts';

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

    // ── 1차: 도로명 주소로 검색 ──
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

    // ── 2차: 동/구 기반 검색 (도로명 결과 없거나 지번 주소일 때) ──
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

      // 동 기반 결과 없으면 구 전체로 확대
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

    // 매칭 유형별 최소 점수 기준
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
