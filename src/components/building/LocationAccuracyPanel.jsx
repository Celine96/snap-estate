import React from 'react';
import { X, MapPin, Building2 } from 'lucide-react';
import { ANALYSIS_STEPS } from '../hooks/useAnalysis';

export default function LocationAccuracyPanel({
  isAnalyzing,
  analysisStep,
  analysisError,
  analysisData,
  showManualInput,
  manualAddress,
  setManualAddress,
  setShowManualInput,
  onLocationAccuracy,
  onManualAddressSubmit,
}) {
  return (
    <div className="bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E] p-4 space-y-3">
      <div>
        <h4 className="text-white font-medium text-sm">위치 정확도를 평가해주세요</h4>
        <p className="text-[#9AA0A6]/70 text-xs mt-1">
          AI가 추정한 위치가 맞는지 확인하고, 부정확하면 주소를 직접 입력해 더 정확한 시세를 받아보세요.
        </p>
      </div>

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
            onKeyDown={(e) => e.key === 'Enter' && onManualAddressSubmit()}
            placeholder="예: 서울특별시 강남구 논현동 242-21"
            className="w-full px-3 py-2 rounded-xl bg-[#121214] border border-[#2C2C2E] text-white text-sm placeholder-[#9AA0A6]/50 focus:outline-none focus:border-[#4D96FF]/40 transition-colors"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={onManualAddressSubmit}
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
        <div
          className="grid grid-cols-3 gap-2"
          role="group"
          aria-label="위치 정확도 평가"
        >
          {[
            { key: 'incorrect', icon: X, label: '부정확', activeClass: 'bg-red-500/10 border-red-500/30 text-red-400' },
            { key: 'nearby',    icon: MapPin, label: '근처', activeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
            { key: 'accurate',  icon: Building2, label: '정확', activeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
          ].map(({ key, icon: Icon, label, activeClass }) => (
            <button
              key={key}
              onClick={() => onLocationAccuracy(key)}
              aria-label={`위치가 ${label}합니다`}
              aria-pressed={analysisData?.location_accuracy === key}
              className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                analysisData?.location_accuracy === key
                  ? activeClass
                  : 'border-[#2C2C2E] bg-[#121214] text-[#9AA0A6] hover:border-[#4D96FF]/30 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      )}

      {analysisError && !isAnalyzing && (
        <div aria-live="polite" className="p-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400 text-xs text-center">{analysisError}</p>
        </div>
      )}

      {!showManualInput && !isAnalyzing && !analysisError && analysisData?.location_accuracy && (
        <p aria-live="polite" className="text-emerald-400/80 text-xs text-center">✓ 피드백이 저장되었습니다</p>
      )}
    </div>
  );
}