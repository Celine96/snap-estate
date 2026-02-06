import React, { useState, useRef } from 'react';
import { Upload, Camera, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from 'framer-motion';

export default function ImageUploader({ onImageSelected, isAnalyzing }) {
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

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) return;
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
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
              />
              <div className="flex flex-col items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300
                  ${dragActive ? 'bg-amber-400/20' : 'bg-white/10'}`}>
                  <Upload className={`w-7 h-7 transition-colors duration-300 ${dragActive ? 'text-amber-400' : 'text-white/60'}`} />
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
              {!isAnalyzing && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearImage(); }}
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
                  <p className="text-white/90 font-medium mt-4">AI가 건물을 분석중입니다...</p>
                  <p className="text-white/50 text-sm mt-1">잠시만 기다려주세요</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}