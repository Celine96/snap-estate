import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp, Search, Building2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

const INITIAL_COUNT = 4;

export default function RecentAnalyses({ analyses, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!analyses) return [];
    if (!searchQuery.trim()) return analyses;
    const q = searchQuery.trim().toLowerCase();
    return analyses.filter(item =>
      (item.building_name || '').toLowerCase().includes(q) ||
      (item.address || '').toLowerCase().includes(q) ||
      (item.district || '').toLowerCase().includes(q)
    );
  }, [analyses, searchQuery]);

  if (!analyses || analyses.length === 0) return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="flex flex-col items-center gap-3 py-10 text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E] flex items-center justify-center">
        <Building2 className="w-6 h-6 text-[#9AA0A6]" />
      </div>
      <p className="text-[#9AA0A6] text-sm font-medium">아직 분석 기록이 없습니다</p>
      <p className="text-[#9AA0A6]/60 text-xs leading-relaxed max-w-xs">건물 사진을 업로드하면<br />AI가 자동으로 분석합니다</p>
    </motion.div>
  );

  const visibleItems = expanded ? filtered : filtered.slice(0, INITIAL_COUNT);
  const hasMore = filtered.length > INITIAL_COUNT;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="w-full"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#9AA0A6]" />
          <span className="text-[#9AA0A6] text-xs font-medium">최근 분석 기록</span>
          <span className="text-[#9AA0A6]/50 text-xs">({filtered.length})</span>
        </div>
      </div>

      {analyses.length > INITIAL_COUNT && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9AA0A6]/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="건물명 또는 주소 검색"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#1C1C1E] border border-[#2C2C2E] text-white text-xs placeholder-[#9AA0A6]/50 focus:outline-none focus:border-[#4D96FF]/40 transition-colors"
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visibleItems.map((item, i) => (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            onClick={() => onSelect(item)}
            className="group text-left rounded-2xl overflow-hidden bg-[#1C1C1E] border border-[#2C2C2E] hover:border-[#4D96FF]/30 transition-all"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
          >
            {item.image_url && (
              <div className="relative h-28 overflow-hidden">
                <img
                  src={item.image_url}
                  alt={item.building_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              </div>
            )}
            <div className="p-3">
              <p className="text-white text-xs font-medium truncate">
                {item.building_name || '건물 분석'}
              </p>
              {item.address && (
                <p className="text-[#9AA0A6] text-[10px] mt-0.5 truncate">{item.address}</p>
              )}
              <p className="text-[#9AA0A6]/60 text-[10px] mt-0.5">
                {formatDistanceToNow(new Date(item.created_date), { addSuffix: true, locale: ko })}
              </p>
            </div>
          </motion.button>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 py-2.5 rounded-xl border border-[#2C2C2E] bg-[#1C1C1E] text-[#9AA0A6] text-xs font-medium hover:text-white hover:border-[#4D96FF]/30 transition-all flex items-center justify-center gap-1"
        >
          {expanded ? <>접기 <ChevronUp className="w-3.5 h-3.5" /></> : <>더보기 ({filtered.length - INITIAL_COUNT}건) <ChevronDown className="w-3.5 h-3.5" /></>}
        </button>
      )}

      {searchQuery && filtered.length === 0 && (
        <p className="text-[#9AA0A6]/50 text-xs text-center py-4">검색 결과가 없습니다</p>
      )}
    </motion.div>
  );
}