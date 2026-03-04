import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import {
  extractDong, extractJibunSafe, findSigunguCode,
  scoreRecord, parseAddress, fetchWithRetry,
} from './addressUtils.ts';
import { restoreMaskedJibun } from './getBuildingRegistry.ts';

/**
 * 국토교통부 부동산 실거래가 조회 (건물 유형 자동 감지)
 * - 최근 2년간 월별 API 조회 (최신순 역순)
 * - 통합 스코어링 + 표제부 마스킹 지번 복원
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { address, buildingName, buildingType, estimatedYear, estimatedArea } = await req.json();

    const apiKey = Deno.env.get('Decoding_Api_Key');

    if (!apiKey) {
      return Response.json({
        success: false,
        message: 'API 키가 설정되지 않았습니다.'
      }, { status: 500 });
    }

    const sigunguCode = findSigunguCode(address);

    if (!sigunguCode) {
      return Response.json({
        success: false,
        message: '지원되는 지역이 아닙니다. (시군구 정보를 찾을 수 없습니다)',
        data: null
      });
    }

    // 건물 유형에 따른 API 엔드포인트 선택
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

    // 최근 2년간 월별 역순 조회 (최신 데이터 우선, 충분하면 조기 종료)
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

          let itemData: Record<string, any> = {};

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

      // 충분한 데이터 수집되면 조기 종료
      if (items.length >= 200) {
        console.log(`[국토부API] ${items.length}건 수집 완료, 조기 종료 (${i + 1}개월 조회)`);
        break;
      }
    }

    console.log(`[국토부API] 총 ${items.length}건 수집`);

    if (items.length === 0) {
      return Response.json({ success: false, message: '해당 지역 거래 데이터 없음', data: null });
    }

    // ── 마스킹 지번 복원 (표제부 연동) ──
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

    // ── 필터링 + 통합 스코어링 ──

    const parsed = parseAddress(address);
    const estimatedYearNum = estimatedYear ? parseInt(estimatedYear) : null;
    const estimatedAreaSqm = estimatedArea ? estimatedArea * 3.305785 : null;

    console.log(`[국토부API] 동=${parsed.dong}, 지번=${parsed.inputJibun}`);

    const scored = items.map(item => {
      // 국토부 API 결과는 시군구 필드 없이 법정동만 있으므로 매핑
      const row = { ...item, 시군구: item.법정동 || '' };
      const result = scoreRecord(row, parsed, {
        estimatedYear: estimatedYearNum,
        estimatedAreaSqm,
        buildingName,
      });
      return { ...item, _score: result.score, _matchType: result.matchType, _confidence: result.confidence, _normalizedScore: result.normalizedScore, _matchFactors: result.matchFactors };
    });

    // 점수순 + 최신순 정렬
    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return (b.거래일 || '').localeCompare(a.거래일 || '');
    });

    // 최소 점수 필터
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
