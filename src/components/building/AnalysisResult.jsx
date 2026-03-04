import React from 'react';
import { motion } from 'framer-motion';
import {
  Building2, MapPin, Calendar, Layers, Ruler,
  TrendingUp, Home, Banknote, Copy, Star, TreePine, Shield,
  Database, Globe, Bot, CheckCircle
} from 'lucide-react';
import EditableField from './EditableField';
import { convertManwon } from '@/utils/format';
import { toast } from 'sonner';

// 섹션 타이틀
const SectionTitle = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon className="w-3.5 h-3.5 text-[#9AA0A6]" />
    <span className="text-[#9AA0A6] text-xs font-medium tracking-wide uppercase">{children}</span>
  </div>
);

// 건물 스펙 카드
const InfoCard = ({ icon: Icon, label, value, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.25 }}
    className="p-4 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E]"
  >
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-3.5 h-3.5 text-[#9AA0A6]" />
      <span className="text-[#9AA0A6] text-xs">{label}</span>
    </div>
    <p className="text-white font-semibold text-sm">{value || '—'}</p>
  </motion.div>
);

// 가격 카드
const PriceCard = ({ label, value, icon: Icon, delay = 0, onEdit, dateInfo, highlight = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.25 }}
    className={`p-5 rounded-2xl border ${
      highlight
        ? 'bg-[#1C1C1E] border-[#4D96FF]/30'
        : 'bg-[#1C1C1E] border-[#2C2C2E]'
    }`}
  >
    <div className="flex items-center gap-1.5 mb-3">
      <Icon className="w-3.5 h-3.5 text-[#9AA0A6]" />
      <span className="text-[#9AA0A6] text-xs">{label}</span>
    </div>
    {onEdit ? (
      <EditableField
        value={value}
        onSave={onEdit}
        className={`font-semibold leading-tight ${highlight ? 'text-[#4D96FF] text-2xl' : 'text-white text-xl'}`}
      />
    ) : (
      <p className={`font-semibold leading-tight whitespace-pre-line ${highlight ? 'text-[#4D96FF] text-2xl' : 'text-white text-xl'}`}>
        {value || '—'}
      </p>
    )}
    {dateInfo && (
      <p className="text-[#9AA0A6] text-[10px] mt-1.5">{dateInfo}</p>
    )}
  </motion.div>
);

