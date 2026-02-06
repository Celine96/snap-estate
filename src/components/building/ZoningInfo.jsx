import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, FileText, AlertTriangle, Building } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function ZoningInfo({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-white/60 text-sm font-medium flex items-center gap-2">
        <MapPin className="w-4 h-4" />
        용도지역 및 법적 정보
      </h3>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="p-4 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 space-y-3"
      >
        {data.land_use_zone && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
              <Building className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-white/40 text-xs mb-0.5">용도지역</p>
              <p className="text-white text-sm font-medium">{data.land_use_zone}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          {data.building_to_land_ratio && (
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <p className="text-white/40 text-xs mb-1">건폐율</p>
              <p className="text-white font-semibold">{data.building_to_land_ratio}</p>
            </div>
          )}
          {data.floor_area_ratio && (
            <div className="p-3 rounded-lg bg-white/[0.04]">
              <p className="text-white/40 text-xs mb-1">용적률</p>
              <p className="text-white font-semibold">{data.floor_area_ratio}</p>
            </div>
          )}
        </div>

        {data.development_plan && (
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white/40 text-xs mb-1">개발계획</p>
                <p className="text-white/70 text-xs leading-relaxed">{data.development_plan}</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {data.legal_restrictions?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-gradient-to-r from-amber-400/5 to-transparent border border-amber-400/20"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-sm font-medium">법적 제한사항</span>
          </div>
          <div className="space-y-2">
            {data.legal_restrictions.map((restriction, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-amber-400/60 text-xs mt-1">•</span>
                <p className="text-white/70 text-xs leading-relaxed">{restriction}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}