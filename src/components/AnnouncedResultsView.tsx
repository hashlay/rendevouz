import React, { useState, useEffect } from 'react';
import { Award, Trophy, Filter, Search, RefreshCw, AlertTriangle, User, Calendar } from 'lucide-react';
import { UserRole, Category, Unit, Participant, Competition, Result, Team, ParticipationType, StageType } from '../types';

interface AnnouncedResultsViewProps {
  user: any;
  token: string;
  eventSettings?: any;
}

export default function AnnouncedResultsView({ user, token, eventSettings }: AnnouncedResultsViewProps) {
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';
  const entityLabelPlural = eventSettings?.entityMode === 'house' ? 'Houses' : eventSettings?.entityMode === 'team' ? 'Teams' : 'Units';
  const [results, setResults] = useState<Result[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedStageType, setSelectedStageType] = useState('');
  const [selectedPrize, setSelectedPrize] = useState('');
  const [search, setSearch] = useState('');

  // Print state
  const [printMode, setPrintMode] = useState<'all' | 'first' | null>(null);

  const handlePrint = (mode: 'all' | 'first') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 100);
  };

  const fetchLists = async () => {
    setLoading(true);
    try {
      const [resRes, catRes, unitRes, compRes, partRes, teamRes] = await Promise.all([
        fetch('/api/results', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/categories'),
        fetch('/api/units'),
        fetch('/api/competitions'),
        fetch('/api/participants', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/teams', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (!resRes.ok || !partRes.ok || !teamRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const [resData, catData, unitData, compData, partData, teamData] = await Promise.all([
        resRes.json(),
        catRes.json(),
        unitRes.json(),
        compRes.json(),
        partRes.json(),
        teamRes.json()
      ]);

      // Only show published results (i.e., publishedStatus === true)
      setResults(resData.filter((r: any) => r.publishedStatus && !r.deletedAt));
      setCategories(catData.filter((c: any) => c.active));
      setUnits(unitData.filter((u: any) => u.active));
      setCompetitions(compData.filter((c: any) => c.active));
      setParticipants(partData.filter((p: any) => !p.deletedAt));
      setTeams(teamData.filter((t: any) => !t.deletedAt));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [token]);

  // Filter competitions that have published results
  const competitionsWithAnnouncedResults = competitions.filter(comp => {
    // Category match
    if (selectedCategoryId && comp.categoryId !== selectedCategoryId) return false;
    // Stage type match
    if (selectedStageType && comp.stageType !== selectedStageType) return false;
    // Search match
    if (search && !comp.name.toLowerCase().includes(search.toLowerCase())) return false;

    // Check if there are results for this comp
    let compResults = results.filter(r => r.competitionId === comp.id && r.rank && r.rank <= 3);
    
    if (selectedPrize) {
      compResults = compResults.filter(r => r.rank?.toString() === selectedPrize);
    }

    if (selectedUnitId) {
      compResults = compResults.filter(r => {
        if (r.participantId) {
          const p = participants.find(part => part.id === r.participantId);
          return p && p.unitId === selectedUnitId;
        } else if (r.teamId) {
          const t = teams.find(team => team.id === r.teamId);
          return t && t.unitId === selectedUnitId;
        }
        return false;
      });
    }

    return compResults.length > 0;
  });

  // Get rank name badge
  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-bold font-display text-[10px] rounded-lg tracking-wide uppercase shadow-2xs">
          <Trophy className="h-3 w-3 text-amber-500 shrink-0" />
          First Place (1st)
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-300 font-bold font-display text-[10px] rounded-lg tracking-wide uppercase">
          Second Place (2nd)
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/50 text-amber-800 border border-amber-200/50 font-bold font-display text-[10px] rounded-lg tracking-wide uppercase">
          Third Place (3rd)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] rounded-lg">
        Rank {rank}
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans min-w-0 w-full overflow-x-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm print:hidden min-w-0 w-full overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-display font-extrabold text-slate-900 tracking-tight">Announced Results</h1>
            <p className="text-xs text-slate-500 mt-0.5">Official winners announced for {eventSettings?.campusName || 'Campus'} {eventSettings?.festivalName || 'Festival'} events.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => handlePrint('all')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 hover:text-emerald-600 hover:bg-emerald-50 transition-all text-xs font-bold cursor-pointer"
          >
            Print All Results
          </button>
          <button 
            onClick={() => handlePrint('first')}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 hover:text-emerald-600 hover:bg-emerald-50 transition-all text-xs font-bold cursor-pointer"
          >
            Print First Prizes Only
          </button>
          <button 
            onClick={fetchLists}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 hover:text-emerald-600 hover:bg-emerald-50 transition-all text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Results
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm space-y-4 print:hidden min-w-0 w-full overflow-hidden">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 border-b pb-2">
          <Filter className="h-4 w-4 text-amber-500" />
          <span>Filter Announced Results</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 min-w-0 w-full">
          {/* Search */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Search Event</label>
            <div className="mt-1.5 relative rounded-xl shadow-2xs">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="E.g. Quran recitation..."
                className="block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium"
              />
            </div>
          </div>

          {/* Category selection */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Category Filter</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="mt-1.5 block w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Unit selection */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Filter by Winning {entityLabel}</label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="mt-1.5 block w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium cursor-pointer"
            >
              <option value="">All {entityLabelPlural}</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
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
              <option value="">All Stages</option>
              <option value={StageType.ON_STAGE}>On-Stage Only</option>
              <option value={StageType.OFF_STAGE}>Off-Stage Only</option>
            </select>
          </div>

          {/* Prize selection */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Prize Placement</label>
            <select
              value={selectedPrize}
              onChange={(e) => setSelectedPrize(e.target.value)}
              className="mt-1.5 block w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-medium cursor-pointer"
            >
              <option value="">All Prizes</option>
              <option value="1">1st Prize Only</option>
              <option value="2">2nd Prize Only</option>
              <option value="3">3rd Prize Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* RESULTS GRID */}
      <div className="print:hidden">
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100">
          <RefreshCw className="h-8 w-8 text-amber-500 animate-spin mb-3" />
          <p className="text-xs text-slate-400">Loading winner boards...</p>
        </div>
      ) : competitionsWithAnnouncedResults.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-dashed border-slate-300">
          <AlertTriangle className="h-8 w-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">No Announced Results Found</p>
          <p className="text-xs text-slate-400 mt-1">None of the matching competitions have announced their official results yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 min-w-0 w-full">
          {competitionsWithAnnouncedResults.map(comp => {
            // Find category
            const category = categories.find(c => c.id === comp.categoryId);
            
            // Get sorted winners for this competition
            let compResults = results.filter(r => r.competitionId === comp.id && r.rank && r.rank <= 3);
            
            if (selectedPrize) {
              compResults = compResults.filter(r => r.rank?.toString() === selectedPrize);
            }

            if (selectedUnitId) {
              compResults = compResults.filter(r => {
                if (r.participantId) {
                  const p = participants.find(part => part.id === r.participantId);
                  return p && p.unitId === selectedUnitId;
                } else if (r.teamId) {
                  const t = teams.find(team => team.id === r.teamId);
                  return t && t.unitId === selectedUnitId;
                }
                return false;
              });
            }

            compResults.sort((a, b) => (a.rank || 0) - (b.rank || 0));

            return (
              <div key={comp.id} className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between min-w-0 w-full">
                <div>
                  {/* Event Title Section */}
                  <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-start gap-3 min-w-0">
                    <div className="space-y-1 min-w-0 flex-1">
                      <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 font-mono text-[9px] font-bold rounded-md tracking-wider border border-emerald-100 uppercase">
                        {category?.name || 'Unknown'}
                      </span>
                      <h3 className="font-display font-extrabold text-slate-800 text-xs sm:text-sm tracking-tight break-words">{comp.name}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold font-mono tracking-wider bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                        {comp.stageType}
                      </span>
                      {comp.language && (
                        <span className="text-[8px] text-slate-400">Lang: {comp.language}</span>
                      )}
                    </div>
                  </div>

                  {/* Winners List */}
                  <div className="p-5 divide-y divide-slate-100">
                    {compResults.map(res => {
                      // Get winner name and unit
                      let winnerName = 'Unknown Participant';
                      let winnerUnitName = 'Unknown Unit';
                      let winnerUnitCode = 'GEN';

                      if (res.participantId) {
                        winnerName = res.participantName || 'Unknown Participant';
                        winnerUnitName = res.unitName || 'Unknown Unit';
                        const u = units.find(unit => unit.name === res.unitName);
                        winnerUnitCode = u ? u.code : 'GEN';
                      } else if (res.teamId) {
                        winnerName = res.teamName || 'Group Team';
                        if (res.teamNumber) {
                           winnerName = `${winnerName} (${res.teamNumber})`;
                        }
                        winnerUnitName = res.unitName || 'Unknown Unit';
                        const u = units.find(unit => unit.name === res.unitName);
                        winnerUnitCode = u ? u.code : 'GEN';
                      }

                      return (
                        <div key={res.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800 text-xs">{winnerName}</p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {entityLabel}: <strong className="text-slate-700">{winnerUnitName}</strong> ({winnerUnitCode})
                            </p>
                          </div>
                          <div className="shrink-0">
                            {getRankBadge(res.rank || 0)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Secure Notice Footer */}
                <div className="px-5 py-2.5 bg-slate-50/50 border-t border-slate-100 flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <span className="inline-block w-1 h-1 bg-emerald-500 rounded-full" />
                  <span>Verified result announced officially</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* PRINT LAYOUT */}
      <div className="hidden print:block print-sheet font-sans text-black bg-white p-8">
        <div className="flex items-center justify-between pb-6 border-b border-dashed border-slate-300 mb-8">
          <div className="flex-shrink-0 w-32 flex justify-start">
            {eventSettings?.logoUrl && (
              <img src={eventSettings.logoUrl} alt="Festival Logo" className="max-h-24 object-contain" />
            )}
          </div>
          <div className="flex flex-col items-center text-center flex-1">
            <span className="font-display font-extrabold text-2xl tracking-wider text-slate-900 uppercase">{eventSettings?.festivalName?.toUpperCase() || 'FESTIVAL'} 2026</span>
            <span className="font-mono text-xs font-semibold text-emerald-700 tracking-widest uppercase mt-1">{eventSettings?.campusName?.toUpperCase() || 'CAMPUS'} COMMITTEE</span>
            <h1 className="text-xl font-bold text-center mt-4 uppercase">
              {printMode === 'first' ? 'First Prizes Sheet' : 'Official Results Sheet'}
            </h1>
          </div>
          <div className="flex-shrink-0 w-32"></div>
        </div>

        <div className="space-y-8">
          {categories.filter(c => c.active).map(cat => {
            const catComps = competitionsWithAnnouncedResults.filter(comp => comp.categoryId === cat.id);
            
            // Map and filter printable results for each competition
            const printableComps = catComps.map(comp => {
              let compResults = results.filter(r => r.competitionId === comp.id && r.rank && r.rank <= 3);
              
              if (printMode === 'first') {
                compResults = compResults.filter(r => r.rank === 1);
              } else if (selectedPrize) {
                compResults = compResults.filter(r => r.rank?.toString() === selectedPrize);
              }

              if (selectedUnitId) {
                compResults = compResults.filter(r => {
                  if (r.participantId) {
                    const p = participants.find(part => part.id === r.participantId);
                    return p && p.unitId === selectedUnitId;
                  } else if (r.teamId) {
                    const t = teams.find(team => team.id === r.teamId);
                    return t && t.unitId === selectedUnitId;
                  }
                  return false;
                });
              }

              compResults.sort((a, b) => (a.rank || 0) - (b.rank || 0));
              return { comp, results: compResults };
            }).filter(item => item.results.length > 0);

            if (printableComps.length === 0) return null;

            return (
              <div key={cat.id} className="mb-8">
                <h2 className="text-xl font-bold border-b-2 border-black pb-1 mb-4 uppercase">{cat.name}</h2>
                <div className="space-y-5">
                  {printableComps.map((item, idx) => (
                    <div key={item.comp.id} className="pl-4">
                      <h3 className="font-bold text-lg mb-2">{idx + 1}. {item.comp.name}</h3>
                      <div className="pl-6 space-y-1.5">
                        {item.results.map(res => {
                          let winnerName = 'Unknown Participant';
                          let winnerUnitName = 'Unknown Unit';
                          if (res.participantId) {
                            const p = participants.find(part => part.id === res.participantId);
                            if (p) {
                              winnerName = p.fullName;
                              const u = units.find(unit => unit.id === p.unitId);
                              winnerUnitName = u ? u.name : '';
                            }
                          } else if (res.teamId) {
                            const t = teams.find(team => team.id === res.teamId);
                            if (t) {
                              winnerName = t.teamName || 'Group Team';
                              const u = units.find(unit => unit.id === t.unitId);
                              winnerUnitName = u ? u.name : '';
                            }
                          }
                          
                          return (
                            <div key={res.id} className="flex gap-3 text-base">
                              {printMode === 'all' && (
                                <span className="font-bold min-w-[30px]">
                                  {res.rank === 1 ? '1st' : res.rank === 2 ? '2nd' : res.rank === 3 ? '3rd' : `${res.rank}th`}
                                </span>
                              )}
                              <span>{winnerName} - {winnerUnitName}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
