import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp, Search } from 'lucide-react';
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

  if (!analyses || analyses.length === 0) return null;

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
        <h3 className="text-white/50 text-sm font-medium flex items-center gap-2">
          <Clock className="w-4 h-4" />
          최근 분석 기록
          <span className="text-white/30 text-xs">({filtered.length})</span>
        </h3>
      </div>

      {analyses.length > INITIAL_COUNT && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="건물명 또는 주소 검색"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-white text-xs placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
          />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {visibleItems.map((item, i) => (
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
              {item.address && (
                <p className="text-white/40 text-[10px] mt-0.5 truncate">
                  {item.address}
                </p>
              )}
              <p className="text-white/30 text-[10px] mt-0.5">
                {formatDistanceToNow(new Date(item.created_date), { addSuffix: true, locale: ko })}
              </p>
            </div>
          </motion.button>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 py-2 rounded-lg bg-white/[0.04] border border-white/10 text-white/50 text-xs font-medium hover:text-white/70 hover:border-white/20 transition-all flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>접기 <ChevronUp className="w-3.5 h-3.5" /></>
          ) : (
            <>더보기 ({filtered.length - INITIAL_COUNT}건) <ChevronDown className="w-3.5 h-3.5" /></>
          )}
        </button>
      )}

      {searchQuery && filtered.length === 0 && (
        <p className="text-white/30 text-xs text-center py-4">
          검색 결과가 없습니다
        </p>
      )}
    </motion.div>
  );
}
