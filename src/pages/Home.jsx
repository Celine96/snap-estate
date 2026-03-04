import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, X, MapPin, Share2, FileDown } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import ImageUploader from '../components/building/ImageUploader';
import AnalysisResult from '../components/building/AnalysisResult';
import RecentAnalyses from '../components/building/RecentAnalyses';
import ZoningInfo from '../components/building/ZoningInfo';
import InvestmentScore from '../components/building/InvestmentScore';
import RentalAnalysis from '../components/building/RentalAnalysis';
import { useAnalysis, ANALYSIS_STEPS } from '../components/hooks/useAnalysis';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

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

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleShare = async () => {
    if (!analysisData?.id) return;
    const shareUrl = `${window.location.origin}${createPageUrl('Share')}?id=${analysisData.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${analysisData.building_name || '건물 분석 결과'} - SnapEstate`,
          text: `${analysisData.building_name || '건물'} 매물 정보를 확인해보세요!`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('링크가 복사되었습니다');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('링크가 복사되었습니다');
      }
    }
  };

  const handleExportPdf = async () => {
    if (!analysisData?.id || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      // Google Fonts에서 한글 폰트 로드
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
      
      // 폰트 로드 대기
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { jsPDF } = await import('npm:jspdf@2.5.1');
      const html2canvas = (await import('npm:html2canvas@1.4.1')).default;

      const element = document.createElement('div');
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      element.style.width = '210mm';
      element.style.padding = '20mm';
      element.style.background = '#121214';
      element.style.color = '#fff';
      element.style.fontFamily = "'Noto Sans KR', sans-serif";
      
      element.innerHTML = `
        <div style="max-width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #2c2c2e;">
            <div style="color: #4D96FF; font-size: 20px; font-weight: bold;">SnapEstate</div>
            <div style="color: #9aa0a6; font-size: 12px;">${new Date().toLocaleDateString('ko-KR')}</div>
          </div>
          <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${analysisData.building_name || '건물 분석 결과'}</div>
          ${analysisData.address ? `<div style="color: #9aa0a6; font-size: 14px; margin-bottom: 15px;">📍 ${analysisData.address}</div>` : ''}
          ${analysisData.confidence ? `<div style="display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: bold; margin-bottom: 15px; background: ${analysisData.confidence === '높음' ? '#34d399' : analysisData.confidence === '보통' ? '#fbbf24' : '#ef4444'}; color: #1c1c1e;">${analysisData.confidence}</div>` : ''}
          
          ${analysisData.image_url ? `<img src="${analysisData.image_url}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 20px;" />` : ''}
          
          <div style="color: #9aa0a6; font-size: 12px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; border-top: 1px solid #2c2c2e; padding-top: 15px;">시세 정보</div>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
            ${analysisData.estimated_price_sale ? `<div style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px;"><div style="color: #9aa0a6; font-size: 11px; margin-bottom: 5px;">매매가</div><div style="color: #4D96FF; font-size: 16px; font-weight: bold;">${analysisData.estimated_price_sale}</div></div>` : ''}
            ${analysisData.estimated_price_rent ? `<div style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px;"><div style="color: #9aa0a6; font-size: 11px; margin-bottom: 5px;">전세가</div><div style="color: #fff; font-size: 16px; font-weight: bold;">${analysisData.estimated_price_rent}</div></div>` : ''}
            ${analysisData.estimated_price_monthly ? `<div style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px;"><div style="color: #9aa0a6; font-size: 11px; margin-bottom: 5px;">월세</div><div style="color: #fff; font-size: 16px; font-weight: bold;">${analysisData.estimated_price_monthly}</div></div>` : ''}
          </div>
          
          <div style="color: #9aa0a6; font-size: 12px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">건물 스펙</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px;">
            ${analysisData.building_type ? `<div style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px;"><div style="color: #9aa0a6; font-size: 11px; margin-bottom: 5px;">건물 유형</div><div style="color: #fff; font-size: 14px; font-weight: bold;">${analysisData.building_type}</div></div>` : ''}
            ${analysisData.estimated_year ? `<div style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px;"><div style="color: #9aa0a6; font-size: 11px; margin-bottom: 5px;">건축연도</div><div style="color: #fff; font-size: 14px; font-weight: bold;">${analysisData.estimated_year}</div></div>` : ''}
            ${analysisData.estimated_floors ? `<div style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px;"><div style="color: #9aa0a6; font-size: 11px; margin-bottom: 5px;">층수</div><div style="color: #fff; font-size: 14px; font-weight: bold;">${analysisData.estimated_floors}층</div></div>` : ''}
            ${analysisData.estimated_area_pyeong ? `<div style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 12px;"><div style="color: #9aa0a6; font-size: 11px; margin-bottom: 5px;">면적</div><div style="color: #fff; font-size: 14px; font-weight: bold;">${analysisData.estimated_area_pyeong}평</div></div>` : ''}
          </div>
          
          ${analysisData.price_trend ? `
            <div style="color: #9aa0a6; font-size: 12px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">시세 동향</div>
            <div style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 15px; font-size: 13px; line-height: 1.6; color: #fff; margin-bottom: 20px;">${analysisData.price_trend}</div>
          ` : ''}
          
          ${analysisData.analysis_summary ? `
            <div style="color: #9aa0a6; font-size: 12px; font-weight: bold; margin-top: 20px; margin-bottom: 10px;">AI 분석 요약</div>
            <div style="background: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 8px; padding: 15px; font-size: 13px; line-height: 1.6; color: #fff;">${analysisData.analysis_summary}</div>
          ` : ''}
        </div>
      `;
      
      document.body.appendChild(element);
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#121214', logging: false });
      document.body.removeChild(element);
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      
      pdf.save(`snapestate_${analysisData.building_name || 'report'}.pdf`);
      toast.success('PDF가 다운로드되었습니다');
    } catch (e) {
      toast.error('PDF 생성에 실패했습니다');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 업로드 화면
  if (!showResult) {
    return (
      <div className="min-h-screen bg-[#121214] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '80px 80px'
          }}
        />

        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#4D96FF]/[0.03] rounded-full blur-[100px]" />

        <div className="relative z-10 max-w-2xl mx-auto px-4 py-10 sm:py-14">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E] flex items-center justify-center">
                <Building2 className="w-5 h-5 text-[#9AA0A6]" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
              SnapEstate
            </h1>
            <p className="text-[#9AA0A6] text-base sm:text-lg max-w-lg mx-auto leading-relaxed" style={{ lineHeight: '1.8' }}>
              AI로 부동산 매물 사진에서<br className="sm:hidden" /> 위치·시세·스펙을 자동 추출합니다
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

            <div className="flex flex-wrap justify-center gap-2">
              {['건물 유형 분석', '추정 시세', '주변 환경', '투자 가치'].map((text, i) => (
                <motion.div
                  key={text}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + (i * 0.05) }}
                  className="px-3 py-1.5 rounded-lg bg-[#1C1C1E] border border-[#2C2C2E]"
                >
                  <span className="text-[#9AA0A6] text-xs">{text}</span>
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
        className="absolute top-4 left-4 z-[1000] w-10 h-10 rounded-2xl bg-[#1C1C1E]/90 backdrop-blur-sm border border-[#2C2C2E] flex items-center justify-center text-[#9AA0A6] hover:text-white transition-all"
      >
        <X className="w-5 h-5" />
      </button>

      {/* 패널 토글 (닫힌 상태) - 미니 카드 */}
      {!isPanelOpen && (
        <button
          onClick={() => setIsPanelOpen(true)}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-[calc(100%-2rem)] max-w-sm md:bottom-auto md:top-4 md:left-auto md:translate-x-0 md:right-4 md:w-auto px-4 py-3 rounded-2xl bg-[#1C1C1E]/95 backdrop-blur-sm border border-[#2C2C2E] text-white hover:bg-[#2C2C2E]/95 transition-all shadow-xl flex items-center gap-3"
        >
          {analysisData?.image_url && (
            <img src={analysisData.image_url} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
          )}
          <div className="text-left flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{analysisData?.building_name || '분석 결과'}</p>
            <p className="text-[#9AA0A6] text-xs">자세히 보기 →</p>
          </div>
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
            className="absolute bottom-0 right-0 h-[70vh] w-full md:top-0 md:bottom-auto md:h-full md:w-[480px] bg-[#121214] shadow-2xl z-[1000] overflow-y-auto rounded-t-2xl md:rounded-none"
          >
            {/* 패널 헤더 + 탭 */}
            <div className="sticky top-0 z-10 bg-[#121214] border-b border-[#2C2C2E]">
              {/* 드래그 핸들 (모바일) */}
              <div className="flex justify-center pt-3 pb-1 md:hidden">
                <div className="w-10 h-1 rounded-full bg-white/30" />
              </div>
              <div className="flex items-center justify-between p-4 pb-0">
                <div role="tablist" aria-label="분석 결과 탭" className="flex gap-2">
                  <button
                    role="tab"
                    aria-selected={activeTab === 'results'}
                    aria-controls="panel-results"
                    onClick={() => setActiveTab('results')}
                    className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-all ${
                      activeTab === 'results'
                        ? 'bg-[#1C1C1E] text-white border-t border-x border-[#2C2C2E]'
                        : 'text-[#9AA0A6] hover:text-white'
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
                        ? 'bg-[#1C1C1E] text-white border-t border-x border-[#2C2C2E]'
                        : 'text-[#9AA0A6] hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4 inline mr-1" aria-hidden="true" />
                    매물 정보
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleExportPdf}
                    aria-label="PDF 다운로드"
                    disabled={isExportingPdf}
                    title="PDF 다운로드"
                    className="w-9 h-9 rounded-xl hover:bg-[#1C1C1E] flex items-center justify-center text-[#9AA0A6] hover:text-white transition-all disabled:opacity-40"
                  >
                    {isExportingPdf
                      ? <div className="w-4 h-4 border-2 border-[#2C2C2E] border-t-[#4D96FF] rounded-full animate-spin" />
                      : <FileDown className="w-4 h-4" />
                    }
                  </button>
                  <button
                    onClick={handleShare}
                    aria-label="분석 결과 공유"
                    className="w-9 h-9 rounded-xl hover:bg-[#1C1C1E] flex items-center justify-center text-[#9AA0A6] hover:text-white transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsPanelOpen(false)}
                    aria-label="패널 닫기"
                    className="w-9 h-9 rounded-xl hover:bg-[#1C1C1E] flex items-center justify-center text-[#9AA0A6] hover:text-white transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <AnimatePresence mode="wait">
              {/* 위치 정보 탭 */}
              {activeTab === 'results' ? (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  id="panel-results" role="tabpanel" aria-labelledby="tab-results" className="space-y-4">
                  <div className="bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E] overflow-hidden">
                    {analysisData?.image_url && (
                      <img
                        src={analysisData.image_url}
                        alt="분석 이미지"
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-white font-bold text-base mb-1">
                          {analysisData?.building_name || '건물 분석'}
                        </h3>
                        {analysisData?.address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-[#9AA0A6] shrink-0 mt-0.5" />
                            <span className="text-sm text-[#9AA0A6]">{analysisData.address}</span>
                          </div>
                        )}
                      </div>

                      {analysisData?.latitude && analysisData?.longitude && (
                        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#2C2C2E]">
                          <div>
                            <p className="text-[#9AA0A6] text-xs mb-0.5">위도</p>
                            <p className="text-white text-sm font-mono tabular-nums">{analysisData.latitude.toFixed(6)}</p>
                          </div>
                          <div>
                            <p className="text-[#9AA0A6] text-xs mb-0.5">경도</p>
                            <p className="text-white text-sm font-mono tabular-nums">{analysisData.longitude.toFixed(6)}</p>
                          </div>
                        </div>
                      )}

                      {analysisData?.confidence && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121214] border border-[#2C2C2E]">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            analysisData.confidence === '높음' ? 'bg-emerald-400' :
                            analysisData.confidence === '보통' ? 'bg-amber-400' : 'bg-red-400'
                          }`} />
                          <span className={`text-xs ${
                            analysisData.confidence === '높음' ? 'text-emerald-400' :
                            analysisData.confidence === '보통' ? 'text-amber-400' : 'text-red-400'
                          }`}>신뢰도 {analysisData.confidence}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 위치 정확도 평가 */}
                  <div className="bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E] p-4 space-y-3">
                    <h4 className="text-white font-medium text-sm">위치 정확도를 평가해주세요</h4>
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-4">
                        <div className="w-5 h-5 border-2 border-[#2C2C2E] border-t-[#4D96FF] rounded-full animate-spin" />
                        <span className="text-[#9AA0A6] text-sm">
                          {analysisStep ? (ANALYSIS_STEPS[analysisStep] || '재분석 중...') : '재분석 중...'}
                        </span>
                      </div>
                    ) : showManualInput ? (
                      <div className="space-y-2">
                        <p className="text-[#9AA0A6] text-xs">정확한 지번 또는 도로명 주소를 입력하세요</p>
                        <input
                          type="text"
                          value={manualAddress}
                          onChange={(e) => setManualAddress(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleManualAddressSubmit()}
                          placeholder="예: 서울특별시 강남구 논현동 242-21"
                          className="w-full px-3 py-2 rounded-xl bg-[#121214] border border-[#2C2C2E] text-white text-sm placeholder-[#9AA0A6]/50 focus:outline-none focus:border-[#4D96FF]/40 transition-colors"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleManualAddressSubmit}
                            disabled={!manualAddress.trim()}
                            className="flex-1 py-2 rounded-xl bg-[#4D96FF] text-white text-sm font-semibold hover:bg-[#4D96FF]/90 transition-all disabled:opacity-40"
                          >
                            이 주소로 분석
                          </button>
                          <button
                            onClick={() => { setShowManualInput(false); setManualAddress(''); }}
                            className="px-3 py-2 rounded-xl border border-[#2C2C2E] bg-[#1C1C1E] text-[#9AA0A6] text-sm hover:text-white transition-all"
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
                          className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                            analysisData?.location_accuracy === 'incorrect'
                              ? 'bg-red-500/10 border-red-500/30 text-red-400'
                              : 'border-[#2C2C2E] bg-[#121214] text-[#9AA0A6] hover:border-[#4D96FF]/30 hover:text-white'
                          }`}
                        >
                          <X className="w-5 h-5" />
                          <span className="text-xs font-medium">부정확</span>
                        </button>
                        <button
                          onClick={() => handleLocationAccuracy('nearby')}
                          aria-label="위치가 근처입니다"
                          aria-pressed={analysisData?.location_accuracy === 'nearby'}
                          className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                            analysisData?.location_accuracy === 'nearby'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                              : 'border-[#2C2C2E] bg-[#121214] text-[#9AA0A6] hover:border-[#4D96FF]/30 hover:text-white'
                          }`}
                        >
                          <MapPin className="w-5 h-5" />
                          <span className="text-xs font-medium">근처</span>
                        </button>
                        <button
                          onClick={() => handleLocationAccuracy('accurate')}
                          aria-label="위치가 정확합니다"
                          aria-pressed={analysisData?.location_accuracy === 'accurate'}
                          className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                            analysisData?.location_accuracy === 'accurate'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'border-[#2C2C2E] bg-[#121214] text-[#9AA0A6] hover:border-[#4D96FF]/30 hover:text-white'
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
                      <p className="text-[#9AA0A6]/60 text-xs text-center">
                        부정확 선택 시 주소를 직접 입력하여 재분석합니다
                      </p>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="property"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                  id="panel-property" role="tabpanel" aria-labelledby="tab-property" className="space-y-6">
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
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}