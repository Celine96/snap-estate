import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Wallet, Home } from 'lucide-react';

const MetricCard = ({ icon: Icon, label, value, delay = 0 }) => (
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
    <p className="text-white font-semibold text-lg">{value || '—'}</p>
  </motion.div>
);

export default function RentalAnalysis({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign className="w-3.5 h-3.5 text-[#9AA0A6]" />
        <span className="text-[#9AA0A6] text-xs font-medium tracking-wide uppercase">임대 수익률 분석</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={Wallet} label="월 임대수익" value={data.monthly_income} delay={0.05} />
        <MetricCard icon={TrendingUp} label="연 수익률" value={data.annual_yield} delay={0.1} />
        <MetricCard icon={DollarSign} label="총 보증금" value={data.total_deposit} delay={0.15} />
        <MetricCard icon={Home} label="예상 공실률" value={data.occupancy_rate} delay={0.2} />
      </div>
    </div>
  );
}