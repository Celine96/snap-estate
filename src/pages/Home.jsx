import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, X, MapPin, Share2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import ImageUploader from '../components/building/ImageUploader';
import AnalysisResult from '../components/building/AnalysisResult';
import RecentAnalyses from '../components/building/RecentAnalyses';
import ZoningInfo from '../components/building/ZoningInfo';
import InvestmentScore from '../components/building/InvestmentScore';
import RentalAnalysis from '../components/building/RentalAnalysis';
import { useAnalysis, ANALYSIS_STEPS } from '@/hooks/useAnalysis';

// Fix leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function Home() {
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const {
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
  } = useAnalysis();

  const handleShare = async () => {
    if (!analysisData) return;
    const shareText = [
      `🏢 ${analysisData.building_name || '건물 분석 결과'}`,
      analysisData.address ? `📍 ${analysisData.address}` : '',
      analysisData.estimated_price_sale ? `💰 매매가: ${analysisData.estimated_price_sale}` : '',
      analysisData.estimated_price_rent ? `🏠 전세가: ${analysisData.estimated_price_rent}` : '',
      analysisData.estimated_price_monthly ? `📅 월세: ${analysisData.estimated_price_monthly}` : '',
      '',
      'SnapEstate - AI 건물 분석'
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: analysisData.building_name || 'SnapEstate 분석 결과', text: shareText });
      } catch (e) {
        if (e.name !== 'AbortError') await navigator.clipboard.writeText(shareText);
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      alert('분석 결과가 클립보드에 복사되었습니다.');
    }
  };

  // 업로드 화면
  if (!showResult) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px'
          }}
        />

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
              analysisStep={analysisStep}
              analysisError={analysisError}
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

  // 결과 화면 (지도 + 패널)
  return (
    <div className="h-screen w-screen relative overflow-hidden bg-slate-900">
      {/* 전체 화면 지도 */}
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

      {/* 닫기 버튼 */}
      <button
        onClick={handleBack}
        aria-label="분석 결과 닫기"
        className="absolute top-4 left-4 z-[1000] w-10 h-10 rounded-full bg-slate-800/90 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-slate-700/90 transition-all"
      >
        <X className="w-5 h-5" />
      </button>

      {/* 패널 토글 (닫힌 상태) */}
      {!isPanelOpen && (
        <button
          onClick={() => setIsPanelOpen(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 md:bottom-auto md:top-4 md:left-auto md:translate-x-0 md:right-4 z-[1000] px-4 py-2.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-white/90 transition-all shadow-lg"
        >
          분석 결과
        </button>
      )}

      {/* 우측 패널 */}
      <AnimatePresence>
        {isPanelOpen && (
          <motion.div
            initial={{ y: '100%', x: 0 }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: '100%', x: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute bottom-0 right-0 h-[70vh] w-full md:top-0 md:bottom-auto md:h-full md:w-[480px] bg-slate-900 shadow-2xl z-[1000] overflow-y-auto rounded-t-2xl md:rounded-none"
          >
            {/* 패널 헤더 + 탭 */}
            <div className="sticky top-0 z-10 bg-slate-900 border-b border-white/10">
              <div className="flex items-center justify-between p-4 pb-0">
                <div role="tablist" aria-label="분석 결과 탭" className="flex gap-2">
                  <button
                    role="tab"
                    aria-selected={activeTab === 'results'}
                    aria-controls="panel-results"
                    onClick={() => setActiveTab('results')}
                    className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-all ${
                      activeTab === 'results'
                        ? 'bg-white text-slate-900'
                        : 'text-white/60 hover:text-white/80'
                    }`}
                  >
                    <MapPin className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    위치 정보
                  </button>
                  <button
                    role="tab"
                    aria-selected={activeTab === 'property'}
                    aria-controls="panel-property"
                    onClick={() => setActiveTab('property')}
                    className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-all ${
                      activeTab === 'property'
                        ? 'bg-white text-slate-900'
                        : 'text-white/60 hover:text-white/80'
                    }`}
                  >
                    <Building2 className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    매물 정보
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleShare}
                    aria-label="분석 결과 공유"
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsPanelOpen(false)}
                    aria-label="패널 닫기"
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* 위치 정보 탭 */}
              {activeTab === 'results' && (
                <div id="panel-results" role="tabpanel" aria-labelledby="tab-results" className="space-y-4">
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

                  {/* 위치 정확도 평가 */}
                  <div className="bg-white/[0.04] rounded-xl border border-white/10 p-4 space-y-3">
                    <h4 className="text-white font-medium text-sm">위치 정확도를 평가해주세요</h4>
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-4">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span className="text-white/60 text-sm">
                          {analysisStep ? (ANALYSIS_STEPS[analysisStep] || '재분석 중...') : '재분석 중...'}
                        </span>
                      </div>
                    ) : showManualInput ? (
                      <div className="space-y-2">
                        <p className="text-white/50 text-xs">정확한 지번 또는 도로명 주소를 입력하세요</p>
                        <input
                          type="text"
                          value={manualAddress}
                          onChange={(e) => setManualAddress(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleManualAddressSubmit()}
                          placeholder="예: 서울특별시 강남구 논현동 242-21"
                          className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/40"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleManualAddressSubmit}
                            disabled={!manualAddress.trim()}
                            className="flex-1 py-2 rounded-lg bg-white text-slate-900 text-sm font-semibold hover:bg-white/90 transition-all disabled:opacity-40"
                          >
                            이 주소로 분석
                          </button>
                          <button
                            onClick={() => { setShowManualInput(false); setManualAddress(''); }}
                            className="px-3 py-2 rounded-lg border border-white/20 text-white/60 text-sm hover:text-white hover:border-white/40 transition-all"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2" role="group" aria-label="위치 정확도 평가">
                        <button
                          onClick={() => handleLocationAccuracy('incorrect')}
                          aria-label="위치가 부정확합니다"
                          aria-pressed={analysisData?.location_accuracy === 'incorrect'}
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
                          aria-label="위치가 근처입니다"
                          aria-pressed={analysisData?.location_accuracy === 'nearby'}
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
                          aria-label="위치가 정확합니다"
                          aria-pressed={analysisData?.location_accuracy === 'accurate'}
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
                    {analysisError && !isAnalyzing && (
                      <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-red-400 text-xs text-center">{analysisError}</p>
                      </div>
                    )}
                    {!showManualInput && !isAnalyzing && !analysisError && (
                      <p className="text-white/40 text-xs text-center">
                        부정확 선택 시 주소를 직접 입력하여 재분석합니다
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 매물 정보 탭 */}
              {activeTab === 'property' && (
                <div id="panel-property" role="tabpanel" aria-labelledby="tab-property" className="bg-white/[0.04] rounded-xl border border-white/10 p-4 space-y-6">
                  <AnalysisResult data={analysisData} onUpdate={handleUpdateAnalysis} />

                  {analysisData?.investment_score && (
                    <InvestmentScore data={analysisData.investment_score} />
                  )}

                  {analysisData?.rental_analysis && (
                    <RentalAnalysis data={analysisData.rental_analysis} />
                  )}

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
