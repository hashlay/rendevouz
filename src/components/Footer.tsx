import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface FooterProps {
  eventSettings?: any;
}

export default function Footer({ eventSettings }: FooterProps) {
  const sector = (eventSettings?.campusName || eventSettings?.sectorName || 'Sahityotsav').toUpperCase();
  const festival = eventSettings?.festivalName || 'Sahityotsav';

  return (
    <footer className="w-full py-4 mt-auto border-t border-slate-100 bg-white text-center text-xs text-slate-500 font-sans select-none no-print">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">

        {/* Left Side: Copyright and System Name */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left gap-1">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-1.5 gap-y-0.5 font-semibold text-slate-700 tracking-wide">
            <span>© {eventSettings?.eventYear || '2026'}</span>
            <span className="text-emerald-700 font-extrabold">{sector}</span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span className="text-slate-500 font-medium text-[11px] sm:text-xs">All Rights Reserved.</span>
          </div>
          <div className="flex items-center justify-center md:justify-start gap-1 text-[10px] text-slate-400 font-mono tracking-wider uppercase">
            <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />
            <span>{festival} Talent Management System</span>
          </div>
        </div>

        {/* Right Side: Developer Credits */}
        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-slate-500 font-medium text-[11px] hover:bg-slate-100/50 transition-colors">
          <span>Developed by</span>
          <span className="font-display font-black text-emerald-800 tracking-tight text-xs">Zenith Software</span>
        </div>

      </div>
    </footer>
  );
}
