import React, { useState, useEffect } from 'react';
import { ClipboardList, Filter, Printer, RefreshCw, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { User, UserRole, Category, Unit, Participant, Competition, Team, ParticipationType, StageType } from '../types';

interface RegisteredEventsViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

export default function RegisteredEventsView({ user, token, eventSettings }: RegisteredEventsViewProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    user.role === UserRole.UNIT_TEAM_LEADER ? (user.assignedUnitId || '') : ''
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedStageType, setSelectedStageType] = useState<string>('');

  const fetchLists = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, uRes, compRes, regRes, teamsRes] = await Promise.all([
        fetch('/api/participants', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/categories'),
        fetch('/api/units'),
        fetch('/api/competitions'),
        fetch('/api/registrations', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/teams', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!pRes.ok || !regRes.ok || !teamsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [pData, cData, uData, compData, regData, teamsData] = await Promise.all([
        pRes.json(),
        cRes.json(),
        uRes.json(),
        compRes.json(),
        regRes.json(),
        teamsRes.json()
      ]);

      setParticipants(pData.filter((p: any) => !p.deletedAt));
      setCategories(cData);
      setUnits(uData);
      setCompetitions(compData);
      setRegistrations(regData);
      setTeams(teamsData.filter((t: any) => !t.deletedAt));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  // Get active unit details
  const currentUnit = units.find(u => u.id === selectedUnitId);

  // Group competitions by category and render them
  // Filter categories to show
  const categoriesToDisplay = categories.filter(c => {
    if (!c.active) return false;
    if (selectedCategoryId && c.id !== selectedCategoryId) return false;
    return true;
  });

  const categoryIndexMap = new Map<string, number>();
  categories.forEach((cat, index) => {
    categoryIndexMap.set(cat.id, index);
  });

  const sortedCategories = [...categoriesToDisplay].sort((a, b) => {
    const idxA = categoryIndexMap.has(a.id) ? categoryIndexMap.get(a.id)! : 99;
    const idxB = categoryIndexMap.has(b.id) ? categoryIndexMap.get(b.id)! : 99;
    return idxA - idxB;
  });

  return (
    <div className="space-y-6 font-sans min-w-0 w-full overflow-x-hidden">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs print:hidden">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Registered Events Checklist</h1>
            <p className="text-xs text-slate-500 mt-0.5">View and print registered competitors and group teams of your unit category-wise.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchLists}
            className="p-2.5 text-slate-500 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-all cursor-pointer"
            title="Refresh lists"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={handlePrint}
            disabled={!selectedUnitId}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print Entry List
          </button>
        </div>
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 print:hidden">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b pb-2">
          <Filter className="h-4 w-4 text-emerald-500" />
          <span>Filter Registered Events</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Unit selection */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Unit / House Filter</label>
            {user.role === UserRole.UNIT_TEAM_LEADER ? (
              <div className="mt-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium text-xs">
                {currentUnit?.name || 'Your Unit'}
              </div>
            ) : (
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="mt-1.5 block w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium cursor-pointer"
              >
                <option value="">All Units (Show All Registered Entries)</option>
                {units.filter(u => u.active).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                ))}
              </select>
            )}
          </div>

          {/* Category selection */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Category Filter</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="mt-1.5 block w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium cursor-pointer"
            >
              <option value="">All Categories (Ordered)</option>
              {categories.filter(c => c.active).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Stage selection */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Stage Placement</label>
            <select
              value={selectedStageType}
              onChange={(e) => setSelectedStageType(e.target.value)}
              className="mt-1.5 block w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium cursor-pointer"
            >
              <option value="">All Program Stages</option>
              <option value={StageType.ON_STAGE}>On-Stage Programs Only</option>
              <option value={StageType.OFF_STAGE}>Off-Stage Programs Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* CORE CONTENT LIST */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
          <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Compiling registration lists...</p>
        </div>
      ) : (
        <div className="space-y-8 print-sheet print:overflow-visible">
          
          {/* Print Only Header */}
          <div className="hidden print:flex items-center justify-between pb-6 border-b border-dashed border-slate-300 mb-6">
            <div className="flex-shrink-0 w-32 flex justify-start">
              {eventSettings?.logoUrl && (
                <img src={eventSettings.logoUrl} alt="Festival Logo" className="max-h-24 object-contain" />
              )}
            </div>
            <div className="flex flex-col items-center text-center flex-1">
              <span className="font-display font-extrabold text-2xl tracking-wider text-slate-900 uppercase">{eventSettings?.festivalName?.toUpperCase() || 'FESTIVAL'} 2026</span>
              <span className="font-mono text-xs font-semibold text-emerald-700 tracking-widest uppercase mt-1">{eventSettings?.campusName?.toUpperCase() || 'CAMPUS'} COMMITTEE</span>
              <h1 className="text-xl font-bold text-center mt-4 uppercase">
                Registered Entries
              </h1>
              <div className="flex justify-center gap-8 text-sm font-semibold text-slate-700 mt-2">
                <span>{entityLabel.toUpperCase()}: <strong className="text-black underline">{selectedUnitId ? `${currentUnit?.name} (${currentUnit?.code})` : `ALL ${entityLabel.toUpperCase()}S`}</strong></span>
                {selectedStageType && <span>STAGE: <strong className="text-black uppercase">{selectedStageType}</strong></span>}
                <span>DATE: <strong className="text-black">{new Date().toLocaleDateString()}</strong></span>
              </div>
            </div>
            <div className="flex-shrink-0 w-32"></div>
          </div>

          {sortedCategories.map(category => {
            // Find active competitions for this category, filtered by stage type
            const categoryComps = competitions.filter(c => {
              if (c.categoryId !== category.id || !c.active) return false;
              if (selectedStageType && c.stageType !== selectedStageType) return false;
              return true;
            });

            if (categoryComps.length === 0) return null;

            // Sort comps by name
            const sortedComps = [...categoryComps].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0) || a.name.localeCompare(b.name));

            return (
              <div key={category.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden print:overflow-visible print:shadow-none break-inside-avoid">
                {/* Category Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-display font-bold text-slate-800 text-sm uppercase tracking-wide">{category.name} Category</h3>
                  <span className="px-2.5 py-1 bg-slate-200 text-slate-600 font-mono text-[10px] font-bold rounded-lg print:hidden">
                    {categoryComps.length} Events
                  </span>
                </div>

                {/* Competition entry list */}
                <div className="divide-y divide-slate-100">
                  {sortedComps.map(comp => {
                    let registeredContent: React.ReactNode = null;

                    if (comp.participationType === ParticipationType.INDIVIDUAL) {
                      // Find participants registered in this individual competition
                      const compParticipants = participants.filter(p => {
                        if (selectedUnitId && p.unitId !== selectedUnitId) return false;
                        const reg = registrations.find(r => r.participantId === p.id);
                        return reg && reg.selectedIndividualCompetitionIds.includes(comp.id);
                      });

                      if (compParticipants.length > 0) {
                        registeredContent = (
                          <div className="space-y-1.5 w-full">
                            {compParticipants.map(participant => {
                              const pUnit = units.find(u => u.id === participant.unitId);
                              return (
                                <div key={participant.id} className="flex items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100/80">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 print:hidden" />
                                    <div>
                                      <p className="font-semibold text-slate-900 text-xs">{participant.fullName}</p>
                                      <span className="text-[10px] text-slate-400 font-mono">Chest No: {participant.profilePhoto || 'N/A'}</span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-bold font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 shrink-0">
                                    {pUnit?.name || 'Unit'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        registeredContent = (
                          <span className="text-slate-400 font-medium italic text-xs">Not Registered / No Entry</span>
                        );
                      }
                    } else {
                      // Find group teams registered in this competition
                      const compTeams = teams.filter(t => {
                        if (selectedUnitId && t.unitId !== selectedUnitId) return false;
                        return t.competitionId === comp.id;
                      });

                      if (compTeams.length > 0) {
                        registeredContent = (
                          <div className="space-y-1.5 w-full">
                            {compTeams.map(team => {
                              const tUnit = units.find(u => u.id === team.unitId);
                              const teamMembers = team.memberIds.map(mid => {
                                const p = participants.find(part => part.id === mid);
                                return p ? p.fullName : 'Unknown';
                              }).join(', ');

                              return (
                                <div key={team.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100/80">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <Users className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                      <span className="font-semibold text-slate-800 text-xs">{team.teamName || team.teamNumber}</span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-sans">Members: {teamMembers}</span>
                                  </div>
                                  <span className="text-[10px] font-bold font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 shrink-0 self-start sm:self-auto">
                                    {tUnit?.name || 'Unit'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      } else {
                        registeredContent = (
                          <span className="text-slate-400 font-medium italic text-xs">Not Registered / No Entry</span>
                        );
                      }
                    }

                    return (
                      <div key={comp.id} className="p-4 sm:px-6 flex flex-col sm:flex-row justify-between sm:items-start gap-4 hover:bg-slate-50/50 transition-colors">
                        {/* Event Details */}
                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-slate-800 text-xs">{comp.name}</h4>
                            <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono tracking-wider uppercase border ${
                              comp.stageType === StageType.ON_STAGE 
                                ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                : 'bg-blue-50 text-blue-600 border-blue-200'
                            }`}>
                              {comp.stageType}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold font-mono tracking-wider bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                              {comp.participationType}
                            </span>
                          </div>
                          {comp.language && (
                            <p className="text-[10px] text-slate-400 font-sans">Medium: <strong className="text-slate-500">{comp.language}</strong></p>
                          )}
                        </div>

                        {/* Registered Candidate info */}
                        <div className="w-full sm:w-1/2">
                          {registeredContent}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

        </div>
      )}

    </div>
  );
}
