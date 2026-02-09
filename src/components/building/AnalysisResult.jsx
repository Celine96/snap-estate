import React from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, MapPin, Calendar, Layers, Ruler, 
  TrendingUp, Home, Banknote, ArrowUpRight,
  Star, TreePine, Shield
} from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import EditableField from './EditableField';

const InfoCard = ({ icon: Icon, label, value, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-colors"
  >
    <div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center shrink-0">
      <Icon className="w-3.5 h-3.5 text-slate-400" />
    </div>
    <div className="min-w-0">
      <p className="text-white/40 text-xs mb-0.5">{label}</p>
      <p className="text-white font-medium text-sm leading-snug">{value || '정보 없음'}</p>
    </div>
  </motion.div>
);

const PriceCard = ({ label, value, icon: Icon, color, delay = 0, onEdit, dateInfo }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="p-4 rounded-xl bg-white/[0.03] border border-white/10"
  >
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-5 h-5 rounded flex items-center justify-center ${color}`}>
        <Icon className="w-3 h-3" />
      </div>
      <span className="text-white/70 text-sm font-medium">{label}</span>
    </div>
    {onEdit ? (
      <EditableField 
        value={value} 
        onSave={onEdit}
        className="text-white font-semibold text-sm leading-relaxed"
      />
    ) : (
      <p className="text-white font-semibold text-sm leading-relaxed whitespace-pre-line">{value || '정보 없음'}</p>
    )}
    {dateInfo && (
      <p className="text-white/40 text-xs mt-1">{dateInfo}</p>
    )}
  </motion.div>
);

export default function AnalysisResult({ data, onUpdate }) {
  if (!data) return null;

  const handleFieldUpdate = async (field, value) => {
    if (onUpdate) {
      await onUpdate({ ...data, [field]: value });
    }
  };

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
      <div className="flex items-start justify-between">
        <div>
          <motion.h2
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-lg font-bold text-white mb-1"
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
              <MapPin className="w-3.5 h-3.5" />
              <span className="text-sm">{data.address}</span>
            </motion.div>
          )}
        </div>
        {data.confidence && (
          <Badge className={`${confidenceColors[data.confidence]} border text-xs`}>
            신뢰도: {data.confidence}
          </Badge>
        )}
      </div>

      {/* Price Section */}
      <div>
        <div className="flex flex-col gap-2 mb-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white/60 text-sm font-medium flex items-center gap-2">
              <Banknote className="w-4 h-4" />
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
              <Calendar className="w-4 h-4 text-emerald-400" />
              <div className="flex flex-col gap-0.5">
                <span className="text-emerald-400 text-xs font-semibold">
                  {data.real_price_data.거래일.split('-')[0]}년 실거래가 기준
                </span>
                <span className="text-white/50 text-[10px]">
                  거래일: {data.real_price_data.거래일} (국토교통부)
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PriceCard
            label="매매가"
            value={data.estimated_price_sale}
            icon={Home}
            color="bg-slate-700/50 text-slate-300"
            delay={0.1}
            onEdit={(v) => handleFieldUpdate('estimated_price_sale', v)}
            dateInfo={data.real_price_data?.거래일 ? `${data.real_price_data.거래일} 기준` : data.price_type === 'AI 추정가' ? '2026년 2월 추정' : null}
          />
          <PriceCard
            label="전세가"
            value={data.estimated_price_rent}
            icon={TrendingUp}
            color="bg-slate-700/50 text-slate-300"
            delay={0.15}
            onEdit={(v) => handleFieldUpdate('estimated_price_rent', v)}
            dateInfo={data.real_price_data?.거래일 ? `${data.real_price_data.거래일} 기준` : data.price_type === 'AI 추정가' ? '2026년 2월 추정' : null}
          />
          <PriceCard
            label="월세"
            value={data.estimated_price_monthly}
            icon={Banknote}
            color="bg-slate-700/50 text-slate-300"
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
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span className="text-white/70 text-sm font-medium">시세 동향</span>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">{data.price_trend}</p>
        </motion.div>
      )}

      {/* Building Specs */}
      <div>
        <h3 className="text-white/60 text-sm font-medium mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          건물 스펙
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <InfoCard icon={Building2} label="건물 유형" value={data.building_type} delay={0.1} />
          <InfoCard icon={Calendar} label="추정 건축연도" value={data.estimated_year} delay={0.15} />
          <InfoCard icon={Layers} label="추정 층수" value={data.estimated_floors ? `${data.estimated_floors}층` : null} delay={0.2} />
          <InfoCard icon={Ruler} label="추정 면적" value={data.estimated_area_pyeong ? `${data.estimated_area_pyeong}평` : null} delay={0.25} />
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
            <Star className="w-4 h-4" />
            건물 특징
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.building_features.map((feature, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/70 text-xs"
              >
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
            <TreePine className="w-4 h-4" />
            주변 시설
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.nearby_facilities.map((facility, i) => (
              <span
                key={i}
                className="px-3 py-1.5 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-300/80 text-xs"
              >
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
            <Shield className="w-4 h-4" />
            AI 분석 요약
          </h3>
          <p className="text-white/70 text-sm leading-relaxed">{data.analysis_summary}</p>
        </motion.div>
      )}

      {/* Disclaimer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-white/30 text-xs text-center pt-2"
      >
        ※ AI 기반 추정 정보이며, 실제 시세와 다를 수 있습니다. 정확한 정보는 공인중개사에 문의하세요.
      </motion.p>
    </motion.div>
  );
}