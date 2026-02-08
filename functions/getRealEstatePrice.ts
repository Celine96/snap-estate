import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * 국토교통부 부동산 실거래가 조회 (건물 유형 자동 감지)
 * @param {string} address - 검색할 주소
 * @param {string} buildingName - 건물명
 * @param {string} buildingType - 건물 유형 (아파트/오피스텔/상가/빌라/기타)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { address, buildingName, buildingType } = await req.json();
    
    const apiKey = Deno.env.get('MOLIT_API_KEY');
    
    if (!apiKey) {
      return Response.json({ 
        success: false, 
        message: 'API 키가 설정되지 않았습니다.' 
      }, { status: 500 });
    }

  // 전국 시군구 코드 (주요 도시)
  const sigunguMap = {
    // 서울
    '강남구': '11680', '강동구': '11740', '강북구': '11305', '강서구': '11500',
    '관악구': '11620', '광진구': '11215', '구로구': '11530', '금천구': '11545',
    '노원구': '11350', '도봉구': '11320', '동대문구': '11230', '동작구': '11590',
    '마포구': '11440', '서대문구': '11410', '서초구': '11650', '성동구': '11200',
    '성북구': '11290', '송파구': '11710', '양천구': '11470', '영등포구': '11560',
    '용산구': '11170', '은평구': '11380', '종로구': '11110', '중구': '11140', '중랑구': '11260',
    // 경기
    '수원시': '41110', '성남시': '41130', '고양시': '41280', '용인시': '41460',
    '부천시': '41190', '안산시': '41270', '남양주시': '41360', '화성시': '41590',
    '평택시': '41220', '의정부시': '41150', '파주시': '41480', '시흥시': '41390',
    // 인천
    '남동구': '28200', '연수구': '28185', '부평구': '28237', '계양구': '28245',
    '서구': '28260', '미추홀구': '28177',
    // 부산
    '해운대구': '26350', '사하구': '26290', '수영구': '26500', '부산진구': '26230',
    // 대구
    '수성구': '27200', '달서구': '27290',
    // 대전
    '유성구': '30200', '서구': '30140',
    // 광주
    '광산구': '29200', '서구': '29140'
  };

    // 주소에서 구 이름 찾기
    let sigunguCode = null;
    for (const [district, code] of Object.entries(sigunguMap)) {
      if (address && address.includes(district)) {
        sigunguCode = code;
        break;
      }
    }

    if (!sigunguCode) {
      return Response.json({
        success: false,
        message: '지원되는 지역이 아닙니다. (시군구 정보를 찾을 수 없습니다)',
        data: null
      });
    }

    // 건물 유형에 따른 API 엔드포인트 선택
    let apiEndpoint = '';
    let serviceName = '';
    
    if (buildingType === '아파트') {
      serviceName = 'RTMSDataSvcAptTradeDev';
      apiEndpoint = 'getRTMSDataSvcAptTradeDev';
    } else if (buildingType === '오피스텔') {
      serviceName = 'RTMSDataSvcOffiTrade';
      apiEndpoint = 'getRTMSDataSvcOffiTrade';
    } else if (buildingType === '상가' || buildingType === '오피스') {
      serviceName = 'RTMSOBJSvc';
      apiEndpoint = 'getRTMSDataSvcNrgTrade';
    } else if (buildingType === '빌라/다세대' || buildingType === '단독주택') {
      serviceName = 'RTMSDataSvcRHTrade';
      apiEndpoint = 'getRTMSDataSvcRHTrade';
    } else {
      // 기본값: 상업용
      serviceName = 'RTMSOBJSvc';
      apiEndpoint = 'getRTMSDataSvcNrgTrade';
    }

    // 현재 날짜 기준으로 최근 6개월 데이터 조회
    const now = new Date();
    const dealYmd = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');

    const url = `https://apis.data.go.kr/1613000/${serviceName}/${apiEndpoint}`;
    const params = new URLSearchParams({
      serviceKey: decodeURIComponent(apiKey),
      LAWD_CD: sigunguCode,
      DEAL_YMD: dealYmd,
      numOfRows: '100'
    });

    const response = await fetch(`${url}?${params}`);
    const xmlText = await response.text();

    // XML 파싱
    const items = [];
    const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
    
    for (const match of itemMatches) {
      const itemXml = match[1];
      
      const getTagValue = (tag) => {
        const regex = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]+)\\]\\]><\/${tag}>|<${tag}>([^<]+)<\/${tag}>`);
        const match = itemXml.match(regex);
        return match ? (match[1] || match[2] || '').trim() : '';
      };

      // 건물 유형에 따라 다른 필드 사용
      let itemData = {};
      
      if (buildingType === '아파트') {
        itemData = {
          건물명: getTagValue('aptNm') || getTagValue('아파트'),
          거래금액: getTagValue('dealAmount') || getTagValue('거래금액'),
          건축연도: getTagValue('buildYear') || getTagValue('건축년도'),
          층: getTagValue('floor') || getTagValue('층'),
          전용면적: getTagValue('excluUseArea') || getTagValue('전용면적'),
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
          전용면적: getTagValue('excluUseArea') || getTagValue('전용면적'),
          거래일: `${getTagValue('dealYear') || getTagValue('년')}-${getTagValue('dealMonth') || getTagValue('월')}-${getTagValue('dealDay') || getTagValue('일')}`,
          법정동: getTagValue('umdNm') || getTagValue('법정동'),
          지번: getTagValue('jibun') || getTagValue('지번'),
          용도: '오피스텔'
        };
      } else {
        itemData = {
          건물명: getTagValue('bldNm'),
          거래금액: getTagValue('dealAmount'),
          건축연도: getTagValue('buildYear'),
          층: getTagValue('floor'),
          전용면적: getTagValue('excluUseArea'),
          거래일: `${getTagValue('dealYear')}-${getTagValue('dealMonth')}-${getTagValue('dealDay')}`,
          법정동: getTagValue('umdNm'),
          지번: getTagValue('jibun'),
          용도: getTagValue('bldUse') || buildingType
        };
      }

      // 건물명으로 필터링
      if (buildingName && buildingName.length > 1) {
        const name = itemData.건물명 || '';
        // 부분 일치 검색 (더 관대하게)
        if (name.includes(buildingName) || buildingName.includes(name)) {
          items.push(itemData);
        }
      } else {
        items.push(itemData);
      }
    }

    // 최신순 정렬
    items.sort((a, b) => {
      const dateA = new Date(a.거래일);
      const dateB = new Date(b.거래일);
      return dateB - dateA;
    });

    return Response.json({
      success: true,
      message: `${items.length}건의 실거래가 데이터를 찾았습니다.`,
      buildingType: buildingType,
      data: items.slice(0, 10)
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