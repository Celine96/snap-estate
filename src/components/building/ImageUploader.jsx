import React, { useState, useRef } from 'react';
import { Upload, Camera, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
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

export default function ImageUploader({ onImageSelected, isAnalyzing, analysisStep, analysisError }) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_FILE_SIZE) {
      alert('파일 크기가 너무 큽니다. 20MB 이하의 이미지를 업로드해주세요.');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onImageSelected(file);
  };

  const clearImage = () => {
    setPreviewUrl(null);
  };

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
          >
            <div
              role="button"
              tabIndex={0}
              aria-label="건물 사진 업로드 영역. 클릭하거나 이미지를 드래그하세요."
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 cursor-pointer
                ${dragActive
                  ? 'border-amber-400 bg-amber-400/5'
                  : 'border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/[0.07]'
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
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors duration-300 border
                  ${dragActive ? 'bg-slate-700 border-slate-600' : 'bg-slate-800 border-slate-700'}`}>
                  <Upload className={`w-6 h-6 transition-colors duration-300 ${dragActive ? 'text-slate-200' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className="text-white/90 font-medium text-lg mb-1">
                    건물 사진을 업로드하세요
                  </p>
                  <p className="text-white/40 text-sm">
                    드래그 앤 드롭 또는 클릭하여 이미지 선택
                  </p>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white/50 text-xs">JPG</span>
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white/50 text-xs">PNG</span>
                  <span className="px-3 py-1 rounded-full bg-white/10 text-white/50 text-xs">WEBP</span>
                </div>
              </div>
            </div>
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
                className="w-full h-64 object-cover"
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
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-amber-400/30 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
                    </div>
                    <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-transparent border-t-amber-400 animate-spin" style={{ animationDuration: '1.5s' }} />
                  </div>
                  <p className="text-white/90 font-medium mt-4">
                    {analysisStep ? (STEP_MESSAGES[analysisStep] || 'AI가 건물을 분석중입니다...') : 'AI가 건물을 분석중입니다...'}
                  </p>
                  <p className="text-white/50 text-sm mt-1">잠시만 기다려주세요</p>
                </div>
              )}
              {analysisError && !isAnalyzing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="w-16 h-16 rounded-full border-2 border-red-400/30 flex items-center justify-center mb-4">
                    <X className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-red-400 font-medium text-center px-4">{analysisError}</p>
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