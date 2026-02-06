import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowLeft, Sparkles, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";

import ImageUploader from '../components/building/ImageUploader';
import AnalysisResult from '../components/building/AnalysisResult';
import MapView from '../components/building/MapView';
import RecentAnalyses from '../components/building/RecentAnalyses';
import RentalAnalysis from '../components/building/RentalAnalysis';
import ZoningInfo from '../components/building/ZoningInfo';
import InvestmentScore from '../components/building/InvestmentScore';

export default function Home() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const { data: recentAnalyses = [], refetch } = useQuery({
    queryKey: ['building-analyses'],
    queryFn: () => base44.entities.BuildingAnalysis.list('-created_date', 8),
  });

  const handleImageSelected = async (file) => {
    setIsAnalyzing(true);
    
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `당신은 한국 부동산 전문 AI 분석가입니다. 이 건물 사진을 분석하여 건물의 스펙과 시세 정보를 추정해주세요.

**중요**: 정확한 실거래가 정보를 찾기 위해 인터넷 검색을 적극 활용하세요.
건물 주소와 관련된 최근 실거래 정보, 부동산 매물 정보를 검색하여 정확한 가격을 제공해주세요.

분석 시 다음 사항을 고려해주세요:
1. 건물의 외관, 구조, 재질, 디자인을 관찰하여 건물 유형과 건축연도를 추정
2. 층수와 면적을 추정
3. 한국의 2024-2025년 부동산 시세를 기반으로 매매가, 전세가, 월세를 추정
4. 건물의 특징과 주변 환경을 분석
5. 가능하다면 건물의 위치(위도/경도)를 추정 (한국 내 건물)
6. 시세 동향과 투자 가치에 대한 간단한 분석
7. 임대 수익률 분석 (월 임대수익, 연 수익률, 총 보증금, 예상 공실률)
8. 용도지역 및 법적 정보 (용도지역, 건폐율, 용적률, 법적 제한사항, 개발계획)
9. 투자 지표 점수 (종합, 입지, 수익성, 성장 가능성 각각 0-100점)

정확하지 않더라도 최선의 추정을 해주세요. 가격은 "약 X억 Y천만원" 또는 "약 X천만원" 형식으로 표시해주세요.
월세는 "보증금 X만원 / 월 Y만원" 형식으로 표시해주세요.
수익률은 "X.X%" 형식으로, 점수는 0-100 사이의 숫자로 표시해주세요.`,
      file_urls: [file_url],
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          building_name: { type: "string", description: "건물명 또는 추정 건물명" },
          price_type: { type: "string", enum: ["최근 실거래가", "신규 호가", "AI 추정가"], description: "가격 정보 유형 - 실거래 정보를 찾았다면 '최근 실거래가', 매물 호가를 찾았다면 '신규 호가', 추정이면 'AI 추정가'" },
          address: { type: "string", description: "추정 주소" },
          district: { type: "string", description: "구/동 정보" },
          building_type: { type: "string", enum: ["아파트", "오피스텔", "상가", "빌라/다세대", "단독주택", "오피스", "기타"] },
          estimated_year: { type: "string", description: "추정 건축연도" },
          estimated_floors: { type: "number", description: "추정 층수" },
          estimated_area_pyeong: { type: "string", description: "추정 면적(평)" },
          estimated_price_sale: { type: "string", description: "추정 매매가" },
          estimated_price_rent: { type: "string", description: "추정 전세가" },
          estimated_price_monthly: { type: "string", description: "추정 월세 (보증금/월세)" },
          price_trend: { type: "string", description: "시세 동향 설명" },
          building_features: { type: "array", items: { type: "string" }, description: "건물 특징들" },
          nearby_facilities: { type: "array", items: { type: "string" }, description: "주변 시설 추정" },
          latitude: { type: "number", description: "추정 위도" },
          longitude: { type: "number", description: "추정 경도" },
          confidence: { type: "string", enum: ["높음", "보통", "낮음"] },
          analysis_summary: { type: "string", description: "종합 분석 요약 (3~4문장)" },
          rental_income: {
            type: "object",
            properties: {
              monthly_income: { type: "string", description: "월 임대수익 (예: 약 450만원)" },
              annual_yield: { type: "string", description: "연 수익률 (예: 4.8%)" },
              total_deposit: { type: "string", description: "총 보증금 (예: 약 3억원)" },
              occupancy_rate: { type: "string", description: "예상 공실률 (예: 5%)" }
            }
          },
          zoning_info: {
            type: "object",
            properties: {
              land_use_zone: { type: "string", description: "용도지역 (예: 제2종일반주거지역)" },
              building_to_land_ratio: { type: "string", description: "건폐율 (예: 60%)" },
              floor_area_ratio: { type: "string", description: "용적률 (예: 200%)" },
              legal_restrictions: { type: "array", items: { type: "string" }, description: "법적 제한사항 리스트" },
              development_plan: { type: "string", description: "개발계획 정보" }
            }
          },
          investment_score: {
            type: "object",
            properties: {
              overall: { type: "number", description: "종합 투자점수 (0-100)" },
              location: { type: "number", description: "입지 점수 (0-100)" },
              profitability: { type: "number", description: "수익성 점수 (0-100)" },
              growth_potential: { type: "number", description: "성장 가능성 점수 (0-100)" }
            }
          }
        }
      }
    });

    const savedData = {
      image_url: file_url,
      ...result,
    };
    
    await base44.entities.BuildingAnalysis.create(savedData);
    setAnalysisData(savedData);
    setShowResult(true);
    setIsAnalyzing(false);
    refetch();
  };

  const handleSelectRecent = (item) => {
    setAnalysisData(item);
    setShowResult(true);
  };

  const handleUpdateAnalysis = async (updatedData) => {
    await base44.entities.BuildingAnalysis.update(updatedData.id, updatedData);
    setAnalysisData(updatedData);
    refetch();
  };

  const handleBack = () => {
    setShowResult(false);
    setAnalysisData(null);
  };

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
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          {showResult && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={handleBack}
              className="absolute left-4 top-8 sm:top-12 flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">돌아가기</span>
            </motion.button>
          )}
          
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Building2 className="w-6 h-6 text-black" />
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
            빌딩 스캐너
          </h1>
          <p className="text-white/40 text-sm sm:text-base max-w-md mx-auto">
            건물 사진 한 장으로 스펙과 시세를 AI가 분석합니다
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!showResult ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <ImageUploader
                onImageSelected={handleImageSelected}
                isAnalyzing={isAnalyzing}
              />

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center gap-3">
                {['건물 유형 분석', '추정 시세', '주변 환경', '투자 가치'].map((text, i) => (
                  <motion.div
                    key={text}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + (i * 0.05) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400/60" />
                    <span className="text-white/50 text-xs">{text}</span>
                  </motion.div>
                ))}
              </div>

              <RecentAnalyses
                analyses={recentAnalyses}
                onSelect={handleSelectRecent}
              />
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Uploaded image */}
              {analysisData?.image_url && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="rounded-2xl overflow-hidden border border-white/10"
                >
                  <img
                    src={analysisData.image_url}
                    alt="분석된 건물"
                    className="w-full h-56 sm:h-64 object-cover"
                  />
                </motion.div>
              )}

              <MapView
                latitude={analysisData?.latitude}
                longitude={analysisData?.longitude}
                buildingName={analysisData?.building_name}
              />

              <AnalysisResult data={analysisData} onUpdate={handleUpdateAnalysis} />

              {analysisData?.investment_score && (
                <InvestmentScore data={analysisData.investment_score} />
              )}

              {analysisData?.rental_income && (
                <RentalAnalysis data={analysisData.rental_income} />
              )}

              {analysisData?.zoning_info && (
                <ZoningInfo data={analysisData.zoning_info} />
              )}

              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleBack}
                  variant="outline"
                  className="bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                >
                  <Search className="w-4 h-4 mr-2" />
                  새로운 건물 분석하기
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}