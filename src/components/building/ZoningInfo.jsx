import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, FileText, AlertTriangle, Building } from 'lucide-react';

export default function ZoningInfo({ data }) {
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-[#9AA0A6]" />
        <span className="text-[#9AA0A6] text-xs font-medium tracking-wide uppercase">용도지역 및 법적 정보</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="p-5 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E] space-y-4"
      >
        {data.land_use_zone && (
          <div className="flex items-start gap-3">
            <Building className="w-3.5 h-3.5 text-[#9AA0A6] mt-0.5 shrink-0" />
            <div>
              <p className="text-[#9AA0A6] text-xs mb-0.5">용도지역</p>
              <p className="text-white text-sm font-medium">{data.land_use_zone}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {data.building_to_land_ratio && (
            <div className="p-3 rounded-xl bg-[#121214] border border-[#2C2C2E]">
              <p className="text-[#9AA0A6] text-xs mb-1">건폐율</p>
              <p className="text-white font-semibold text-sm">{data.building_to_land_ratio}</p>
            </div>
          )}
          {data.floor_area_ratio && (
            <div className="p-3 rounded-xl bg-[#121214] border border-[#2C2C2E]">
              <p className="text-[#9AA0A6] text-xs mb-1">용적률</p>
              <p className="text-white font-semibold text-sm">{data.floor_area_ratio}</p>
            </div>
          )}
        </div>

        {data.development_plan && (
          <div className="pt-3 border-t border-[#2C2C2E]">
            <div className="flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 text-[#9AA0A6] mt-0.5 shrink-0" />
              <div>
                <p className="text-[#9AA0A6] text-xs mb-1">개발계획</p>
                <p className="text-[#E8EAED] text-xs leading-relaxed">{data.development_plan}</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {data.legal_restrictions?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-2xl bg-[#1C1C1E] border border-amber-500/20"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-amber-400 text-xs font-medium">법적 제한사항</span>
          </div>
          <div className="space-y-2">
            {data.legal_restrictions.map((restriction, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[#9AA0A6] text-xs mt-1">·</span>
                <p className="text-[#E8EAED] text-xs leading-relaxed">{restriction}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}