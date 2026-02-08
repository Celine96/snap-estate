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

  // 전국 시군구 코드 (완전판)
  const sigunguMap = {
    // 서울
    '종로구': '11110', '중구': '11140', '용산구': '11170', '성동구': '11200',
    '광진구': '11215', '동대문구': '11230', '중랑구': '11260', '성북구': '11290',
    '강북구': '11305', '도봉구': '11320', '노원구': '11350', '은평구': '11380',
    '서대문구': '11410', '마포구': '11440', '양천구': '11470', '강서구': '11500',
    '구로구': '11530', '금천구': '11545', '영등포구': '11560', '동작구': '11590',
    '관악구': '11620', '서초구': '11650', '강남구': '11680', '송파구': '11710', '강동구': '11740',
    // 부산
    '중구': '26110', '서구': '26140', '동구': '26170', '영도구': '26200', '부산진구': '26230',
    '동래구': '26260', '남구': '26290', '북구': '26320', '해운대구': '26350', '사하구': '26380',
    '금정구': '26410', '강서구': '26440', '연제구': '26470', '수영구': '26500', '사상구': '26530',
    '기장군': '26710',
    // 대구
    '중구': '27110', '동구': '27140', '서구': '27170', '남구': '27200', '북구': '27230',
    '수성구': '27260', '달서구': '27290', '달성군': '27710',
    // 인천
    '중구': '28110', '동구': '28140', '미추홀구': '28177', '연수구': '28185', '남동구': '28200',
    '부평구': '28237', '계양구': '28245', '서구': '28260', '강화군': '28710', '옹진군': '28720',
    // 광주
    '동구': '29110', '서구': '29140', '남구': '29155', '북구': '29170', '광산구': '29200',
    // 대전
    '동구': '30110', '중구': '30140', '서구': '30170', '유성구': '30200', '대덕구': '30230',
    // 울산
    '중구': '31110', '남구': '31140', '동구': '31170', '북구': '31200', '울주군': '31710',
    // 세종
    '세종시': '36110',
    // 경기
    '수원시': '41110', '장안구': '41111', '권선구': '41113', '팔달구': '41115', '영통구': '41117',
    '성남시': '41130', '수정구': '41131', '중원구': '41133', '분당구': '41135',
    '의정부시': '41150', '안양시': '41170', '만안구': '41171', '동안구': '41173',
    '부천시': '41190', '원미구': '41192', '소사구': '41194', '오정구': '41196',
    '광명시': '41210', '평택시': '41220', '동두천시': '41250', '안산시': '41270',
    '상록구': '41271', '단원구': '41273', '고양시': '41280', '덕양구': '41281',
    '일산동구': '41285', '일산서구': '41287', '과천시': '41290', '구리시': '41310',
    '남양주시': '41360', '오산시': '41370', '시흥시': '41390', '군포시': '41410',
    '의왕시': '41430', '하남시': '41450', '용인시': '41460', '처인구': '41461',
    '기흥구': '41463', '수지구': '41465', '파주시': '41480', '이천시': '41500',
    '안성시': '41550', '김포시': '41570', '화성시': '41590', '광주시': '41610',
    '양주시': '41630', '포천시': '41650', '여주시': '41670', '연천군': '41800',
    '가평군': '41820', '양평군': '41830',
    // 강원
    '춘천시': '42110', '원주시': '42130', '강릉시': '42150', '동해시': '42170',
    '태백시': '42190', '속초시': '42210', '삼척시': '42230', '홍천군': '42720',
    '횡성군': '42730', '영월군': '42750', '평창군': '42760', '정선군': '42770',
    '철원군': '42780', '화천군': '42790', '양구군': '42800', '인제군': '42810',
    '고성군': '42820', '양양군': '42830',
    // 충북
    '청주시': '43110', '상당구': '43111', '서원구': '43112', '흥덕구': '43113',
    '청원구': '43114', '충주시': '43130', '제천시': '43150', '보은군': '43720',
    '옥천군': '43730', '영동군': '43740', '증평군': '43745', '진천군': '43750',
    '괴산군': '43760', '음성군': '43770', '단양군': '43800',
    // 충남
    '천안시': '44130', '동남구': '44131', '서북구': '44133', '공주시': '44150',
    '보령시': '44180', '아산시': '44200', '서산시': '44210', '논산시': '44230',
    '계룡시': '44250', '당진시': '44270', '금산군': '44710', '부여군': '44760',
    '서천군': '44770', '청양군': '44790', '홍성군': '44800', '예산군': '44810',
    '태안군': '44825',
    // 전북
    '전주시': '45110', '완산구': '45111', '덕진구': '45113', '군산시': '45130',
    '익산시': '45140', '정읍시': '45180', '남원시': '45190', '김제시': '45210',
    '완주군': '45710', '진안군': '45720', '무주군': '45730', '장수군': '45740',
    '임실군': '45750', '순창군': '45770', '고창군': '45790', '부안군': '45800',
    // 전남
    '목포시': '46110', '여수시': '46130', '순천시': '46150', '나주시': '46170',
    '광양시': '46230', '담양군': '46710', '곡성군': '46720', '구례군': '46730',
    '고흥군': '46770', '보성군': '46780', '화순군': '46790', '장흥군': '46800',
    '강진군': '46810', '해남군': '46820', '영암군': '46830', '무안군': '46840',
    '함평군': '46860', '영광군': '46870', '장성군': '46880', '완도군': '46890',
    '진도군': '46900', '신안군': '46910',
    // 경북
    '포항시': '47110', '남구': '47111', '북구': '47113', '경주시': '47130',
    '김천시': '47150', '안동시': '47170', '구미시': '47190', '영주시': '47210',
    '영천시': '47230', '상주시': '47250', '문경시': '47280', '경산시': '47290',
    '군위군': '47720', '의성군': '47730', '청송군': '47750', '영양군': '47760',
    '영덕군': '47770', '청도군': '47820', '고령군': '47830', '성주군': '47840',
    '칠곡군': '47850', '예천군': '47900', '봉화군': '47920', '울진군': '47930',
    '울릉군': '47940',
    // 경남
    '창원시': '48120', '의창구': '48121', '성산구': '48123', '마산합포구': '48125',
    '마산회원구': '48127', '진해구': '48129', '진주시': '48170', '통영시': '48220',
    '사천시': '48240', '김해시': '48250', '밀양시': '48270', '거제시': '48310',
    '양산시': '48330', '의령군': '48720', '함안군': '48730', '창녕군': '48740',
    '고성군': '48820', '남해군': '48840', '하동군': '48850', '산청군': '48860',
    '함양군': '48870', '거창군': '48880', '합천군': '48890',
    // 제주
    '제주시': '50110', '서귀포시': '50130'
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

    console.log('API 호출:', {
      url,
      sigunguCode,
      dealYmd,
      buildingType,
      buildingName
    });

    const response = await fetch(`${url}?${params}`);
    const xmlText = await response.text();
    
    console.log('API 응답 샘플:', xmlText.substring(0, 500));

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