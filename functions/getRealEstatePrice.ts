import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * 국토교통부 부동산 실거래가 조회 (건물 유형 자동 감지)
 * - 최근 2년간 월별 API 조회 (최신순 역순)
 * - 동+지번 매칭으로 정확도 향상
 * - 시군구 코드 중복 키 해결 (시도명 prefix 사용)
 */

// ── 주소 파싱 유틸 ──

function extractDong(address) {
  const match = address.match(/([가-힣]+동\d*가?|[가-힣]+가\d*)/);
  return match?.[1] || null;
}

function extractJibun(address) {
  if (!address) return null;
  const withBunji = address.match(/(\d+(?:-\d+)?)\s*번지/);
  if (withBunji) return withBunji[1];
  const trailing = address.match(/(?:^|\s)(\d+(?:-\d+)?)(?:\s*$)/);
  if (trailing) return trailing[1];
  return null;
}

// ── 시군구 코드 맵 (시도명 prefix로 중복 키 해소) ──

const SIGUNGU_ENTRIES = [
  // 서울
  ['서울', '종로구', '11110'], ['서울', '중구', '11140'], ['서울', '용산구', '11170'],
  ['서울', '성동구', '11200'], ['서울', '광진구', '11215'], ['서울', '동대문구', '11230'],
  ['서울', '중랑구', '11260'], ['서울', '성북구', '11290'], ['서울', '강북구', '11305'],
  ['서울', '도봉구', '11320'], ['서울', '노원구', '11350'], ['서울', '은평구', '11380'],
  ['서울', '서대문구', '11410'], ['서울', '마포구', '11440'], ['서울', '양천구', '11470'],
  ['서울', '강서구', '11500'], ['서울', '구로구', '11530'], ['서울', '금천구', '11545'],
  ['서울', '영등포구', '11560'], ['서울', '동작구', '11590'], ['서울', '관악구', '11620'],
  ['서울', '서초구', '11650'], ['서울', '강남구', '11680'], ['서울', '송파구', '11710'],
  ['서울', '강동구', '11740'],
  // 부산
  ['부산', '중구', '26110'], ['부산', '서구', '26140'], ['부산', '동구', '26170'],
  ['부산', '영도구', '26200'], ['부산', '부산진구', '26230'], ['부산', '동래구', '26260'],
  ['부산', '남구', '26290'], ['부산', '북구', '26320'], ['부산', '해운대구', '26350'],
  ['부산', '사하구', '26380'], ['부산', '금정구', '26410'], ['부산', '강서구', '26440'],
  ['부산', '연제구', '26470'], ['부산', '수영구', '26500'], ['부산', '사상구', '26530'],
  ['부산', '기장군', '26710'],
  // 대구
  ['대구', '중구', '27110'], ['대구', '동구', '27140'], ['대구', '서구', '27170'],
  ['대구', '남구', '27200'], ['대구', '북구', '27230'], ['대구', '수성구', '27260'],
  ['대구', '달서구', '27290'], ['대구', '달성군', '27710'],
  // 인천
  ['인천', '중구', '28110'], ['인천', '동구', '28140'], ['인천', '미추홀구', '28177'],
  ['인천', '연수구', '28185'], ['인천', '남동구', '28200'], ['인천', '부평구', '28237'],
  ['인천', '계양구', '28245'], ['인천', '서구', '28260'], ['인천', '강화군', '28710'],
  ['인천', '옹진군', '28720'],
  // 광주
  ['광주', '동구', '29110'], ['광주', '서구', '29140'], ['광주', '남구', '29155'],
  ['광주', '북구', '29170'], ['광주', '광산구', '29200'],
  // 대전
  ['대전', '동구', '30110'], ['대전', '중구', '30140'], ['대전', '서구', '30170'],
  ['대전', '유성구', '30200'], ['대전', '대덕구', '30230'],
  // 울산
  ['울산', '중구', '31110'], ['울산', '남구', '31140'], ['울산', '동구', '31170'],
  ['울산', '북구', '31200'], ['울산', '울주군', '31710'],
  // 세종
  ['세종', '세종시', '36110'],
  // 경기
  ['경기', '수원시', '41110'], ['경기', '장안구', '41111'], ['경기', '권선구', '41113'],
  ['경기', '팔달구', '41115'], ['경기', '영통구', '41117'], ['경기', '성남시', '41130'],
  ['경기', '수정구', '41131'], ['경기', '중원구', '41133'], ['경기', '분당구', '41135'],
  ['경기', '의정부시', '41150'], ['경기', '안양시', '41170'], ['경기', '만안구', '41171'],
  ['경기', '동안구', '41173'], ['경기', '부천시', '41190'], ['경기', '광명시', '41210'],
  ['경기', '평택시', '41220'], ['경기', '동두천시', '41250'], ['경기', '안산시', '41270'],
  ['경기', '상록구', '41271'], ['경기', '단원구', '41273'], ['경기', '고양시', '41280'],
  ['경기', '덕양구', '41281'], ['경기', '일산동구', '41285'], ['경기', '일산서구', '41287'],
  ['경기', '과천시', '41290'], ['경기', '구리시', '41310'], ['경기', '남양주시', '41360'],
  ['경기', '오산시', '41370'], ['경기', '시흥시', '41390'], ['경기', '군포시', '41410'],
  ['경기', '의왕시', '41430'], ['경기', '하남시', '41450'], ['경기', '용인시', '41460'],
  ['경기', '처인구', '41461'], ['경기', '기흥구', '41463'], ['경기', '수지구', '41465'],
  ['경기', '파주시', '41480'], ['경기', '이천시', '41500'], ['경기', '안성시', '41550'],
  ['경기', '김포시', '41570'], ['경기', '화성시', '41590'], ['경기', '광주시', '41610'],
  ['경기', '양주시', '41630'], ['경기', '포천시', '41650'], ['경기', '여주시', '41670'],
  ['경기', '연천군', '41800'], ['경기', '가평군', '41820'], ['경기', '양평군', '41830'],
  // 강원
  ['강원', '춘천시', '42110'], ['강원', '원주시', '42130'], ['강원', '강릉시', '42150'],
  ['강원', '동해시', '42170'], ['강원', '태백시', '42190'], ['강원', '속초시', '42210'],
  ['강원', '삼척시', '42230'], ['강원', '홍천군', '42720'], ['강원', '횡성군', '42730'],
  ['강원', '영월군', '42750'], ['강원', '평창군', '42760'], ['강원', '정선군', '42770'],
  ['강원', '철원군', '42780'], ['강원', '화천군', '42790'], ['강원', '양구군', '42800'],
  ['강원', '인제군', '42810'], ['강원', '고성군', '42820'], ['강원', '양양군', '42830'],
  // 충북
  ['충북', '청주시', '43110'], ['충북', '상당구', '43111'], ['충북', '서원구', '43112'],
  ['충북', '흥덕구', '43113'], ['충북', '청원구', '43114'], ['충북', '충주시', '43130'],
  ['충북', '제천시', '43150'], ['충북', '보은군', '43720'], ['충북', '옥천군', '43730'],
  ['충북', '영동군', '43740'], ['충북', '증평군', '43745'], ['충북', '진천군', '43750'],
  ['충북', '괴산군', '43760'], ['충북', '음성군', '43770'], ['충북', '단양군', '43800'],
  // 충남
  ['충남', '천안시', '44130'], ['충남', '동남구', '44131'], ['충남', '서북구', '44133'],
  ['충남', '공주시', '44150'], ['충남', '보령시', '44180'], ['충남', '아산시', '44200'],
  ['충남', '서산시', '44210'], ['충남', '논산시', '44230'], ['충남', '계룡시', '44250'],
  ['충남', '당진시', '44270'], ['충남', '금산군', '44710'], ['충남', '부여군', '44760'],
  ['충남', '서천군', '44770'], ['충남', '청양군', '44790'], ['충남', '홍성군', '44800'],
  ['충남', '예산군', '44810'], ['충남', '태안군', '44825'],
  // 전북
  ['전북', '전주시', '45110'], ['전북', '완산구', '45111'], ['전북', '덕진구', '45113'],
  ['전북', '군산시', '45130'], ['전북', '익산시', '45140'], ['전북', '정읍시', '45180'],
  ['전북', '남원시', '45190'], ['전북', '김제시', '45210'], ['전북', '완주군', '45710'],
  ['전북', '진안군', '45720'], ['전북', '무주군', '45730'], ['전북', '장수군', '45740'],
  ['전북', '임실군', '45750'], ['전북', '순창군', '45770'], ['전북', '고창군', '45790'],
  ['전북', '부안군', '45800'],
  // 전남
  ['전남', '목포시', '46110'], ['전남', '여수시', '46130'], ['전남', '순천시', '46150'],
  ['전남', '나주시', '46170'], ['전남', '광양시', '46230'], ['전남', '담양군', '46710'],
  ['전남', '곡성군', '46720'], ['전남', '구례군', '46730'], ['전남', '고흥군', '46770'],
  ['전남', '보성군', '46780'], ['전남', '화순군', '46790'], ['전남', '장흥군', '46800'],
  ['전남', '강진군', '46810'], ['전남', '해남군', '46820'], ['전남', '영암군', '46830'],
  ['전남', '무안군', '46840'], ['전남', '함평군', '46860'], ['전남', '영광군', '46870'],
  ['전남', '장성군', '46880'], ['전남', '완도군', '46890'], ['전남', '진도군', '46900'],
  ['전남', '신안군', '46910'],
  // 경북
  ['경북', '포항시', '47110'], ['경북', '남구', '47111'], ['경북', '북구', '47113'],
  ['경북', '경주시', '47130'], ['경북', '김천시', '47150'], ['경북', '안동시', '47170'],
  ['경북', '구미시', '47190'], ['경북', '영주시', '47210'], ['경북', '영천시', '47230'],
  ['경북', '상주시', '47250'], ['경북', '문경시', '47280'], ['경북', '경산시', '47290'],
  ['경북', '군위군', '47720'], ['경북', '의성군', '47730'], ['경북', '청송군', '47750'],
  ['경북', '영양군', '47760'], ['경북', '영덕군', '47770'], ['경북', '청도군', '47820'],
  ['경북', '고령군', '47830'], ['경북', '성주군', '47840'], ['경북', '칠곡군', '47850'],
  ['경북', '예천군', '47900'], ['경북', '봉화군', '47920'], ['경북', '울진군', '47930'],
  ['경북', '울릉군', '47940'],
  // 경남
  ['경남', '창원시', '48120'], ['경남', '의창구', '48121'], ['경남', '성산구', '48123'],
  ['경남', '마산합포구', '48125'], ['경남', '마산회원구', '48127'], ['경남', '진해구', '48129'],
  ['경남', '진주시', '48170'], ['경남', '통영시', '48220'], ['경남', '사천시', '48240'],
  ['경남', '김해시', '48250'], ['경남', '밀양시', '48270'], ['경남', '거제시', '48310'],
  ['경남', '양산시', '48330'], ['경남', '의령군', '48720'], ['경남', '함안군', '48730'],
  ['경남', '창녕군', '48740'], ['경남', '고성군', '48820'], ['경남', '남해군', '48840'],
  ['경남', '하동군', '48850'], ['경남', '산청군', '48860'], ['경남', '함양군', '48870'],
  ['경남', '거창군', '48880'], ['경남', '합천군', '48890'],
  // 제주
  ['제주', '제주시', '50110'], ['제주', '서귀포시', '50130'],
];

