import React from 'react';
import { motion } from 'framer-motion';
import { Building2, Clock, ChevronRight } from 'lucide-react';
import moment from 'moment';

export default function RecentAnalyses({ analyses, onSelect }) {
  if (!analyses || analyses.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="w-full"
    >
      <h3 className="text-white/50 text-sm font-medium mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        최근 분석 기록
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {analyses.slice(0, 8).map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            onClick={() => onSelect(item)}
            className="group text-left rounded-xl overflow-hidden bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all"
          >
            {item.image_url && (
              <div className="relative h-24 overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.building_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              </div>
            )}
            <div className="p-3">
              <p className="text-white/80 text-xs font-medium truncate">
                {item.building_name || '건물 분석'}
              </p>
              <p className="text-white/30 text-[10px] mt-0.5">
                {moment(item.created_date).fromNow()}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}