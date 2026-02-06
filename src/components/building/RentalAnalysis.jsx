import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Wallet, Home } from 'lucide-react';

const MetricCard = ({ icon: Icon, label, value, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.06] border border-white/10"
  >
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-white/40 text-xs mb-0.5">{label}</p>
      <p className="text-white font-bold text-lg">{value || '정보 없음'}</p>
    </div>
  </motion.div>
);

export default function RentalAnalysis({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-white/60 text-sm font-medium flex items-center gap-2">
        <DollarSign className="w-4 h-4" />
        임대 수익률 분석
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard
          icon={Wallet}
          label="월 임대수익"
          value={data.monthly_income}
          color="bg-emerald-500/20 text-emerald-400"
          delay={0.05}
        />
        <MetricCard
          icon={TrendingUp}
          label="연 수익률"
          value={data.annual_yield}
          color="bg-amber-500/20 text-amber-400"
          delay={0.1}
        />
        <MetricCard
          icon={DollarSign}
          label="총 보증금"
          value={data.total_deposit}
          color="bg-blue-500/20 text-blue-400"
          delay={0.15}
        />
        <MetricCard
          icon={Home}
          label="예상 공실률"
          value={data.occupancy_rate}
          color="bg-purple-500/20 text-purple-400"
          delay={0.2}
        />
      </div>
    </div>
  );
}