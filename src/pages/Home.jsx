import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowLeft, Sparkles, Search, X, ChevronRight, MapPin } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import ImageUploader from '../components/building/ImageUploader';
import AnalysisResult from '../components/building/AnalysisResult';
import MapView from '../components/building/MapView';
import RecentAnalyses from '../components/building/RecentAnalyses';
import ZoningInfo from '../components/building/ZoningInfo';

// Fix leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
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
    
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    // 1단계: 위치 정보 추출 (EXIF GPS 우선)
    let locationData = null;
    try {
      const location = await base44.functions.getImageLocation({ imageUrl: file_url });
      locationData = location;
    } catch (error) {
      console.log('위치 추출 실패:', error);
    }
    
    // 2단계: GPS 좌표로 정확한 주소 찾기 (역지오코딩)
    let addressFromGPS = null;
    if (locationData?.latitude && locationData?.longitude) {
      try {
        const geoResult = await base44.integrations.Core.InvokeLLM({
          prompt: `다음 GPS 좌표의 정확한 도로명 주소와 지번 주소를 찾아주세요:
위도: ${locationData.latitude}
경도: ${locationData.longitude}

네이버 지도나 카카오맵에서 이 좌표를 검색하고, 정확한 주소를 반환하세요.
반드시 "서울특별시 XX구 XX동" 형식으로 시작해야 합니다.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              road_address: { type: "string", description: "도로명 주소 (예: 서울특별시 강남구 테헤란로 123)" },
              jibun_address: { type: "string", description: "지번 주소 (예: 서울특별시 강남구 역삼동 123-45)" },
              district: { type: "string", description: "구 (예: 강남구)" },
              dong: { type: "string", description: "동 (예: 역삼동)" }
            }
          }
        });
        addressFromGPS = geoResult;
        console.log('GPS 역지오코딩 성공:', geoResult);
      } catch (error) {
        console.log('GPS 역지오코딩 실패:', error);
      }
    }
    
    // 3단계: 기본 정보 추출 (GPS 주소 활용)
    const basicInfo = await base44.integrations.Core.InvokeLLM({
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

    // 4단계: 실거래가 조회 (GPS 주소 우선 사용)
    let realPriceData = null;
    let priceType = "AI 추정가";
    
    const searchAddress = addressFromGPS?.jibun_address || basicInfo.address;
    console.log('실거래가 검색 주소:', searchAddress);
    
    // AI 추정 건축연도/면적 빠른 추출 (실거래가 매칭용)
    let quickEstimates = null;
    try {
      quickEstimates = await base44.integrations.Core.InvokeLLM({
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
      });
    } catch (e) {
      console.log('빠른 추정 실패:', e);
    }
    
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
      console.log('실거래가 조회 실패, AI 추정으로 전환:', error);
    }

    // 실거래가 매매가 직접 변환 (AI에 의존하지 않음)
    function convertManwon(manwon) {
      const num = typeof manwon === 'string' ? parseInt(manwon.replace(/,/g, '')) : manwon;
      if (isNaN(num)) return null;
      if (num >= 10000) {
        const eok = Math.floor(num / 10000);
        const remain = num % 10000;
        return remain > 0 ? `약 ${eok}억 ${remain.toLocaleString()}만원` : `약 ${eok}억원`;
      }
      return `약 ${num.toLocaleString()}만원`;
    }
    const realPriceSaleStr = realPriceData ? convertManwon(realPriceData.거래금액) : null;

    // 5단계: 상세 분석 (GPS 주소 활용)
    const result = await base44.integrations.Core.InvokeLLM({
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
          }
        }
      }
    });

    const savedData = {
      image_url: file_url,
      ...result,
      // 핵심 필드는 반드시 덮어씌워 AI 결과가 오염하지 못하도록 함
      building_name: basicInfo.building_name,
      address: addressFromGPS?.jibun_address || basicInfo.address,
      district: basicInfo.district,
      building_type: basicInfo.building_type,
      // price_type은 반드시 실거래가 조회 결과로만 결정 (AI가 임의로 바꾸지 못하도록)
      price_type: priceType,
      real_price_data: realPriceData || null,
      // 실거래가가 있으면 매매가는 DB 값으로 덮어씀 (AI 추정값 무시)
      ...(realPriceSaleStr ? { estimated_price_sale: realPriceSaleStr } : {}),
      latitude: locationData?.latitude || result.latitude,
      longitude: locationData?.longitude || result.longitude,
      location_source: locationData?.source || 'AI 추정'
    };
    
    const createdData = await base44.entities.BuildingAnalysis.create(savedData);
    setAnalysisData(createdData);
    setShowResult(true);
    setIsAnalyzing(false);
    refetch();
  };

  const handleSelectRecent = async (item) => {
    setAnalysisData(item);
    setShowResult(true);

    // 실거래가 재조회 시도 (신규 분석과 동일한 로직)
    try {
      const searchAddress = item.address || item.district;
      if (!searchAddress) return;

      const realPrice = await base44.functions.invoke('searchCommercialPrice', {
        address: searchAddress,
        buildingType: item.building_type,
        estimatedYear: item.estimated_year,
        estimatedArea: item.estimated_area_pyeong ? parseFloat(item.estimated_area_pyeong) : undefined
      });

      if (realPrice.data?.success && realPrice.data.data?.length > 0) {
        const realPriceData = realPrice.data.data[0];
        const updated = { ...item, real_price_data: realPriceData, price_type: '최근 실거래가' };
        setAnalysisData(updated);
        await base44.entities.BuildingAnalysis.update(item.id, { real_price_data: realPriceData, price_type: '최근 실거래가' });
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

    const file_url = analysisData.image_url;

    // 수동 입력 주소로 실거래가 조회
    let realPriceData = null;
    let priceType = "AI 추정가";
    try {
      const realPrice = await base44.functions.searchCommercialPrice({
        address: manualAddress.trim(),
        buildingType: analysisData.building_type,
        estimatedYear: analysisData.estimated_year,
        estimatedArea: analysisData.estimated_area_pyeong ? parseFloat(analysisData.estimated_area_pyeong) : undefined
      });
      if (realPrice.data?.success && realPrice.data.data?.length > 0) {
        realPriceData = realPrice.data.data[0];
        priceType = "최근 실거래가";
      }
    } catch (e) {
      console.log('실거래가 조회 실패:', e);
    }

    // 수동 주소로 상세 분석
    const result = await base44.integrations.Core.InvokeLLM({
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

    function convertManwon(manwon) {
      const num = typeof manwon === 'string' ? parseInt(manwon.replace(/,/g, '')) : manwon;
      if (isNaN(num)) return null;
      if (num >= 10000) {
        const eok = Math.floor(num / 10000);
        const remain = num % 10000;
        return remain > 0 ? `약 ${eok}억 ${remain.toLocaleString()}만원` : `약 ${eok}억원`;
      }
      return `약 ${num.toLocaleString()}만원`;
    }
    const realPriceSaleStr = realPriceData ? convertManwon(realPriceData.거래금액) : null;

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
    setIsAnalyzing(false);
  };

  const handleLocationAccuracy = async (accuracy) => {
    if (!analysisData?.id) return;
    
    // "부정확" 선택 시 주소 직접 입력창 표시
    if (accuracy === 'incorrect') {
      setShowManualInput(true);
      const updatedConfidence = { ...analysisData, confidence: '낮음', location_accuracy: accuracy };
      await base44.entities.BuildingAnalysis.update(analysisData.id, updatedConfidence);
      setAnalysisData(updatedConfidence);
      refetch();
      
      // 2단계: 재분석 시작
      setIsAnalyzing(true);
      
      try {
        const file_url = analysisData.image_url;
        
        // 1단계: 위치 정보 재추출
        let locationData = null;
        try {
          const location = await base44.functions.getImageLocation({ imageUrl: file_url });
          locationData = location;
        } catch (error) {
          console.log('위치 추출 실패:', error);
        }
        
        // 2단계: GPS 좌표로 정확한 주소 찾기
        let addressFromGPS = null;
        if (locationData?.latitude && locationData?.longitude) {
          try {
            const geoResult = await base44.integrations.Core.InvokeLLM({
              prompt: `다음 GPS 좌표의 정확한 도로명 주소와 지번 주소를 찾아주세요:
위도: ${locationData.latitude}
경도: ${locationData.longitude}

네이버 지도나 카카오맵에서 이 좌표를 검색하고, 정확한 주소를 반환하세요.
반드시 "서울특별시 XX구 XX동" 형식으로 시작해야 합니다.`,
              add_context_from_internet: true,
              response_json_schema: {
                type: "object",
                properties: {
                  road_address: { type: "string" },
                  jibun_address: { type: "string" },
                  district: { type: "string" },
                  dong: { type: "string" }
                }
              }
            });
            addressFromGPS = geoResult;
          } catch (error) {
            console.log('GPS 역지오코딩 실패:', error);
          }
        }
        
        // 3단계: 기본 정보 재추출
        const basicInfo = await base44.integrations.Core.InvokeLLM({
          prompt: `당신은 한국 부동산 전문가입니다. 이 건물 사진을 매우 정확하게 분석하세요.

${addressFromGPS ? `
🎯 GPS 좌표로 확인된 정확한 주소:
- 도로명 주소: ${addressFromGPS.road_address}
- 지번 주소: ${addressFromGPS.jibun_address}
- 지역: ${addressFromGPS.district} ${addressFromGPS.dong}

이 주소를 기준으로 분석하세요. 사진 속 건물명을 찾아주세요.
` : ''}

정확한 건물명, 주소, 건물 유형을 찾으세요.`,
          file_urls: [file_url],
          add_context_from_internet: true,
          response_json_schema: {
            type: "object",
            properties: {
              address: { type: "string" },
              building_name: { type: "string" },
              district: { type: "string" },
              building_type: { type: "string", enum: ["아파트", "오피스텔", "상가", "빌라/다세대", "단독주택", "오피스", "기타"] }
            }
          }
        });

        // 4단계: 실거래가 재조회
        let realPriceData = null;
        let priceType = "AI 추정가";
        
        const searchAddress = addressFromGPS?.jibun_address || basicInfo.address;
        
        let quickEstimates = null;
        try {
          quickEstimates = await base44.integrations.Core.InvokeLLM({
            prompt: `사진 속 건물의 건축연도와 대략적인 면적을 추정하세요.`,
            file_urls: [file_url],
            response_json_schema: {
              type: "object",
              properties: {
                year: { type: "string" },
                area_pyeong: { type: "number" }
              }
            }
          });
        } catch (e) {
          console.log('빠른 추정 실패:', e);
        }
        
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
          console.log('실거래가 조회 실패:', error);
        }

        // 5단계: 상세 분석
        const result = await base44.integrations.Core.InvokeLLM({
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

${realPriceData ? `
💰 **국토교통부 실거래가:**
- 거래금액: ${realPriceData.거래금액} 만원
- 거래일: ${realPriceData.거래일}
- 건축년도: ${realPriceData.건축연도}년
- 전용면적: ${realPriceData.전용면적}㎡
` : ''}

정확한 건물 스펙, 시세, 주변 환경을 평가하세요.
용도지역 정보는 토지이음(https://www.eum.go.kr) 사이트에서 해당 지번으로 검색하여 공식 데이터를 가져오세요.`,
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

        const updatedData = {
          ...analysisData,
          building_name: basicInfo.building_name,
          address: addressFromGPS?.jibun_address || basicInfo.address,
          district: basicInfo.district,
          building_type: basicInfo.building_type,
          price_type: priceType,
          latitude: locationData?.latitude || result.latitude,
          longitude: locationData?.longitude || result.longitude,
          ...result,
          real_price_data: realPriceData,
          location_accuracy: null, // 재분석 후 평가 초기화
          location_source: locationData?.source || 'AI 추정'
        };
        
        await base44.entities.BuildingAnalysis.update(analysisData.id, updatedData);
        setAnalysisData(updatedData);
        refetch();
        setIsAnalyzing(false);
      } catch (error) {
        console.error('재분석 실패:', error);
        setIsAnalyzing(false);
      }
    } else {
      // "근처" 또는 "정확" 선택 시 평가만 저장
      const updatedData = { ...analysisData, location_accuracy: accuracy };
      await base44.entities.BuildingAnalysis.update(analysisData.id, updatedData);
      setAnalysisData(updatedData);
      refetch();
    }
  };

  const handleBack = () => {
    setShowResult(false);
    setAnalysisData(null);
  };

  // Upload screen
  if (!showResult) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
        {/* Background grid */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />
        
        {/* Ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/5 rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 py-8 sm:py-12">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-slate-300" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
              SnapEstate
            </h1>
            <p className="text-white/40 text-sm sm:text-base max-w-md mx-auto">
              건물 사진 한 장으로 스펙과 시세를 AI가 분석합니다
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <ImageUploader
              onImageSelected={handleImageSelected}
              isAnalyzing={isAnalyzing}
            />

            <div className="flex flex-wrap justify-center gap-3">
              {['건물 유형 분석', '추정 시세', '주변 환경', '투자 가치'].map((text, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + (i * 0.05) }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700"
                >
                  <span className="text-slate-300 text-xs font-medium">{text}</span>
                </motion.div>
              ))}
            </div>

            <RecentAnalyses
              analyses={recentAnalyses}
              onSelect={handleSelectRecent}
            />
          </motion.div>
        </div>
      </div>
    );
  }

  // Result screen with full map
  return (
    <div className="h-screen w-screen relative overflow-hidden bg-slate-900">
      {/* Full Screen Map */}
      {analysisData?.latitude && analysisData?.longitude && (
        <MapContainer
          center={[analysisData.latitude, analysisData.longitude]}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          <Marker position={[analysisData.latitude, analysisData.longitude]}>
            <Popup>
              <span className="font-medium">{analysisData.building_name || '분석된 건물'}</span>
            </Popup>
          </Marker>
        </MapContainer>
      )}

      {/* Close Button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 z-[1000] w-10 h-10 rounded-full bg-slate-800/90 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-slate-700/90 transition-all"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Panel Toggle when closed */}
      {!isPanelOpen && (
        <button
          onClick={() => setIsPanelOpen(true)}
          className="absolute top-4 right-4 z-[1000] px-4 py-2.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-white/90 transition-all shadow-lg"
        >
          Results
        </button>
      )}

      {/* Right Side Panel */}
      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute top-0 right-0 h-full w-full md:w-[480px] bg-slate-900 shadow-2xl z-[1000] overflow-y-auto"
          >
            {/* Panel Header with Tabs */}
            <div className="sticky top-0 z-10 bg-slate-900 border-b border-white/10">
              <div className="flex items-center justify-between p-4 pb-0">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('results')}
                    className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-all ${
                      activeTab === 'results'
                        ? 'bg-white text-slate-900'
                        : 'text-white/60 hover:text-white/80'
                    }`}
                  >
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Results
                  </button>
                  <button
                    onClick={() => setActiveTab('property')}
                    className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-all ${
                      activeTab === 'property'
                        ? 'bg-white text-slate-900'
                        : 'text-white/60 hover:text-white/80'
                    }`}
                  >
                    <Building2 className="w-4 h-4 inline mr-1" />
                    매물 정보
                  </button>
                </div>
                <button
                  onClick={() => setIsPanelOpen(false)}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Results Tab Content */}
              {activeTab === 'results' && (
                <div className="space-y-4">
                  <div className="bg-white/[0.04] rounded-xl border border-white/10 overflow-hidden">
                    {analysisData?.image_url && (
                      <img
                        src={analysisData.image_url}
                        alt="분석 이미지"
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-white font-semibold text-base mb-1">
                          {analysisData?.building_name || '건물 분석'}
                        </h3>
                        {analysisData?.address && (
                          <div className="flex items-start gap-2 text-white/60">
                            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="text-sm">{analysisData.address}</span>
                          </div>
                        )}
                      </div>
                      
                      {analysisData?.latitude && analysisData?.longitude && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                          <div>
                            <p className="text-white/40 text-xs mb-0.5">위도</p>
                            <p className="text-white text-sm font-mono">{analysisData.latitude.toFixed(6)}</p>
                          </div>
                          <div>
                            <p className="text-white/40 text-xs mb-0.5">경도</p>
                            <p className="text-white text-sm font-mono">{analysisData.longitude.toFixed(6)}</p>
                          </div>
                        </div>
                      )}

                      {analysisData?.confidence && (
                        <Badge className={`
                          ${analysisData.confidence === '높음' ? 'bg-green-500/20 text-green-400 border-green-500/20' : ''}
                          ${analysisData.confidence === '보통' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : ''}
                          ${analysisData.confidence === '낮음' ? 'bg-red-500/20 text-red-400 border-red-500/20' : ''}
                          border text-xs
                        `}>
                          신뢰도: {analysisData.confidence}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Location Accuracy Evaluation */}
                  <div className="bg-white/[0.04] rounded-xl border border-white/10 p-4 space-y-3">
                    <h4 className="text-white font-medium text-sm">위치 정확도를 평가해주세요</h4>
                    {isAnalyzing ? (
                      <div className="flex items-center justify-center gap-2 py-4">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span className="text-white/60 text-sm">재분석 중...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleLocationAccuracy('incorrect')}
                          className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-2 ${
                            analysisData?.location_accuracy === 'incorrect'
                              ? 'bg-red-500/20 border-red-500/50 text-red-400'
                              : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white/80'
                          }`}
                        >
                          <X className="w-5 h-5" />
                          <span className="text-xs font-medium">부정확</span>
                        </button>
                        <button
                          onClick={() => handleLocationAccuracy('nearby')}
                          className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-2 ${
                            analysisData?.location_accuracy === 'nearby'
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                              : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white/80'
                          }`}
                        >
                          <MapPin className="w-5 h-5" />
                          <span className="text-xs font-medium">근처</span>
                        </button>
                        <button
                          onClick={() => handleLocationAccuracy('accurate')}
                          className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-2 ${
                            analysisData?.location_accuracy === 'accurate'
                              ? 'bg-green-500/20 border-green-500/50 text-green-400'
                              : 'border-white/10 text-white/60 hover:border-white/30 hover:text-white/80'
                          }`}
                        >
                          <Building2 className="w-5 h-5" />
                          <span className="text-xs font-medium">정확</span>
                        </button>
                      </div>
                    )}
                    {analysisData?.location_accuracy === null && !isAnalyzing && (
                      <p className="text-white/40 text-xs text-center">
                        💡 부정확 선택 시 자동으로 재분석합니다
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Property Info Tab Content */}
              {activeTab === 'property' && (
                <div className="bg-white/[0.04] rounded-xl border border-white/10 p-4 space-y-6">
                  <AnalysisResult data={analysisData} onUpdate={handleUpdateAnalysis} />
                  
                  {analysisData?.zoning_info && (
                    <ZoningInfo data={analysisData.zoning_info} />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}