import React from 'react';
import { motion } from 'framer-motion';
import { Target, MapPin, TrendingUp, Zap } from 'lucide-react';

const ScoreBar = ({ label, value, icon: Icon, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="space-y-2"
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-white/60 text-sm">{label}</span>
      </div>
      <span className="text-white font-bold text-sm">{value}점</span>
    </div>
    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ delay: delay + 0.2, duration: 0.8, ease: "easeOut" }}
        className={`h-full rounded-full ${color.replace('text-', 'bg-')}`}
      />
    </div>
  </motion.div>
);

export default function InvestmentScore({ data }) {
  if (!data) return null;

  const getScoreColor = (score) => {
    if (score >= 75) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-white/60 text-sm font-medium flex items-center gap-2">
        <Target className="w-4 h-4" />
        투자 지표
      </h3>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-white/[0.1] to-white/[0.03] border border-white/10"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-white/40 text-xs mb-1">종합 투자점수</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${getScoreColor(data.overall)}`}>
                {data.overall}
              </span>
              <span className="text-white/40 text-lg">/ 100</span>
            </div>
          </div>
          <div className="w-20 h-20 rounded-full border-4 border-white/10 flex items-center justify-center relative">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, duration: 0.5, type: "spring" }}
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(${
                  data.overall >= 75 ? 'rgb(52, 211, 153)' : 
                  data.overall >= 50 ? 'rgb(251, 191, 36)' : 'rgb(239, 68, 68)'
                } ${data.overall * 3.6}deg, transparent 0deg)`
              }}
            />
            <div className="absolute inset-2 rounded-full bg-[#0a0a0f]" />
          </div>
        </div>

        <div className="space-y-4">
          <ScoreBar
            label="입지"
            value={data.location}
            icon={MapPin}
            color={getScoreColor(data.location)}
            delay={0.1}
          />
          <ScoreBar
            label="수익성"
            value={data.profitability}
            icon={TrendingUp}
            color={getScoreColor(data.profitability)}
            delay={0.15}
          />
          <ScoreBar
            label="성장 가능성"
            value={data.growth_potential}
            icon={Zap}
            color={getScoreColor(data.growth_potential)}
            delay={0.2}
          />
        </div>
      </motion.div>
    </div>
  );
}