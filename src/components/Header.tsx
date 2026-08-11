import React, { useState, useEffect } from 'react';
import { Menu, Clock, HelpCircle, Bell, History } from 'lucide-react';
import { User, UserRole } from '../types';

interface HeaderProps {
  user: User;
  activeTab: string;
  setMobileOpen: (open: boolean) => void;
  eventSettings: any;
  onShowLogs?: () => void;
}

export default function Header({ user, activeTab, setMobileOpen, eventSettings, onShowLogs }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getTabTitle = (tab: string) => {
    switch(tab) {
      case 'dashboard': return 'Dashboard Overview';
      case 'registration': return 'Participant Registration';
      case 'participants': return 'Participants Directory';
      case 'teams': return 'Group Teams Management';
      case 'competitions': return 'Competitions Master';
      case 'results': return 'Competition Result Entry';
      case 'scoreboard': return 'Individual Scores Scoreboard';
      case 'standings': return `${eventSettings?.entityLabel || 'Unit'} Standings & Rankings`;
      case 'reports': return 'Printable Reports & CSV Exports';
      case 'users': return 'User Account Configuration';
      case 'settings': return 'CMS Portal & System Config';
      default: return 'Management Console';
    }
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200/80 px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm shadow-slate-100/50 no-print">
      <div className="flex items-center gap-3">
        {/* Mobile menu toggle */}
        <button 
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none"
        >
          <Menu className="h-6 w-6" />
        </button>
        
        <div className="flex flex-col">
          <h1 className="font-display font-bold text-slate-900 text-lg md:text-xl tracking-tight">
            {getTabTitle(activeTab)}
          </h1>
          <span className="hidden sm:inline-block text-[10px] font-semibold text-slate-400 mt-0.5 tracking-wider uppercase font-mono">
            {eventSettings?.campusName || eventSettings?.sectorName || 'Campus'} • {eventSettings?.festivalName || eventSettings?.eventTitle || 'Sahityotsav'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Real-time Clock */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-50 border border-slate-200/60 px-3 py-1.5 rounded-xl font-mono text-xs text-slate-600 shadow-sm shadow-slate-50/50">
          <Clock className="h-4 w-4 text-emerald-600 animate-pulse" />
          <span className="font-semibold text-slate-800">{formatTime(time)}</span>
          <span className="text-slate-400">|</span>
          <span>{formatDate(time)}</span>
        </div>

        {/* Assigned Unit Badge for Unit leaders */}
        {user.role === UserRole.UNIT_TEAM_LEADER && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-xl font-mono text-xs font-semibold uppercase flex items-center gap-1.5 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Unit Mode: {user.assignedUnitId?.replace('unit_', '')}
          </div>
        )}

        {/* Audit Log Quick Access for Super Admin */}
        {user.role === UserRole.SUPER_ADMIN && onShowLogs && (
          <button 
            onClick={onShowLogs}
            className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-slate-50 border border-slate-200/50 hover:border-slate-200 shadow-sm transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="View Audit History"
          >
            <History className="h-4.5 w-4.5" />
            <span className="hidden sm:inline">Audit Log</span>
          </button>
        )}
      </div>
    </header>
  );
}
