import React from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, MapPin, Calendar, Layers, Ruler, 
  TrendingUp, Home, Banknote, Copy, Star, TreePine, Shield
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import EditableField from './EditableField';
import { convertManwon } from '@/utils/format';
import { toast } from 'sonner';

const InfoCard = ({ icon: Icon, label, value, delay = 0, large = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors"
  >
    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
      <Icon className="w-3.5 h-3.5 text-blue-400" />
    </div>
    <div className="min-w-0">
      <p className="text-white/40 text-xs mb-0.5 leading-relaxed">{label}</p>
      <p className={`text-white font-bold leading-snug ${large ? 'text-base' : 'text-sm'}`}>{value || '정보 없음'}</p>
    </div>
  </motion.div>
);

const PriceCard = ({ label, value, icon: Icon, delay = 0, onEdit, dateInfo, highlight = false }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className={`p-4 rounded-xl border ${highlight ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/[0.03] border-white/10'}`}
  >
    <div className="flex items-center gap-2 mb-2">
      <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-500/20">
        <Icon className="w-3 h-3 text-blue-400" />
      </div>
      <span className="text-white/60 text-xs font-medium">{label}</span>
    </div>
    {onEdit ? (
      <EditableField 
        value={value} 
        onSave={onEdit}
        className={`font-bold leading-relaxed ${highlight ? 'text-blue-300 text-xl' : 'text-white text-lg'}`}
      />
    ) : (
      <p className={`font-bold leading-relaxed whitespace-pre-line ${highlight ? 'text-blue-300 text-xl' : 'text-white text-lg'}`}>
        {value || '정보 없음'}
      </p>
    )}
    {dateInfo && (
      <p className="text-white/30 text-xs mt-1 leading-relaxed">{dateInfo}</p>
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

  const confidenceColors = {
    '높음': 'bg-green-500/20 text-green-400 border-green-500/20',
    '보통': 'bg-amber-500/20 text-amber-400 border-amber-500/20',
    '낮음': 'bg-red-500/20 text-red-400 border-red-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <motion.h2
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-xl font-bold text-white mb-1 leading-tight"
          >
            {data.building_name || '건물 분석 결과'}
          </motion.h2>
          {data.address && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-1.5 text-white/50"
            >
              <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-sm font-medium text-white/70 leading-relaxed">{data.address}</span>
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {data.confidence && (
            <Badge className={`${confidenceColors[data.confidence]} border text-xs`}>
              신뢰도: {data.confidence}
            </Badge>
          )}
          <button
            onClick={handleCopy}
            title="클립보드 복사"
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Price Section */}
      <div>
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white/60 text-sm font-medium flex items-center gap-2">
              <Banknote className="w-4 h-4 text-blue-400" />
              시세 정보
            </h3>
            {data.price_type && (
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/20 border text-xs">
                {data.price_type}
              </Badge>
            )}
          </div>
          {data.real_price_data?.거래일 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="text-emerald-400 text-xs font-semibold leading-relaxed">
                  {data.real_price_data.거래일.split('-')[0]}년 {data.real_price_data.거래일.split('-')[1]}월 실거래가 기준
                </span>
                <span className="text-white/50 text-[10px] leading-relaxed">
                  거래일: {data.real_price_data.거래일} · {data.real_price_data.건축물주용도 || ''} · {data.real_price_data.용도지역 || ''} (국토교통부)
                </span>
              </div>
            </div>
          )}
        </div>
        <div className={`grid gap-3 ${data.building_type === '상가' || data.building_type === '오피스' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
          <PriceCard
            label="매매가"
            value={realPriceSale || data.estimated_price_sale}
            icon={Home}
            delay={0.1}
            highlight={true}
            onEdit={!realPriceSale ? (v) => handleFieldUpdate('estimated_price_sale', v) : undefined}
            dateInfo={data.real_price_data?.거래일 ? `${data.real_price_data.거래일} 기준` : data.price_type === 'AI 추정가' ? '2026년 2월 추정' : null}
          />
          {data.building_type !== '상가' && data.building_type !== '오피스' && (
            <PriceCard
              label="전세가"
              value={data.estimated_price_rent}
              icon={TrendingUp}
              delay={0.15}
              onEdit={(v) => handleFieldUpdate('estimated_price_rent', v)}
              dateInfo={data.real_price_data?.거래일 ? `${data.real_price_data.거래일} 기준` : data.price_type === 'AI 추정가' ? '2026년 2월 추정' : null}
            />
          )}
          <PriceCard
            label={data.building_type === '상가' || data.building_type === '오피스' ? '임차 보증금/월세' : '월세'}
            value={data.estimated_price_monthly}
            icon={Banknote}
            delay={0.2}
            onEdit={(v) => handleFieldUpdate('estimated_price_monthly', v)}
            dateInfo={data.real_price_data?.거래일 ? `${data.real_price_data.거래일} 기준` : data.price_type === 'AI 추정가' ? '2026년 2월 추정' : null}
          />
        </div>
      </div>

      {/* Price Trend */}
      {data.price_trend && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-white/70 text-sm font-medium">시세 동향</span>
          </div>
          <p className="text-white/70 text-sm leading-relaxed" style={{ lineHeight: '1.7' }}>{data.price_trend}</p>
        </motion.div>
      )}

      {/* Building Specs */}
      <div>
        <h3 className="text-white/60 text-sm font-medium mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          건물 스펙
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <InfoCard icon={Building2} label="건물 유형" value={data.building_type} delay={0.1} />
          <InfoCard icon={Calendar} label="추정 건축연도" value={data.estimated_year} delay={0.15} />
          <InfoCard icon={Layers} label="추정 층수" value={data.estimated_floors ? `${data.estimated_floors}층` : null} delay={0.2} large />
          <InfoCard icon={Ruler} label="추정 면적" value={data.estimated_area_pyeong ? `${data.estimated_area_pyeong}평` : null} delay={0.25} large />
        </div>
      </div>

      {/* Features */}
      {data.building_features?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-white/60 text-sm font-medium mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-blue-400" />
            건물 특징
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.building_features.map((feature, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300/80 text-xs leading-relaxed">
                {feature}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Nearby Facilities */}
      {data.nearby_facilities?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <h3 className="text-white/60 text-sm font-medium mb-3 flex items-center gap-2">
            <TreePine className="w-4 h-4 text-blue-400" />
            주변 시설
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.nearby_facilities.map((facility, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-300/80 text-xs leading-relaxed">
                {facility}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Analysis Summary */}
      {data.analysis_summary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-5 rounded-xl bg-white/[0.04] border border-white/10"
        >
          <h3 className="text-white/60 text-sm font-medium mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-400" />
            AI 분석 요약
          </h3>
          <p className="text-white/70 text-sm leading-relaxed" style={{ lineHeight: '1.7' }}>{data.analysis_summary}</p>
        </motion.div>
      )}

      {/* Disclaimer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-white/30 text-xs text-center pt-2 leading-relaxed"
      >
        ※ AI 기반 추정 정보이며, 실제 시세와 다를 수 있습니다. 정확한 정보는 공인중개사에 문의하세요.
      </motion.p>
    </motion.div>
  );
}