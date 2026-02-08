/**
 * 국토교통부 상업업무용 부동산 매매 실거래가 조회
 * 
 * @param {string} address - 검색할 주소 (예: "서울특별시 강남구")
 * @param {string} buildingName - 건물명 (선택)
 */
export default async function getRealEstatePrice({ address, buildingName }) {
  const apiKey = process.env.MOLIT_API_KEY;
  
  if (!apiKey) {
    throw new Error('국토교통부 API 키가 설정되지 않았습니다.');
  }

  // 주소에서 시군구 코드 추출 (간단한 매핑)
  const sigunguMap = {
    '강남구': '11680',
    '강동구': '11740',
    '강북구': '11305',
    '강서구': '11500',
    '관악구': '11620',
    '광진구': '11215',
    '구로구': '11530',
    '금천구': '11545',
    '노원구': '11350',
    '도봉구': '11320',
    '동대문구': '11230',
    '동작구': '11590',
    '마포구': '11440',
    '서대문구': '11410',
    '서초구': '11650',
    '성동구': '11200',
    '성북구': '11290',
    '송파구': '11710',
    '양천구': '11470',
    '영등포구': '11560',
    '용산구': '11170',
    '은평구': '11380',
    '종로구': '11110',
    '중구': '11140',
    '중랑구': '11260'
  };

  // 주소에서 구 이름 찾기
  let sigunguCode = null;
  for (const [district, code] of Object.entries(sigunguMap)) {
    if (address.includes(district)) {
      sigunguCode = code;
      break;
    }
  }

  if (!sigunguCode) {
    return {
      success: false,
      message: '서울시 주소만 지원됩니다. (구 정보를 찾을 수 없습니다)',
      data: null
    };
  }

  // 현재 날짜 기준으로 최근 6개월 데이터 조회
  const now = new Date();
  const dealYmd = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');

  try {
    const url = `http://openapi.molit.go.kr:8081/OpenAPI_ToolInstallPackage/service/rest/RTMSOBJSvc/getRTMSDataSvcNrgTrade`;
    const params = new URLSearchParams({
      serviceKey: apiKey,
      LAWD_CD: sigunguCode,
      DEAL_YMD: dealYmd,
      numOfRows: '100'
    });

    const response = await fetch(`${url}?${params}`);
    const xmlText = await response.text();

    // XML 파싱 (간단한 정규식 사용)
    const items = [];
    const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
    
    for (const match of itemMatches) {
      const itemXml = match[1];
      
      const getTagValue = (tag) => {
        const regex = new RegExp(`<${tag}><!\\[CDATA\\[([^\\]]+)\\]\\]><\/${tag}>|<${tag}>([^<]+)<\/${tag}>`);
        const match = itemXml.match(regex);
        return match ? (match[1] || match[2] || '').trim() : '';
      };

      const item = {
        건물명: getTagValue('bldNm'),
        거래금액: getTagValue('dealAmount'),
        건축연도: getTagValue('buildYear'),
        층: getTagValue('floor'),
        전용면적: getTagValue('excluUseArea'),
        거래일: `${getTagValue('dealYear')}-${getTagValue('dealMonth')}-${getTagValue('dealDay')}`,
        법정동: getTagValue('umdNm'),
        지번: getTagValue('jibun'),
        용도: getTagValue('bldUse')
      };

      // 건물명으로 필터링 (선택사항)
      if (buildingName) {
        if (item.건물명 && item.건물명.includes(buildingName)) {
          items.push(item);
        }
      } else {
        items.push(item);
      }
    }

    // 최신순 정렬
    items.sort((a, b) => new Date(b.거래일) - new Date(a.거래일));

    return {
      success: true,
      message: `${items.length}건의 실거래가 데이터를 찾았습니다.`,
      data: items.slice(0, 10) // 상위 10건만 반환
    };

  } catch (error) {
    console.error('실거래가 조회 오류:', error);
    return {
      success: false,
      message: `API 호출 오류: ${error.message}`,
      data: null
    };
  }
}