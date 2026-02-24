import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2, MapPin, TrendingUp, Home, Calendar, Layers, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';

export default function Share() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) { setError('잘못된 링크입니다.'); setLoading(false); return; }

    base44.functions.invoke('getSharedAnalysis', { id })
      .then(res => {
        if (res.data?.data) setData(res.data.data);
        else setError('분석 정보를 찾을 수 없습니다.');
      })
      .catch(() => setError('데이터를 불러오는 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const infoItems = data ? [
    data.building_type && { label: '건물 유형', value: data.building_type, icon: Building2 },
    data.estimated_year && { label: '건축연도', value: `${data.estimated_year}년`, icon: Calendar },
    data.estimated_floors && { label: '층수', value: `${data.estimated_floors}층`, icon: Layers },
    data.estimated_area_pyeong && { label: '면적', value: `${data.estimated_area_pyeong}평`, icon: Home },
  ].filter(Boolean) : [];

  const priceItems = data ? [
    data.estimated_price_sale && { label: '매매가', value: data.estimated_price_sale, color: 'text-amber-400' },
    data.estimated_price_rent && { label: '전세가', value: data.estimated_price_rent, color: 'text-blue-400' },
    data.estimated_price_monthly && { label: '월세', value: data.estimated_price_monthly, color: 'text-emerald-400' },
  ].filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-[#0a0a0f] relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }}
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-xl mx-auto px-4 py-10">
        {/* 헤더 */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-slate-300" />
          </div>
          <span className="text-white/60 text-sm font-medium">SnapEstate</span>
        </motion.div>

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-white/40 text-sm">불러오는 중...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-24">
            <p className="text-white/60">{error}</p>
          </div>
        )}

        {data && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* 이미지 + 건물명 */}
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04]">
              {data.image_url && (
                <img src={data.image_url} alt={data.building_name} className="w-full h-56 object-cover" />
              )}
              <div className="p-5 space-y-2">
                <h1 className="text-white text-xl font-bold">{data.building_name || '건물 분석 결과'}</h1>
                {data.address && (
                  <div className="flex items-start gap-2 text-white/50">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="text-sm">{data.address}</span>
                  </div>
                )}
                {data.confidence && (
                  <Badge className={`border text-xs mt-1
                    ${data.confidence === '높음' ? 'bg-green-500/20 text-green-400 border-green-500/20' : ''}
                    ${data.confidence === '보통' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : ''}
                    ${data.confidence === '낮음' ? 'bg-red-500/20 text-red-400 border-red-500/20' : ''}
                  `}>
                    신뢰도: {data.confidence}
                  </Badge>
                )}
              </div>
            </div>

            {/* 가격 정보 */}
            {priceItems.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span className="text-white font-semibold text-sm">시세 정보</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {priceItems.map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="text-white/50 text-sm">{label}</span>
                      <span className={`font-bold text-base ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 건물 정보 */}
            {infoItems.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-white font-semibold text-sm mb-4">건물 정보</h3>
                <div className="grid grid-cols-2 gap-3">
                  {infoItems.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-white/30" />
                      <div>
                        <p className="text-white/40 text-xs">{label}</p>
                        <p className="text-white text-sm font-medium">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI 분석 요약 */}
            {data.analysis_summary && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <h3 className="text-white font-semibold text-sm mb-2">AI 분석 요약</h3>
                <p className="text-white/60 text-sm leading-relaxed">{data.analysis_summary}</p>
              </div>
            )}

            {/* CTA */}
            <a
              href={createPageUrl('Home')}
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-white text-slate-900 font-bold text-sm hover:bg-white/90 transition-all"
            >
              <Building2 className="w-4 h-4" />
              내 건물도 AI로 분석하기
              <ExternalLink className="w-4 h-4" />
            </a>

            <p className="text-center text-white/20 text-xs pb-4">SnapEstate · AI 건물 분석 서비스</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}