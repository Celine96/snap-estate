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
const SAMPLE_IMAGE_URL = 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80';

export default function ImageUploader({ onImageSelected, isAnalyzing, analysisStep, analysisError, onCancel }) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [currentFile, setCurrentFile] = useState(null);
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
      toast.error('이미지 파일만 업로드할 수 있습니다');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('20MB 이하의 이미지를 업로드해주세요');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCurrentFile(file);
    onImageSelected(file);
  };

  const handleSampleImage = async () => {
    const res = await fetch(SAMPLE_IMAGE_URL);
    const blob = await res.blob();
    const file = new File([blob], 'sample-building.jpg', { type: 'image/jpeg' });
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setCurrentFile(file);
    onImageSelected(file);
  };

  const clearImage = () => { setPreviewUrl(null); setCurrentFile(null); };
  const retryAnalysis = () => { if (currentFile) onImageSelected(currentFile); };

  const currentStepIndex = STEP_ORDER.indexOf(analysisStep);
  const progressPercent = analysisStep ? Math.round(((currentStepIndex + 1) / STEP_ORDER.length) * 100) : 0;

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!previewUrl ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="건물 사진 업로드 영역"
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer
                ${dragActive
                  ? 'border-[#4D96FF]/60 bg-[#4D96FF]/5'
                  : 'border-[#2C2C2E] hover:border-[#4D96FF]/40 bg-[#1C1C1E] hover:bg-[#1C1C1E]'
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
                className="hidden"
                onChange={(e) => { if (e.target.files[0]) { handleFile(e.target.files[0]); e.target.value = ''; } }}
              />
              <div className="flex flex-col items-center gap-5">
                <motion.div
                  animate={dragActive ? { scale: 1.08, y: -3 } : { scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-colors duration-300
                    ${dragActive ? 'bg-[#4D96FF]/10 border-[#4D96FF]/30' : 'bg-[#121214] border-[#2C2C2E]'}`}
                >
                  <CloudUpload className={`w-7 h-7 transition-colors duration-300 ${dragActive ? 'text-[#4D96FF]' : 'text-[#9AA0A6]'}`} />
                </motion.div>
                <div>
                  <p className="text-white font-semibold text-base mb-1">건물 사진을 업로드하세요</p>
                  <p className="text-[#9AA0A6] text-sm">드래그 앤 드롭 또는 클릭하여 선택</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="px-6 py-2.5 rounded-xl bg-[#4D96FF] hover:bg-[#4D96FF]/90 text-white font-semibold text-sm transition-all"
                >
                  이미지 업로드
                </button>
                <div className="flex gap-2">
                  {['JPG', 'PNG', 'WEBP'].map(fmt => (
                    <span key={fmt} className="px-2.5 py-1 rounded-lg bg-[#121214] border border-[#2C2C2E] text-[#9AA0A6] text-xs">{fmt}</span>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSampleImage}
              className="w-full py-3 rounded-2xl border border-[#2C2C2E] bg-[#1C1C1E] hover:bg-[#2C2C2E] text-[#9AA0A6] hover:text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              <span>🏢</span>
              샘플 이미지로 테스트하기
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden">
              <img src={previewUrl} alt="건물 미리보기" className="w-full aspect-[4/3] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              {!isAnalyzing && !analysisError && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearImage(); }}
                  aria-label="이미지 삭제"
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {isAnalyzing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm px-6">
                  <p className="text-white font-medium mb-5 text-sm">
                    {STEP_MESSAGES[analysisStep] || 'AI가 건물을 분석중입니다...'}
                  </p>
                  <div className="w-full max-w-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#9AA0A6] text-xs">분석 중...</span>
                      <span className="text-[#4D96FF] text-xs font-medium tabular-nums">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-white/10">
                      <motion.div
                        className="h-1 rounded-full bg-[#4D96FF]"
                        initial={{ width: '5%' }}
                        animate={{ width: `${Math.max(progressPercent, 5)}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex justify-between mt-2.5">
                      {STEP_ORDER.map((step, i) => (
                        <div
                          key={step}
                          className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
                          style={{ backgroundColor: i <= currentStepIndex ? '#4D96FF' : 'rgba(255,255,255,0.15)' }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {analysisError && !isAnalyzing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-14 h-14 rounded-full border border-[#2C2C2E] flex items-center justify-center mb-4">
                    <X className="w-7 h-7 text-red-400" />
                  </div>
                  <p className="text-red-400 font-medium text-center px-4 text-sm leading-relaxed">{analysisError}</p>
                  <div className="flex gap-2 mt-5">
                    <button
                      onClick={(e) => { e.stopPropagation(); retryAnalysis(); }}
                      className="px-4 py-2 rounded-xl bg-[#4D96FF] text-white text-sm font-semibold hover:bg-[#4D96FF]/90 transition-all"
                    >
                      재시도
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); clearImage(); }}
                      className="px-4 py-2 rounded-xl border border-[#2C2C2E] bg-[#1C1C1E] text-[#9AA0A6] text-sm hover:text-white transition-all"
                    >
                      다른 이미지
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}