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
  const abortRef = useState(() => ({ cancelled: false }))[0];

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
    refetchOnWindowFocus: true,
  });

  const handleCancelAnalysis = () => {
    abortRef.cancelled = true;
    setIsAnalyzing(false);
    setAnalysisStep(null);
    setAnalysisError(null);
  };

  const handleImageSelected = async (file) => {
    abortRef.cancelled = false;
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
        const location = await base44.functions.invoke('getImageLocation', { imageUrl: file_url });
        locationData = location.data;
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
            const province = addr.state || addr.province || '';

            const roadAddress = [province, city, district, road, houseNumber].filter(Boolean).join(' ');
            const jibunAddress = [province, city, district, neighbourhood, houseNumber].filter(Boolean).join(' ');

            const districtMatch = (roadAddress + ' ' + jibunAddress).match(/([\uAC00-\uD7A3]+구)/);
            const dongMatch = (jibunAddress + ' ' + geoData.display_name).match(/([\uAC00-\uD7A3]+동)\b/);

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

      const [basicInfoResult, quickEstimates] = await Promise.all([
        basicInfoPromise,
        quickEstimatesPromise,
      ]);

      if (abortRef.cancelled) return;

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
        const realPrice = await base44.functions.invoke('searchCommercialPrice', {
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
          const govPrice = await base44.functions.invoke('getRealEstatePrice', {
            address: searchAddress,
            buildingName: basicInfo.building_name,
            buildingType: basicInfo.building_type,
            estimatedYear: quickEstimates?.year,
            estimatedArea: quickEstimates?.area_pyeong
          });

          if (govPrice.data?.success && govPrice.data.data && govPrice.data.data.length > 0) {
            const govItem = govPrice.data.data[0];
            const rawAmount = (govItem.거래금액 || '0').toString().replace(/,/g, '').replace(/[^0-9]/g, '');
            realPriceData = {
              건물명: govItem.건물명 || basicInfo.building_name,
              거래금액: parseInt(rawAmount) || 0,
              거래일: govItem.거래일,
              건축연도: govItem.건축연도 ? parseInt(govItem.건축연도) : null,
              전용면적: govItem.전용면적 || govItem.대지면적,
              층: govItem.층,
              건축물주용도: govItem.건축물주용도,
              용도지역: govItem.용도지역,
              매칭신뢰도: govItem.매칭신뢰도,
              매칭요인: govItem.매칭요인,
              데이터출처: '국토교통부 실거래가',
            };
            priceType = "국토교통부 실거래가";
          }
        } catch (error) {
          console.log('국토교통부 API 조회 실패:', error);
        }
      }

      if (abortRef.cancelled) return;

      // 6단계: 상세 분석 (가격 추정 + 투자 분석)
      setAnalysisStep('detailed_analysis');

      const realPriceSummary = realPriceData
        ? `실거래가 데이터 있음: ${convertManwon(realPriceData.거래금액)} (${realPriceData.거래일 || '날짜 미상'})`
        : '실거래가 데이터 없음 - AI 추정 필요';

      const detailedAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `한국 부동산 전문가로서 다음 건물을 분석하세요.

건물 정보:
- 주소: ${searchAddress}
- 건물명: ${basicInfo.building_name || '미상'}
- 유형: ${basicInfo.building_type}
- 추정 건축연도: ${quickEstimates?.year || '미상'}
- 추정 면적: ${quickEstimates?.area_pyeong ? quickEstimates.area_pyeong + '평' : '미상'}
- 실거래가 현황: ${realPriceSummary}

분석 요청:
1. 2026년 현재 시세 추정 (매매가, 전세가, 월세)
2. 시세 동향 (최근 1~2년 추이)
3. 건물 특징 5가지 (강점/약점)
4. 주변 주요 시설
5. AI 분석 요약 (3~4줄)
6. 투자 점수 (100점 만점, 위치/수익성/성장성)
7. 임대 수익 분석 (월 수입, 연 수익률, 총 보증금, 공실률)

⚠️ 실거래 데이터가 있으면 이를 기준으로 AI 추정가를 조정하세요.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            estimated_price_sale: { type: "string", description: "매매가 (예: 15억 ~ 18억)" },
            estimated_price_rent: { type: "string", description: "전세가 (예: 8억 ~ 10억)" },
            estimated_price_monthly: { type: "string", description: "월세 (예: 보증금 2000만/월세 150만)" },
            price_trend: { type: "string", description: "시세 동향 설명" },
            building_features: { type: "array", items: { type: "string" }, description: "건물 특징 목록" },
            nearby_facilities: { type: "array", items: { type: "string" }, description: "주변 시설 목록" },
            analysis_summary: { type: "string", description: "AI 분석 요약" },
            confidence: { type: "string", enum: ["높음", "보통", "낮음"], description: "분석 신뢰도" },
            latitude: { type: "number", description: "위도" },
            longitude: { type: "number", description: "경도" },
            estimated_floors: { type: "number", description: "추정 층수" },
            investment_score: {
              type: "object",
              properties: {
                total: { type: "number", description: "종합 점수 (0-100)" },
                location: { type: "number", description: "위치 점수 (0-100)" },
                profitability: { type: "number", description: "수익성 점수 (0-100)" },
                growth: { type: "number", description: "성장성 점수 (0-100)" }
              }
            },
            rental_analysis: {
              type: "object",
              properties: {
                monthly_income: { type: "string", description: "월 임대 수입" },
                annual_yield: { type: "string", description: "연 수익률 (%)" },
                total_deposit: { type: "string", description: "총 보증금" },
                occupancy_rate: { type: "string", description: "공실률" }
              }
            }
          }
        }
      });

      // 7단계: 저장
      setAnalysisStep('saving');

      const finalData = {
        image_url: file_url,
        building_name: basicInfo.building_name,
        address: searchAddress,
        district: basicInfo.district || addressFromGPS?.district,
        building_type: basicInfo.building_type,
        estimated_year: quickEstimates?.year,
        estimated_floors: detailedAnalysis.estimated_floors,
        estimated_area_pyeong: quickEstimates?.area_pyeong?.toString(),
        price_type: priceType,
        estimated_price_sale: detailedAnalysis.estimated_price_sale,
        estimated_price_rent: detailedAnalysis.estimated_price_rent,
        estimated_price_monthly: detailedAnalysis.estimated_price_monthly,
        price_trend: detailedAnalysis.price_trend,
        building_features: detailedAnalysis.building_features,
        nearby_facilities: detailedAnalysis.nearby_facilities,
        analysis_summary: detailedAnalysis.analysis_summary,
        confidence: detailedAnalysis.confidence,
        latitude: locationData?.latitude || detailedAnalysis.latitude,
        longitude: locationData?.longitude || detailedAnalysis.longitude,
        real_price_data: realPriceData,
        investment_score: detailedAnalysis.investment_score,
        rental_analysis: detailedAnalysis.rental_analysis,
      };

      const saved = await base44.entities.BuildingAnalysis.create(finalData);
      setAnalysisData({ ...finalData, id: saved.id });
      setShowResult(true);
      setActiveTab('results');
      refetch();

    } catch (error) {
      console.error('분석 오류:', error);
      setAnalysisError(error.message || '분석 중 오류가 발생했습니다.');
      // 분석 실패 시에도 결과 화면 유지 (이미지 미리보기 보존)
      // showResult는 변경하지 않아 ImageUploader가 그대로 유지됨
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep(null);
    }
  };

  const handleSelectRecent = (analysis) => {
    setAnalysisData(analysis);
    setShowResult(true);
    setActiveTab('results');
  };

  const handleUpdateAnalysis = async (updatedData) => {
    if (!updatedData.id) return;
    await base44.entities.BuildingAnalysis.update(updatedData.id, updatedData);
    setAnalysisData(updatedData);
    refetch();
  };

  const handleManualAddressSubmit = async () => {
    if (!manualAddress.trim() || !analysisData) return;
    setShowManualInput(false);
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisStep('querying_price');

    try {
      let realPriceData = null;
      let priceType = "AI 추정가";

      try {
        const realPrice = await base44.functions.invoke('searchCommercialPrice', {
          address: manualAddress,
          buildingType: analysisData.building_type,
          estimatedYear: analysisData.estimated_year,
          estimatedArea: analysisData.estimated_area_pyeong
        });
        if (realPrice.data?.success && realPrice.data.data?.length > 0) {
          realPriceData = realPrice.data.data[0];
          priceType = "최근 실거래가";
        }
      } catch (e) {
        console.log('DB 조회 실패:', e);
      }

      if (!realPriceData) {
        try {
          const govPrice = await base44.functions.invoke('getRealEstatePrice', {
            address: manualAddress,
            buildingName: analysisData.building_name,
            buildingType: analysisData.building_type,
            estimatedYear: analysisData.estimated_year,
            estimatedArea: analysisData.estimated_area_pyeong
          });
          if (govPrice.data?.success && govPrice.data.data?.length > 0) {
            const govItem = govPrice.data.data[0];
            const rawAmount = (govItem.거래금액 || '0').toString().replace(/,/g, '').replace(/[^0-9]/g, '');
            realPriceData = {
              건물명: govItem.건물명 || analysisData.building_name,
              거래금액: parseInt(rawAmount) || 0,
              거래일: govItem.거래일,
              건축연도: govItem.건축연도 ? parseInt(govItem.건축연도) : null,
              전용면적: govItem.전용면적 || govItem.대지면적,
              층: govItem.층,
              건축물주용도: govItem.건축물주용도,
              용도지역: govItem.용도지역,
              매칭신뢰도: govItem.매칭신뢰도,
              매칭요인: govItem.매칭요인,
              데이터출처: '국토교통부 실거래가',
            };
            priceType = "국토교통부 실거래가";
          }
        } catch (e) {
          console.log('국토부 API 실패:', e);
        }
      }

      // 위치 정보 업데이트
      setAnalysisStep('reverse_geocoding');
      let newLat = analysisData.latitude;
      let newLng = analysisData.longitude;

      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress)}&limit=1`,
          { headers: { 'User-Agent': 'SnapEstate/1.0' } }
        );
        const geoData = await geoRes.json();
        if (geoData && geoData[0]) {
          newLat = parseFloat(geoData[0].lat);
          newLng = parseFloat(geoData[0].lon);
        }
      } catch (e) {
        console.log('지오코딩 실패:', e);
      }

      if (!analysisData) return;

      const updatedData = {
        ...analysisData,
        address: manualAddress,
        real_price_data: realPriceData,
        price_type: priceType,
        latitude: newLat,
        longitude: newLng,
      };

      if (analysisData.id) {
        await base44.entities.BuildingAnalysis.update(analysisData.id, updatedData);
        refetch();
      }
      setAnalysisData(updatedData);
      setManualAddress('');

    } catch (error) {
      setAnalysisError(error.message || '주소 재분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep(null);
    }
  };

  const handleLocationAccuracy = async (accuracy) => {
    if (accuracy === 'incorrect') {
      setShowManualInput(true);
      return;
    }
    if (analysisData?.id) {
      const updated = { ...analysisData, location_accuracy: accuracy };
      await base44.entities.BuildingAnalysis.update(analysisData.id, { location_accuracy: accuracy });
      setAnalysisData(updated);
      refetch();
    }
  };

  const handleBack = () => {
    setShowResult(false);
    setAnalysisData(null);
    setAnalysisError(null);
    setShowManualInput(false);
    setManualAddress('');
    setIsAnalyzing(false);
    setAnalysisStep(null);
  };

  return {
    isAnalyzing,
    analysisStep,
    analysisError,
    analysisData,
    showResult,
    showManualInput,
    manualAddress,
    activeTab,
    recentAnalyses,
    setManualAddress,
    setShowManualInput,
    setActiveTab,
    handleImageSelected,
    handleSelectRecent,
    handleUpdateAnalysis,
    handleManualAddressSubmit,
    handleLocationAccuracy,
    handleBack,
  };
}