export default function AnalysisResult({ data, onUpdate }) {
  if (!data) return null;

  const handleFieldUpdate = async (field, value) => {
    if (onUpdate) await onUpdate({ ...data, [field]: value });
  };

  const handleCopy = () => {
    const text = [
      `건물명: ${data.building_name || ''}`,
      `주소: ${data.address || ''}`,
      data.estimated_price_sale ? `매매가: ${data.estimated_price_sale}` : '',
      data.estimated_price_rent ? `전세가: ${data.estimated_price_rent}` : '',
      data.estimated_price_monthly ? `월세: ${data.estimated_price_monthly}` : '',
      `건물유형: ${data.building_type || ''}`,
      `건축연도: ${data.estimated_year || ''}`,
      `층수: ${data.estimated_floors ? data.estimated_floors + '층' : ''}`,
      `면적: ${data.estimated_area_pyeong ? data.estimated_area_pyeong + '평' : ''}`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => toast.success('클립보드에 복사되었습니다'));
  };

  const realPriceSale = data.real_price_data?.거래금액
    ? convertManwon(data.real_price_data.거래금액)
    : null;

  const confidenceMap = {
    '높음': { dot: 'bg-emerald-400', text: 'text-emerald-400', label: '높음' },
    '보통': { dot: 'bg-amber-400', text: 'text-amber-400', label: '보통' },
    '낮음': { dot: 'bg-red-400', text: 'text-red-400', label: '낮음' },
  };
  const conf = confidenceMap[data.confidence];

  const matchConfidence = data.real_price_data?.매칭신뢰도;
  const matchConfidenceConfig = {
    high: { label: '매칭 정확', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    medium: { label: '매칭 유사', color: 'text-amber-400', dot: 'bg-amber-400' },
    low: { label: '매칭 참고', color: 'text-red-400', dot: 'bg-red-400' },
  };

  const priceSourceConfig = {
    '최근 실거래가': { icon: Database, label: '실거래 DB' },
    '국토교통부 실거래가': { icon: Globe, label: '국토교통부' },
    'AI 추정가': { icon: Bot, label: 'AI 추정' },
  };
  const priceSource = priceSourceConfig[data.price_type] || null;
  const matchFactors = data.real_price_data?.매칭요인;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-[20px] font-bold text-white leading-tight mb-1.5">
            {data.building_name || '건물 분석 결과'}
          </h2>
          {data.address && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#9AA0A6] shrink-0" />
              <span className="text-[#9AA0A6] text-sm leading-relaxed">{data.address}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {conf && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1C1C1E] border border-[#2C2C2E]">
              <div className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
              <span className={`text-xs ${conf.text}`}>신뢰도 {conf.label}</span>
            </div>
          )}
          <button
            onClick={handleCopy}
            title="클립보드 복사"
            className="w-8 h-8 rounded-lg bg-[#1C1C1E] border border-[#2C2C2E] flex items-center justify-center text-[#9AA0A6] hover:text-white transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 시세 섹션 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle icon={Banknote}>시세 정보</SectionTitle>
          <div className="flex items-center gap-2">
            {matchConfidence && matchConfidenceConfig[matchConfidence] && (
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${matchConfidenceConfig[matchConfidence].dot}`} />
                <span className={`text-[10px] ${matchConfidenceConfig[matchConfidence].color}`}>
                  {matchConfidenceConfig[matchConfidence].label}
                </span>
              </div>
            )}
            {priceSource && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1C1C1E] border border-[#2C2C2E]">
                <priceSource.icon className="w-3 h-3 text-[#9AA0A6]" />
                <span className="text-[#9AA0A6] text-[10px]">{priceSource.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* 데이터 출처 배너 */}
        {data.real_price_data?.거래일 ? (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#1C1C1E] border border-[#2C2C2E] mb-4">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-emerald-400 text-xs font-medium">
                {data.real_price_data.거래일.split('-')[0]}년 {data.real_price_data.거래일.split('-')[1]}월 실거래 신고 데이터
              </span>
              {matchFactors?.length > 0 && (
                <p className="text-[#9AA0A6] text-[10px] mt-0.5 truncate">{matchFactors.join(' · ')}</p>
              )}
            </div>
            <span className="text-[#9AA0A6] text-[10px] shrink-0">{data.real_price_data.거래일}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#1C1C1E] border border-[#2C2C2E] mb-4">
            <Bot className="w-4 h-4 text-[#4D96FF] shrink-0" />
            <div>
              <span className="text-[#4D96FF] text-xs font-medium">AI 추정가</span>
              <p className="text-[#9AA0A6] text-[10px] mt-0.5">주변 실거래 데이터 기반 추정 · 실제 시세와 차이가 있을 수 있습니다</p>
            </div>
          </div>
        )}

        <div className={`grid gap-3 ${data.building_type === '상가' || data.building_type === '오피스' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
          <PriceCard
            label="매매가"
            value={realPriceSale || data.estimated_price_sale}
            icon={Home}
            delay={0.05}
            highlight={true}
            onEdit={!realPriceSale ? (v) => handleFieldUpdate('estimated_price_sale', v) : undefined}
            dateInfo={data.real_price_data?.거래일 ? `${data.real_price_data.거래일} 기준` : null}
          />
          {data.building_type !== '상가' && data.building_type !== '오피스' && (
            <PriceCard
              label="전세가"
              value={data.estimated_price_rent}
              icon={TrendingUp}
              delay={0.1}
              onEdit={(v) => handleFieldUpdate('estimated_price_rent', v)}
            />
          )}
          <PriceCard
            label={data.building_type === '상가' || data.building_type === '오피스' ? '임차 보증금/월세' : '월세'}
            value={data.estimated_price_monthly}
            icon={Banknote}
            delay={0.15}
            onEdit={(v) => handleFieldUpdate('estimated_price_monthly', v)}
          />
        </div>
      </div>

      {/* 시세 동향 */}
      {data.price_trend && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E]"
        >
          <SectionTitle icon={TrendingUp}>시세 동향</SectionTitle>
          <p className="text-[#E8EAED] text-sm leading-relaxed" style={{ lineHeight: '1.75' }}>{data.price_trend}</p>
        </motion.div>
      )}

      {/* 건물 스펙 */}
      <div>
        <SectionTitle icon={Building2}>건물 스펙</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <InfoCard icon={Building2} label="건물 유형" value={data.building_type} delay={0.05} />
          <InfoCard icon={Calendar} label="건축연도" value={data.estimated_year} delay={0.1} />
          <InfoCard icon={Layers} label="층수" value={data.estimated_floors ? `${data.estimated_floors}층` : null} delay={0.15} />
          <InfoCard icon={Ruler} label="면적" value={data.estimated_area_pyeong ? `${data.estimated_area_pyeong}평` : null} delay={0.2} />
        </div>
      </div>

      {/* 건물 특징 */}
      {data.building_features?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <SectionTitle icon={Star}>건물 특징</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {data.building_features.map((feature, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-[#1C1C1E] border border-[#2C2C2E] text-[#E8EAED] text-xs">
                {feature}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* 주변 시설 */}
      {data.nearby_facilities?.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <SectionTitle icon={TreePine}>주변 시설</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {data.nearby_facilities.map((facility, i) => (
              <span key={i} className="px-3 py-1.5 rounded-lg bg-[#1C1C1E] border border-[#2C2C2E] text-[#9AA0A6] text-xs">
                {facility}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* AI 분석 요약 */}
      {data.analysis_summary && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="p-5 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E]"
        >
          <SectionTitle icon={Shield}>AI 분석 요약</SectionTitle>
          <p className="text-[#E8EAED] text-sm leading-relaxed" style={{ lineHeight: '1.75' }}>{data.analysis_summary}</p>
        </motion.div>
      )}

      {/* 면책 */}
      <p className="text-[#9AA0A6]/60 text-[10px] text-center pt-1 leading-relaxed">
        ※ AI 기반 추정 정보이며, 실제 시세와 다를 수 있습니다. 정확한 정보는 공인중개사에 문의하세요.
      </p>
    </motion.div>
  );
}