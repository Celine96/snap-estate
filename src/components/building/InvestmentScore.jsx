import React from 'react';
import { motion } from 'framer-motion';
import { Target, MapPin, TrendingUp, Zap } from 'lucide-react';

const ScoreBar = ({ label, value, icon: Icon, delay = 0 }) => {
  const color = value >= 75 ? '#34D399' : value >= 50 ? '#FBBF24' : '#F87171';
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-[#9AA0A6]" />
          <span className="text-[#9AA0A6] text-xs">{label}</span>
        </div>
        <span className="text-white font-semibold text-sm tabular-nums">{value}<span className="text-[#9AA0A6] font-normal text-xs ml-0.5">점</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-[#2C2C2E] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ delay: delay + 0.15, duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </motion.div>
  );
};

export default function InvestmentScore({ data }) {
  if (!data) return null;

  const overall = data.overall ?? 0;
  const scoreColor = overall >= 75 ? '#34D399' : overall >= 50 ? '#FBBF24' : '#F87171';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-3.5 h-3.5 text-[#9AA0A6]" />
        <span className="text-[#9AA0A6] text-xs font-medium tracking-wide uppercase">투자 지표</span>
      </div>

      <div className="p-5 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[#9AA0A6] text-xs mb-1">종합 투자점수</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-bold text-white tabular-nums" style={{ color: scoreColor }}>
                {data.overall ?? '—'}
              </span>
              <span className="text-[#9AA0A6] text-sm">/ 100</span>
            </div>
            <p className="text-[#9AA0A6]/60 text-[10px] mt-1">75+ 우수 · 50–74 보통 · 50 미만 주의</p>
          </div>
          <div className="w-16 h-16 rounded-full flex items-center justify-center relative">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#2C2C2E" strokeWidth="4" />
              <motion.circle
                cx="32" cy="32" r="26"
                fill="none"
                stroke={scoreColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 26}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 26 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 26 * (1 - overall / 100) }}
                transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
              />
            </svg>
          </div>
        </div>

        <div className="space-y-4">
          <ScoreBar label="입지" value={data.location} icon={MapPin} delay={0.1} />
          <ScoreBar label="수익성" value={data.profitability} icon={TrendingUp} delay={0.15} />
          <ScoreBar label="성장 가능성" value={data.growth_potential} icon={Zap} delay={0.2} />
        </div>
      </div>
    </div>
  );
}