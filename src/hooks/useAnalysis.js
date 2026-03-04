import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { convertManwon } from '@/utils/format';

export const ANALYSIS_STEPS = {
  uploading: '이미지를 업로드하고 있습니다...',
  extracting_location: '위치 정보를 추출하고 있습니다...',
  reverse_geocoding: 'GPS 좌표로 주소를 확인하고 있습니다...',
  analyzing_building: '건물 정보를 분석하고 있습니다...',
  querying_price: '실거래가를 조회하고 있습니다...',
  detailed_analysis: '상세 분석을 진행하고 있습니다...',
  saving: '분석 결과를 저장하고 있습니다...',
};

export function useAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [activeTab, setActiveTab] = useState('results');
  const [manualAddress, setManualAddress] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: recentAnalyses = [], refetch } = useQuery({
    queryKey: ['building-analyses', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.BuildingAnalysis.filter(
        { created_by: user.email },
        '-created_date',
        8
      );
    },
    enabled: !!user,
  });

  const handleImageSelected = async (file) => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisStep('uploading');

    try {
      // 1단계: 이미지 업로드
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // 2단계: 위치 정보 추출 (EXIF GPS 우선)
      setAnalysisStep('extracting_location');
      let locationData = null;
      try {
        const location = await base44.functions.getImageLocation({ imageUrl: file_url });
        locationData = location;
      } catch (error) {
        console.log('위치 추출 실패:', error);
      }

      // 3단계: GPS 좌표로 정확한 주소 찾기 (역지오코딩 - Nominatim API 사용)
      let addressFromGPS = null;
      if (locationData?.latitude && locationData?.longitude) {
        setAnalysisStep('reverse_geocoding');
        try {
          const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${locationData.latitude}&lon=${locationData.longitude}&zoom=18&addressdetails=1&accept-language=ko`,
            { headers: { 'User-Agent': 'SnapEstate/1.0' } }
          );
          const geoData = await geoResponse.json();

          if (geoData && geoData.address) {
            const addr = geoData.address;
            const city = addr.city || addr.town || addr.county || '';
            const district = addr.borough || addr.suburb || addr.quarter || addr.city_district || '';
            const neighbourhood = addr.neighbourhood || addr.village || '';
            const road = addr.road || '';
            const houseNumber = addr.house_number || '';

            // 도/시 레벨
            const province = addr.state || addr.province || '';

            // 주소 조합
            const roadAddress = [province, city, district, road, houseNumber].filter(Boolean).join(' ');
            // 지번 주소에 번지(house_number)를 포함시킴 (검색 정확도 핵심)
            const jibunAddress = [province, city, district, neighbourhood, houseNumber].filter(Boolean).join(' ');

            // 구 이름 추출 (XX구)
            const districtMatch = (roadAddress + ' ' + jibunAddress).match(/([가-힣]+구)/);
            // 동 이름 추출 (XX동)
            const dongMatch = (jibunAddress + ' ' + geoData.display_name).match(/([가-힣]+동)\b/);

            addressFromGPS = {
              road_address: roadAddress || geoData.display_name,
              jibun_address: jibunAddress || geoData.display_name,
              district: districtMatch ? districtMatch[1] : district,
              dong: dongMatch ? dongMatch[1] : neighbourhood
            };

            console.log('[역지오코딩] 결과:', JSON.stringify(addressFromGPS));
          }
        } catch (error) {
          console.log('GPS 역지오코딩 실패:', error);
        }
      }

      // 4단계: 기본 정보 추출 + 건축연도/면적 추정 (병렬 실행)
      setAnalysisStep('analyzing_building');

      const basicInfoPromise = base44.integrations.Core.InvokeLLM({
        prompt: `당신은 한국 부동산 전문가입니다. 이 건물 사진을 매우 정확하게 분석하세요.

${addressFromGPS ? `
🎯 GPS 좌표로 확인된 정확한 주소:
- 도로명 주소: ${addressFromGPS.road_address}
- 지번 주소: ${addressFromGPS.jibun_address}
- 지역: ${addressFromGPS.district} ${addressFromGPS.dong}

이 주소를 기준으로 분석하세요. 사진 속 건물명을 찾아주세요.
` : locationData ? `
🎯 GPS 좌표 감지됨:
- 위도: ${locationData.latitude}
- 경도: ${locationData.longitude}

이 좌표 주변의 건물을 찾으세요.
` : ''}

📋 분석 단계별 체크리스트:
1. **간판/표지판 텍스트 읽기** (가장 중요!)
   - 건물명, 상호명을 정확히 읽으세요
   - 숫자, 영문, 한글 모두 정확히

2. **주변 랜드마크 확인**
   - 지하철역, 버스정류장 이름
   - 주변 유명 건물, 프랜차이즈
   - 도로명 표지판

3. **건물 특징 분석**
   - 건축 스타일 (현대식/구형)
   - 층수, 외관 재질
   - 상가/주거 혼합 여부

4. **인터넷 검색 활용**
   - 네이버 지도에서 주변 검색
   - 건물명으로 정확히 매칭
   - 도로명 주소 확인

⚠️ 중요: 추측하지 말고 보이는 정보만 사용하세요!`,
        file_urls: [file_url],
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            address: { type: "string", description: addressFromGPS ? "GPS 주소 기반 확인된 전체 주소" : "정확한 전체 주소 (서울특별시 XX구 XX동 XX)" },
            building_name: { type: "string", description: "정확한 건물명 (간판 그대로)" },
            district: { type: "string", description: addressFromGPS ? `${addressFromGPS.district}` : "구/동 (예: 강남구, 역삼동)" },
            building_type: {
              type: "string",
              enum: ["아파트", "오피스텔", "상가", "빌라/다세대", "단독주택", "오피스", "기타"],
              description: "건물 유형"
            },
            confidence_notes: { type: "string", description: "판단 근거 (어떤 정보로 확인했는지)" }
          }
        }
      });

      const quickEstimatesPromise = base44.integrations.Core.InvokeLLM({
        prompt: `사진 속 건물의 건축연도와 대략적인 면적을 추정하세요:
- 건축연도: 외관 상태, 건축 스타일로 판단
- 면적: 층수 × 층당 면적으로 대략 계산 (평 단위)`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            year: { type: "string", description: "추정 건축연도 (예: 1995)" },
            area_pyeong: { type: "number", description: "추정 면적(평)" }
          }
        }
      }).catch((e) => {
        console.log('빠른 추정 실패:', e);
        return null;
      });

      // 두 LLM 호출을 병렬로 실행
      const [basicInfoResult, quickEstimates] = await Promise.all([
        basicInfoPromise,
        quickEstimatesPromise,
      ]);

      const basicInfo = basicInfoResult;
      if (!basicInfo) {
        throw new Error('건물 기본 정보 분석에 실패했습니다. 다시 시도해주세요.');
      }

      // 5단계: 실거래가 조회 (GPS 주소 우선 사용)
      setAnalysisStep('querying_price');
      let realPriceData = null;
      let priceType = "AI 추정가";

      const searchAddress = addressFromGPS?.jibun_address || basicInfo.address;

      // 1차: DB 내 상업거래 데이터 검색
      try {
        const realPrice = await base44.functions.searchCommercialPrice({
          address: searchAddress,
          buildingType: basicInfo.building_type,
          estimatedYear: quickEstimates?.year,
          estimatedArea: quickEstimates?.area_pyeong
        });

        if (realPrice.data?.success && realPrice.data.data && realPrice.data.data.length > 0) {
          realPriceData = realPrice.data.data[0];
          priceType = "최근 실거래가";
        }
      } catch (error) {
        console.log('DB 실거래가 조회 실패:', error);
      }

      // 2차: DB에서 못 찾으면 국토교통부 공공 API로 fallback
      if (!realPriceData) {
        try {
          const govPrice = await base44.functions.getRealEstatePrice({
            address: searchAddress,
            buildingName: basicInfo.building_name,
            buildingType: basicInfo.building_type,
            estimatedYear: quickEstimates?.year,
            estimatedArea: quickEstimates?.area_pyeong
          });

          if (govPrice.data?.success && govPrice.data.data && govPrice.data.data.length > 0) {
            const govItem = govPrice.data.data[0];
            // 국토교통부 API 응답을 DB 결과와 동일한 형태로 변환
            const rawAmount = (govItem.거래금액 || '0').toString().replace(/,/g, '').replace(/[^0-9]/g, '');
            realPriceData = {
              건물명: govItem.건물명 || basicInfo.building_name,
              거래금액: parseInt(rawAmount) || 0,
              거래일: govItem.거래일,
              건축연도: govItem.건축연도 ? parseInt(govItem.건축연도) : null,
              전용면적: govItem.전용면적 ? parseFloat(govItem.전용면적) : null,
              층: govItem.층 || '',
              법정동: govItem.법정동,
              지번: govItem.지번,
              건축물주용도: govItem.용도 || basicInfo.building_type,
              용도지역: '',
              거래유형: '',
              매칭점수: 0,
              매칭신뢰도: govItem.매칭신뢰도 || null,
              매칭점수_정규화: govItem.매칭점수_정규화 || null,
              매칭요인: govItem.매칭요인 || [],
            };
            priceType = "국토교통부 실거래가";
          }
        } catch (error) {
          console.log('국토교통부 API 조회 실패, AI 추정으로 전환:', error);
        }
      }

      const realPriceSaleStr = realPriceData ? convertManwon(realPriceData.거래금액) : null;

      // 6단계: 상세 분석 (GPS 주소 활용)
      setAnalysisStep('detailed_analysis');
      let result;
      try {
        result = await base44.integrations.Core.InvokeLLM({
          prompt: `당신은 15년 경력의 한국 부동산 전문 감정평가사입니다.
이 건물을 매우 정확하게 분석하여 실제 시세에 가깝게 평가하세요.

📍 **확인된 건물 정보:**
${addressFromGPS ? `
- ✅ GPS 확정 주소: ${addressFromGPS.jibun_address}
- ✅ 도로명: ${addressFromGPS.road_address}
- ✅ 지역: ${addressFromGPS.district} ${addressFromGPS.dong}
` : `
- 주소: ${basicInfo.address}
`}
- 건물명: ${basicInfo.building_name}
- 건물 유형: ${basicInfo.building_type}
- 지역: ${basicInfo.district}
${basicInfo.confidence_notes ? `- 판단 근거: ${basicInfo.confidence_notes}` : ''}

${realPriceData ? `
💰 **국토교통부 실거래가 (공식 데이터):**
- 거래금액: ${realPriceSaleStr} (${realPriceData.거래금액}만원)
- 거래일: ${realPriceData.거래일}
- 건축년도: ${realPriceData.건축연도}년
- 전용면적: ${realPriceData.전용면적}㎡ (약 ${Math.round(realPriceData.전용면적 * 0.3025)}평)

⚠️ 매매가는 이미 확정됨. 아래 항목만 추정하세요:
- 전세가: 매매가(${realPriceSaleStr})의 60-70%
- 월세: 전세가 대비 연 5-7% 수익률 기준
` : `
⚠️ 실거래가 데이터 없음 - 주변 시세 기반으로 신중하게 추정하세요.
- 매매가, 전세가, 월세 모두 추정
`}

🔍 **분석 요구사항:**

1. **건물 스펙 분석** (사진 기반):
   - 정확한 층수, 건축 연도 추정, 대략적인 면적

2. **주변 환경** (사진에서 보이는 것만):
   - 교통, 편의시설, 상권

3. **용도지역 및 법적 정보**:
   - 토지이음(https://www.eum.go.kr)에서 해당 지번 공식 정보 검색

⚠️ 주의: 보이지 않는 정보는 "확인 불가"로 표시. 가격은 "약 X억 X천만원" 형식으로`,
          file_urls: [file_url],
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              building_name: { type: "string" },
              address: { type: "string" },
              district: { type: "string" },
              building_type: { type: "string", enum: ["아파트", "오피스텔", "상가", "빌라/다세대", "단독주택", "오피스", "기타"] },
              estimated_year: { type: "string" },
              estimated_floors: { type: "number" },
              estimated_area_pyeong: { type: "string" },
              estimated_price_sale: { type: "string", description: realPriceData ? "실거래가로 이미 확정됨 - null 반환" : "추정 매매가" },
              estimated_price_rent: { type: "string", description: "추정 전세가 (주거용 건물만, 상가/오피스는 null)" },
              estimated_price_monthly: { type: "string", description: "추정 월세/임차료 (보증금/월세)" },
              price_trend: { type: "string" },
              building_features: { type: "array", items: { type: "string" } },
              nearby_facilities: { type: "array", items: { type: "string" } },
              latitude: { type: "number" },
              longitude: { type: "number" },
              confidence: { type: "string", enum: ["높음", "보통", "낮음"] },
              analysis_summary: { type: "string" },
              zoning_info: {
                type: "object",
                properties: {
                  land_use_zone: { type: "string" },
                  building_to_land_ratio: { type: "string" },
                  floor_area_ratio: { type: "string" },
                  legal_restrictions: { type: "array", items: { type: "string" } },
                  development_plan: { type: "string" }
                }
              },
              investment_score: {
                type: "object",
                description: "투자 지표 (0~100점)",
                properties: {
                  overall: { type: "number", description: "종합 투자점수 (0-100)" },
                  location: { type: "number", description: "입지 점수 (0-100)" },
                  profitability: { type: "number", description: "수익성 점수 (0-100)" },
                  growth_potential: { type: "number", description: "성장 가능성 점수 (0-100)" }
                }
              },
              rental_analysis: {
                type: "object",
                description: "임대 수익률 분석",
                properties: {
                  monthly_income: { type: "string", description: "월 임대수익 (예: 약 150만원)" },
                  annual_yield: { type: "string", description: "연 수익률 (예: 4.5%)" },
                  total_deposit: { type: "string", description: "총 보증금 (예: 약 2억원)" },
                  occupancy_rate: { type: "string", description: "예상 공실률 (예: 5%)" }
                }
              }
            }
          }
        });
      } catch (error) {
        throw new Error('건물 상세 분석에 실패했습니다. 다시 시도해주세요.');
      }

      // 7단계: 결과 저장
      setAnalysisStep('saving');
      const savedData = {
        image_url: file_url,
        ...result,
        building_name: basicInfo.building_name,
        address: addressFromGPS?.jibun_address || basicInfo.address,
        district: basicInfo.district,
        building_type: basicInfo.building_type,
        price_type: priceType,
        real_price_data: realPriceData || null,
        ...(realPriceSaleStr ? { estimated_price_sale: realPriceSaleStr } : {}),
        latitude: locationData?.latitude || result.latitude,
        longitude: locationData?.longitude || result.longitude,
        location_source: locationData?.source || 'AI 추정'
      };

      const createdData = await base44.entities.BuildingAnalysis.create(savedData);
      setAnalysisData(createdData);
      setShowResult(true);
      refetch();
    } catch (error) {
      console.error('분석 실패:', error);
      setAnalysisError(error.message || '분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep(null);
    }
  };

  const handleSelectRecent = async (item) => {
    setAnalysisData(item);
    setShowResult(true);

    // 실거래가 재조회 시도 (DB → 국토교통부 API fallback)
    try {
      const searchAddress = item.address || item.district;
      if (!searchAddress) return;
      const estArea = item.estimated_area_pyeong ? parseFloat(item.estimated_area_pyeong) : undefined;

      let realPriceData = null;
      let priceType = null;

      // 1차: DB 검색
      try {
        const realPrice = await base44.functions.searchCommercialPrice({
          address: searchAddress,
          buildingType: item.building_type,
          estimatedYear: item.estimated_year,
          estimatedArea: estArea
        });
        if (realPrice.data?.success && realPrice.data.data?.length > 0) {
          realPriceData = realPrice.data.data[0];
          priceType = '최근 실거래가';
        }
      } catch (e) {
        console.log('DB 실거래가 재조회 실패:', e);
      }

      // 2차: 국토교통부 API fallback
      if (!realPriceData) {
        try {
          const govPrice = await base44.functions.getRealEstatePrice({
            address: searchAddress,
            buildingName: item.building_name,
            buildingType: item.building_type,
            estimatedYear: item.estimated_year,
            estimatedArea: estArea
          });
          if (govPrice.data?.success && govPrice.data.data?.length > 0) {
            const govItem = govPrice.data.data[0];
            const rawAmount = (govItem.거래금액 || '0').toString().replace(/,/g, '').replace(/[^0-9]/g, '');
            realPriceData = {
              건물명: govItem.건물명 || item.building_name,
              거래금액: parseInt(rawAmount) || 0,
              거래일: govItem.거래일,
              건축연도: govItem.건축연도 ? parseInt(govItem.건축연도) : null,
              전용면적: govItem.전용면적 ? parseFloat(govItem.전용면적) : null,
              층: govItem.층 || '',
              법정동: govItem.법정동,
              지번: govItem.지번,
              건축물주용도: govItem.용도 || item.building_type,
              용도지역: '',
              거래유형: '',
              매칭점수: 0,
              매칭신뢰도: govItem.매칭신뢰도 || null,
              매칭점수_정규화: govItem.매칭점수_정규화 || null,
              매칭요인: govItem.매칭요인 || [],
            };
            priceType = '국토교통부 실거래가';
          }
        } catch (e) {
          console.log('국토교통부 API 재조회 실패:', e);
        }
      }

      if (realPriceData && priceType) {
        const updated = { ...item, real_price_data: realPriceData, price_type: priceType };
        setAnalysisData(updated);
        await base44.entities.BuildingAnalysis.update(item.id, { real_price_data: realPriceData, price_type: priceType });
        refetch();
      }
    } catch (e) {
      console.log('최근 기록 실거래가 재조회 실패:', e);
    }
  };

  const handleUpdateAnalysis = async (updatedData) => {
    await base44.entities.BuildingAnalysis.update(updatedData.id, updatedData);
    setAnalysisData(updatedData);
    refetch();
  };

  const handleManualAddressSubmit = async () => {
    if (!manualAddress.trim() || !analysisData?.id) return;
    setShowManualInput(false);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisStep('querying_price');

    try {
      const file_url = analysisData.image_url;

      // 수동 입력 주소로 실거래가 조회 (DB → 국토교통부 API fallback)
      let realPriceData = null;
      let priceType = "AI 추정가";
      const manualAddr = manualAddress.trim();
      const estArea = analysisData.estimated_area_pyeong ? parseFloat(analysisData.estimated_area_pyeong) : undefined;

      // 1차: DB 검색
      try {
        const realPrice = await base44.functions.searchCommercialPrice({
          address: manualAddr,
          buildingType: analysisData.building_type,
          estimatedYear: analysisData.estimated_year,
          estimatedArea: estArea
        });
        if (realPrice.data?.success && realPrice.data.data?.length > 0) {
          realPriceData = realPrice.data.data[0];
          priceType = "최근 실거래가";
        }
      } catch (e) {
        console.log('DB 실거래가 조회 실패:', e);
      }

      // 2차: 국토교통부 API fallback
      if (!realPriceData) {
        try {
          const govPrice = await base44.functions.getRealEstatePrice({
            address: manualAddr,
            buildingName: analysisData.building_name,
            buildingType: analysisData.building_type,
            estimatedYear: analysisData.estimated_year,
            estimatedArea: estArea
          });
          if (govPrice.data?.success && govPrice.data.data?.length > 0) {
            const govItem = govPrice.data.data[0];
            const rawAmount = (govItem.거래금액 || '0').toString().replace(/,/g, '').replace(/[^0-9]/g, '');
            realPriceData = {
              건물명: govItem.건물명 || analysisData.building_name,
              거래금액: parseInt(rawAmount) || 0,
              거래일: govItem.거래일,
              건축연도: govItem.건축연도 ? parseInt(govItem.건축연도) : null,
              전용면적: govItem.전용면적 ? parseFloat(govItem.전용면적) : null,
              층: govItem.층 || '',
              법정동: govItem.법정동,
              지번: govItem.지번,
              건축물주용도: govItem.용도 || analysisData.building_type,
              용도지역: '',
              거래유형: '',
              매칭점수: 0,
              매칭신뢰도: govItem.매칭신뢰도 || null,
              매칭점수_정규화: govItem.매칭점수_정규화 || null,
              매칭요인: govItem.매칭요인 || [],
            };
            priceType = "국토교통부 실거래가";
          }
        } catch (e) {
          console.log('국토교통부 API 조회 실패:', e);
        }
      }

      // 수동 주소로 상세 분석
      setAnalysisStep('detailed_analysis');
      let result;
      try {
        result = await base44.integrations.Core.InvokeLLM({
          prompt: `당신은 15년 경력의 한국 부동산 전문 감정평가사입니다.

📍 사용자가 직접 입력한 정확한 주소: ${manualAddress.trim()}

이 주소를 기준으로 건물을 분석하세요. 사진도 참고하세요.

${realPriceData ? `💰 국토교통부 실거래가:
- 거래금액: ${realPriceData.거래금액}만원
- 거래일: ${realPriceData.거래일}
⚠️ 매매가는 이미 확정됨. 전세가/월세만 추정하세요.` : '⚠️ 실거래가 없음 - 주변 시세 기반으로 추정하세요.'}

정확한 건물 스펙, 시세, 주변 환경을 평가하세요.`,
          file_urls: [file_url],
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              building_name: { type: "string" },
              address: { type: "string" },
              district: { type: "string" },
              building_type: { type: "string", enum: ["아파트", "오피스텔", "상가", "빌라/다세대", "단독주택", "오피스", "기타"] },
              estimated_year: { type: "string" },
              estimated_floors: { type: "number" },
              estimated_area_pyeong: { type: "string" },
              estimated_price_sale: { type: "string" },
              estimated_price_rent: { type: "string" },
              estimated_price_monthly: { type: "string" },
              price_trend: { type: "string" },
              building_features: { type: "array", items: { type: "string" } },
              nearby_facilities: { type: "array", items: { type: "string" } },
              latitude: { type: "number" },
              longitude: { type: "number" },
              confidence: { type: "string", enum: ["높음", "보통", "낮음"] },
              analysis_summary: { type: "string" },
              zoning_info: {
                type: "object",
                properties: {
                  land_use_zone: { type: "string" },
                  building_to_land_ratio: { type: "string" },
                  floor_area_ratio: { type: "string" },
                  legal_restrictions: { type: "array", items: { type: "string" } },
                  development_plan: { type: "string" }
                }
              }
            }
          }
        });
      } catch (error) {
        throw new Error('주소 기반 재분석에 실패했습니다. 다시 시도해주세요.');
      }

      const realPriceSaleStr = realPriceData ? convertManwon(realPriceData.거래금액) : null;

      setAnalysisStep('saving');
      const updatedData = {
        ...analysisData,
        ...result,
        address: manualAddress.trim(),
        price_type: priceType,
        real_price_data: realPriceData || null,
        ...(realPriceSaleStr ? { estimated_price_sale: realPriceSaleStr } : {}),
        location_accuracy: null,
      };

      await base44.entities.BuildingAnalysis.update(analysisData.id, updatedData);
      setAnalysisData(updatedData);
      setManualAddress('');
      refetch();
    } catch (error) {
      console.error('재분석 실패:', error);
      setAnalysisError(error.message || '재분석 중 오류가 발생했습니다.');
      setShowManualInput(true);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep(null);
    }
  };

  const handleLocationAccuracy = async (accuracy) => {
    if (!analysisData?.id) return;

    // "부정확" 선택 시 신뢰도 낮음으로 변경 + 주소 직접 입력창 표시
    if (accuracy === 'incorrect') {
      const updatedConfidence = { ...analysisData, confidence: '낮음', location_accuracy: accuracy };
      await base44.entities.BuildingAnalysis.update(analysisData.id, updatedConfidence);
      setAnalysisData(updatedConfidence);
      setShowManualInput(true);
      refetch();
    } else {
      // "근처" 또는 "정확" 선택 시 평가 저장 + 정확이면 신뢰도 높음으로 변경
      const confidenceUpdate = accuracy === 'accurate' ? { confidence: '높음' } : {};
      const updatedData = { ...analysisData, location_accuracy: accuracy, ...confidenceUpdate };
      await base44.entities.BuildingAnalysis.update(analysisData.id, updatedData);
      setAnalysisData(updatedData);
      refetch();
    }
  };

  const handleBack = () => {
    setShowResult(false);
    setAnalysisData(null);
  };

  return {
    // State
    isAnalyzing,
    analysisStep,
    analysisError,
    analysisData,
    showResult,
    showManualInput,
    manualAddress,
    activeTab,
    user,
    recentAnalyses,

    // State setters
    setManualAddress,
    setShowManualInput,
    setActiveTab,

    // Handlers
    handleImageSelected,
    handleSelectRecent,
    handleUpdateAnalysis,
    handleManualAddressSubmit,
    handleLocationAccuracy,
    handleBack,
  };
}