// 시도명 별칭 → 정규화
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

  // 주소에서 시도명 추출
  let cityKey = null;
  for (const [alias, normalized] of Object.entries(CITY_ALIASES)) {
    if (address.includes(alias)) {
      cityKey = normalized;
      break;
    }
  }

  // 구/시/군 단위 추출
  const guMatch = address.match(/([가-힣]+(?:구|시|군))/g);
  if (!guMatch) return null;

  // 시도 + 구/시/군 조합으로 정확한 코드 찾기
  for (const gu of guMatch) {
    for (const [city, district, code] of SIGUNGU_ENTRIES) {
      if (district === gu) {
        // 시도 확인이 가능하면 정확 매칭, 아니면 첫 매칭 사용
        if (!cityKey || city === cityKey) {
          return code;
        }
      }
    }
  }

  // 시도 매칭 없이 구 이름만으로 fallback (고유 이름인 경우)
  for (const gu of guMatch) {
    const matches = SIGUNGU_ENTRIES.filter(([, d]) => d === gu);
    if (matches.length === 1) return matches[0][2];
  }

  return null;
}

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
        const response = await fetch(`${url}?${params}`);
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

    // ── 필터링 + 점수 기반 매칭 ──

    const targetDong = extractDong(address);
    const inputJibun = extractJibun(address);

    console.log(`[국토부API] 동=${targetDong}, 지번=${inputJibun}`);

    // 점수 계산
    const scored = items.map(item => {
      let score = 0;

      // 동 매칭 (핵심)
      const itemDong = item.법정동 || '';
      if (targetDong && (itemDong.includes(targetDong) || targetDong.includes(itemDong))) {
        score += 50;
      }

      // 지번 매칭
      const itemJibun = item.지번 || '';
      if (inputJibun && itemJibun) {
        if (inputJibun === itemJibun) {
          score += 100; // 정확 매칭
        } else if (inputJibun.split('-')[0] === itemJibun.split('-')[0]) {
          score += 60; // 본번 매칭
        }
      }

      // 건물명 매칭 (아파트/오피스텔)
      if (buildingName && buildingName.length > 1) {
        const name = item.건물명 || '';
        if (name && (name.includes(buildingName) || buildingName.includes(name))) {
          score += 80;
        }
      }

      // 건축연도 유사도
      if (estimatedYear && item.건축연도) {
        const diff = Math.abs(parseInt(estimatedYear) - parseInt(item.건축연도));
        score += Math.max(0, 20 - diff * 2);
      }

      // 면적 유사도
      if (estimatedArea && item.전용면적) {
        const itemPyeong = parseFloat(item.전용면적) * 0.3025;
        const diff = Math.abs(estimatedArea - itemPyeong);
        score += Math.max(0, 20 - diff);
      }

      return { ...item, _score: score };
    });

    // 점수순 + 최신순 정렬
    scored.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return (b.거래일 || '').localeCompare(a.거래일 || '');
    });

    // 최소 점수 필터 (동이라도 매칭되어야 함)
    const minScore = inputJibun ? 50 : (targetDong ? 50 : 0);
    const validItems = scored.filter(r => r._score >= minScore);

    console.log(`[국토부API] 상위:`, validItems.slice(0, 3).map(r => ({
      건물명: r.건물명, 법정동: r.법정동, 지번: r.지번, 거래금액: r.거래금액, score: r._score
    })));

    const results = (validItems.length > 0 ? validItems : scored).slice(0, 10)
      .map(({ _score, _similarityScore, ...item }) => item);

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