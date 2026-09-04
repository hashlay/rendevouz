import React from 'react';
import {
  LayoutDashboard, UserPlus, Users, Trophy, Award,
  Settings, Users2, ShieldAlert, FileSpreadsheet,
  LogOut, ClipboardList, BookOpen, Menu, X,
  Hash, Theater, Scale, FileBadge, Image, Camera, Globe, Printer
} from 'lucide-react';
import { User, UserRole } from '../types';
import SSFLogo from './SSFLogo';

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  eventSettings: any;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export default function Sidebar({
  user, activeTab, setActiveTab, onLogout, eventSettings, mobileOpen, setMobileOpen
}: SidebarProps) {

  const [logoFailed, setLogoFailed] = React.useState(false);

  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'registration', label: 'New Registration', icon: UserPlus, roles: [UserRole.SUPER_ADMIN, UserRole.UNIT_TEAM_LEADER] },
    { id: 'participants', label: 'Participants', icon: Users, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.UNIT_TEAM_LEADER] },
    { id: 'teams', label: 'Group Teams', icon: Users2, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.UNIT_TEAM_LEADER] },
    { id: 'chest-numbers', label: 'Chest Numbers', icon: Hash, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.GREEN_ROOM_MANAGER] },
    { id: 'chest-number-studio', label: 'Chest Number Printing', icon: Printer, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.GREEN_ROOM_MANAGER] },

    { id: 'green-room', label: 'Green Room', icon: Theater, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.GREEN_ROOM_MANAGER] },
    { id: 'judgment-sheets', label: 'Judgment Sheets', icon: Scale, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.JUDGE, UserRole.RESULT_MANAGER] },
    { id: 'registered-events', label: 'Registered Events', icon: ClipboardList, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.UNIT_TEAM_LEADER] },
    { id: 'announced-results', label: 'Announced Results', icon: Award, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.UNIT_TEAM_LEADER] },
    { id: 'certificates', label: 'Certificates', icon: FileBadge, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'certificate-studio', label: 'Certificate Studio', icon: FileBadge, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'posters', label: 'Posters', icon: BookOpen, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.UNIT_TEAM_LEADER, UserRole.RESULT_MANAGER] },
    { id: 'poster-studio', label: 'Poster Studio', icon: BookOpen, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'highlights', label: 'Highlights Studio', icon: Trophy, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'gallery-studio', label: 'Gallery Studio', icon: Image, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'cms-studio', label: 'CMS Website', icon: Globe, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'competitions', label: 'Competitions', icon: ClipboardList, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'results', label: 'Result Entry', icon: Trophy, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.RESULT_MANAGER] },
    { id: 'scoreboard', label: 'Individual Scores', icon: Award, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'standings', label: `${entityLabel} Standings`, icon: Trophy, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'reports', label: 'Reports & Exports', icon: FileSpreadsheet, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM, UserRole.UNIT_TEAM_LEADER] },
    { id: 'users', label: 'User Accounts', icon: ShieldAlert, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: [UserRole.SUPER_ADMIN, UserRole.SECTOR_TEAM] },
  ];

  const filteredItems = menuItems.filter(item =>
    user.role === UserRole.VIEWER || item.roles.includes(user.role as UserRole)
  );

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between bg-emerald-950 text-emerald-100 border-r border-emerald-900 font-sans">
      <div className="flex-1 overflow-y-auto min-h-0 sidebar-scroll">
        {/* Logo and Event Header */}
        {(() => {
          const isOldLogo = eventSettings?.ssfLogoUrl && (
            eventSettings.ssfLogoUrl.includes('base64') ||
            eventSettings.ssfLogoUrl.includes('zenith') ||
            eventSettings.ssfLogoUrl.includes('ssf_logo')
          );
          const adminLogoUrl = (!isOldLogo && eventSettings?.ssfLogoUrl) ? eventSettings.ssfLogoUrl : '/tabassum_logo.jpg';

          return eventSettings?.fillLogo ? (
            <div className="py-3 px-3.5 border-b border-emerald-900 bg-emerald-950/60 flex justify-center items-center text-center w-full min-h-[80px]">
              {!logoFailed ? (
                <img
                  src={adminLogoUrl}
                  alt="Festival Logo"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src.includes('tabassum_logo.jpg')) {
                      target.src = '/tabassum_logo.png';
                    } else {
                      setLogoFailed(true);
                    }
                  }}
                  style={{
                    height: '72px',
                    width: 'auto',
                    maxWidth: '190px',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              ) : (
                <div style={{ height: '72px', width: 'auto', maxWidth: '190px' }}>
                  <SSFLogo className="text-emerald-400" showText={false} />
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 border-b border-emerald-900 bg-emerald-950/50 flex items-center gap-3">
              {!logoFailed ? (
                <img
                  src={adminLogoUrl}
                  alt="Festival Logo"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (target.src.includes('tabassum_logo.jpg')) {
                      target.src = '/tabassum_logo.png';
                    } else {
                      setLogoFailed(true);
                    }
                  }}
                  className="h-10 sm:h-12 w-auto max-w-[50%] object-contain shrink-0 mx-auto block drop-shadow-md"
                />
              ) : (
                <SSFLogo className="h-10 sm:h-12 w-auto max-w-[50%] bg-white/10 p-2 rounded-xl text-emerald-400 shrink-0 mx-auto block" showText={false} />
              )}
              <div className="flex flex-col">
                <span className="font-display font-extrabold text-amber-400 text-sm tracking-wide leading-none uppercase">
                  {eventSettings?.festivalName || 'At-Tabassum MEELAD FEST'}
                </span>
                <span className="text-emerald-300 text-[10px] font-mono tracking-widest uppercase mt-1">
                  {eventSettings?.campusName || eventSettings?.sectorName || 'Noorul Islam Madrasa, Jeppu'}
                </span>
              </div>
            </div>
          );
        })()}

        {user.role === UserRole.VIEWER && (
          <div className="mx-3 mt-3 p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-300 text-[11px] font-mono font-bold flex items-center gap-2">
            <span>👁️ DEMO VIEWER (READ ONLY)</span>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="mt-6 px-3 space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileOpen(false); // Close mobile drawer on selection
                }}
                className={`w-full flex items-center px-4 py-2.5 text-sm font-semibold rounded-lg transition-all group ${isActive
                  ? 'bg-amber-500 text-slate-900 shadow-md shadow-amber-500/10'
                  : 'text-emerald-200 hover:bg-emerald-900/60 hover:text-white'
                  }`}
              >
                <Icon className={`mr-3 h-5 w-5 shrink-0 ${isActive ? 'text-slate-900' : 'text-emerald-300 group-hover:text-amber-300'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User details and Logout footer */}
      <div className="p-4 border-t border-emerald-900 bg-emerald-950/40">
        <div className="flex items-center gap-3 px-2 py-3 mb-2">
          <div className="h-8 w-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold font-display text-sm shadow-inner uppercase">
            {user.fullName.charAt(0)}
          </div>
          <div className="flex flex-col overflow-hidden">
            <span className="text-xs font-semibold text-white truncate">{user.fullName}</span>
            <span className="text-[10px] font-mono text-emerald-400 capitalize truncate">
              {user.role === UserRole.UNIT_TEAM_LEADER ? 'Unit Leader' : user.role.replace('_', ' ')}
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center px-4 py-2 text-xs font-semibold rounded-lg text-rose-300 hover:bg-rose-950/40 hover:text-rose-100 transition-colors"
        >
          <LogOut className="mr-3 h-4 w-4 text-rose-400" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50  z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Slider Drawer */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-emerald-950 z-40 transform transition-transform duration-300 md:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        {sidebarContent}
      </aside>
    </>
  );
}
