import React, { useState, useRef } from 'react';
import { CloudUpload, X } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const STEP_MESSAGES = {
  uploading: '이미지를 업로드하고 있습니다...',
  extracting_location: '위치 정보를 추출하고 있습니다...',
  reverse_geocoding: 'GPS 좌표로 주소를 확인하고 있습니다...',
  analyzing_building: '건물 정보를 분석하고 있습니다...',
  querying_price: '실거래가를 조회하고 있습니다...',
  detailed_analysis: '상세 분석을 진행하고 있습니다...',
  saving: '분석 결과를 저장하고 있습니다...',
};

const STEP_ORDER = ['uploading', 'extracting_location', 'reverse_geocoding', 'analyzing_building', 'querying_price', 'detailed_analysis', 'saving'];

// 샘플 이미지 URL (건물 사진)
const SAMPLE_IMAGE_URL = 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80';

export default function ImageUploader({ onImageSelected, isAnalyzing, analysisStep, analysisError }) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드할 수 있습니다', { description: 'JPG, PNG, WEBP 형식을 지원합니다' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('파일 크기가 너무 큽니다', { description: '20MB 이하의 이미지를 업로드해주세요' });
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onImageSelected(file);
  };

  const handleSampleImage = async () => {
    const res = await fetch(SAMPLE_IMAGE_URL);
    const blob = await res.blob();
    const file = new File([blob], 'sample-building.jpg', { type: 'image/jpeg' });
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onImageSelected(file);
  };

  const clearImage = () => setPreviewUrl(null);

  const currentStepIndex = STEP_ORDER.indexOf(analysisStep);
  const progressPercent = analysisStep ? Math.round(((currentStepIndex + 1) / STEP_ORDER.length) * 100) : 0;

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!previewUrl ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="건물 사진 업로드 영역. 클릭하거나 이미지를 드래그하세요."
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer
                ${dragActive
                  ? 'border-blue-400 bg-blue-400/5'
                  : 'border-white/20 hover:border-blue-400/60 bg-white/5 hover:bg-blue-500/[0.04]'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                aria-label="이미지 파일 선택"
                className="hidden"
                onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
              />
              <div className="flex flex-col items-center gap-4">
                <motion.div
                  animate={dragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 border
                    ${dragActive ? 'bg-blue-500/20 border-blue-400/50' : 'bg-slate-800 border-slate-700'}`}
                >
                  <CloudUpload className={`w-8 h-8 transition-colors duration-300 ${dragActive ? 'text-blue-400' : 'text-slate-400'}`} />
                </motion.div>
                <div>
                  <p className="text-white font-semibold text-lg mb-1 leading-relaxed">
                    건물 사진을 업로드하세요
                  </p>
                  <p className="text-white/40 text-sm leading-relaxed">
                    드래그 앤 드롭 또는 클릭하여 이미지 선택
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-500/20"
                >
                  이미지 업로드
                </button>
                <div className="flex gap-2">
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white/50 text-xs">JPG</span>
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white/50 text-xs">PNG</span>
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white/50 text-xs">WEBP</span>
                </div>
              </div>
            </div>

            {/* 샘플 이미지 테스트 버튼 */}
            <button
              type="button"
              onClick={handleSampleImage}
              className="w-full py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-white/50 hover:text-white/80 text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <span>🏢</span>
              샘플 이미지로 테스트하기
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden group">
              <img
                src={previewUrl}
                alt="건물 미리보기"
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              {!isAnalyzing && !analysisError && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearImage(); }}
                  aria-label="이미지 삭제"
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/70 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {isAnalyzing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm px-6">
                  <p className="text-white font-semibold mb-4 text-sm">
                    {analysisStep ? (STEP_MESSAGES[analysisStep] || 'AI가 건물을 분석중입니다...') : 'AI가 건물을 분석중입니다...'}
                  </p>
                  {/* Progress bar */}
                  <div className="w-full max-w-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white/40 text-xs">분석 중...</span>
                      <span className="text-blue-400 text-xs font-medium">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10">
                      <motion.div
                        className="h-1.5 rounded-full bg-blue-500"
                        initial={{ width: '5%' }}
                        animate={{ width: `${Math.max(progressPercent, 5)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      {STEP_ORDER.map((step, i) => (
                        <div
                          key={step}
                          className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                            i <= currentStepIndex ? 'bg-blue-400' : 'bg-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {analysisError && !isAnalyzing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-16 h-16 rounded-full border-2 border-red-400/30 flex items-center justify-center mb-4">
                    <X className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-red-400 font-medium text-center px-4 text-sm leading-relaxed">{analysisError}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearImage(); }}
                    className="mt-4 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white/80 text-sm hover:bg-white/20 transition-all"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}