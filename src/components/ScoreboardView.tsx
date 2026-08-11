import React, { useState, useEffect } from 'react';
import { 
  Award, Trophy, Search, Filter, RefreshCw, Eye, Star, ChevronDown, CheckCircle2 
} from 'lucide-react';
import { User, UserRole, Category, Unit } from '../types';

interface ScoreboardViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

export default function ScoreboardView({ user, token, eventSettings }: ScoreboardViewProps) {
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';
  const entityLabelPlural = eventSettings?.entityMode === 'house' ? 'Houses' : eventSettings?.entityMode === 'team' ? 'Teams' : 'Units';
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState(user.role === UserRole.UNIT_TEAM_LEADER ? (user.assignedUnitId || '') : '');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedStageType, setSelectedStageType] = useState('');

  // Selected participant breakdown modal
  const [selectedRow, setSelectedRow] = useState<any>(null);

  const fetchScoreboard = async () => {
    setLoading(true);
    try {
      const [sbRes, cRes, uRes] = await Promise.all([
        fetch(`/api/scoreboard?unitId=${selectedUnitId}&categoryId=${selectedCategoryId}&search=${search}&stageType=${selectedStageType}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/categories'),
        fetch('/api/units')
      ]);

      if (!sbRes.ok) {
        const err = await sbRes.json();
        throw new Error(err.error || 'Failed to fetch scoreboard');
      }

      const [sbData, cData, uData] = await Promise.all([sbRes.json(), sbRes.ok ? cRes.json() : [], sbRes.ok ? uRes.json() : []]);

      setScoreboard(sbData);
      setCategories(cData);
      setUnits(uData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScoreboard();
  }, [selectedUnitId, selectedCategoryId, search, selectedStageType]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
        <span className="text-slate-500 font-mono text-xs">Loading individual scoreboard...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* Filters Row */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center no-print">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4.5 w-4.5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search candidate scoreboard..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
          {user.role !== UserRole.UNIT_TEAM_LEADER && (
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl text-slate-700 focus:outline-none text-xs font-semibold bg-slate-50"
            >
              <option value="">All {entityLabelPlural}</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}

          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-slate-700 focus:outline-none text-xs font-semibold bg-slate-50"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={selectedStageType}
            onChange={(e) => setSelectedStageType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-slate-700 focus:outline-none text-xs font-semibold bg-slate-50"
          >
            <option value="">All Stages</option>
            <option value="on_stage">On-Stage Only</option>
            <option value="off_stage">Off-Stage Only</option>
          </select>
        </div>
      </div>

      {/* Scoreboard List Grid */}
      <div className="no-print">
        {/* Mobile card list layout */}
        <div className="block md:hidden space-y-3">
          {scoreboard.length > 0 ? (
            scoreboard.map((row) => {
              const isTopThree = row.rank <= 3;
              return (
                <div 
                  key={row.participantId} 
                  className={`bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3 hover:shadow-sm transition-shadow ${
                    isTopThree ? 'bg-amber-50/10 border-amber-200/60' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        row.rank === 1 ? 'bg-amber-400 text-amber-950 shadow-md ring-2 ring-amber-100' :
                        row.rank === 2 ? 'bg-slate-200 text-slate-800' :
                        row.rank === 3 ? 'bg-orange-200 text-orange-900' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {row.rank}
                      </span>
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm">{row.name}</h4>
                        <span className="text-[10px] text-slate-400 font-mono">Chest: {row.chestNumber}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-extrabold text-emerald-700 block">{row.overallMarks}</span>
                      <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">Marks</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 text-xs">
                    <div className="text-slate-600">
                      {entityLabel}: <span className="font-semibold text-slate-800">{row.unitName}</span>
                    </div>
                    <span className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-lg">
                      {row.categoryName}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                    <span className="text-xs text-slate-500 font-medium">Events: <strong className="text-slate-700">{row.totalEvents}</strong></span>
                    <button
                      onClick={() => setSelectedRow(row)}
                      className="flex items-center gap-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5 text-slate-400" />
                      <span>Scorecard</span>
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white p-8 text-center text-slate-400 font-mono text-xs border rounded-2xl">
              No scores entered yet
            </div>
          )}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Standing</th>
                  <th className="px-6 py-4 text-left">Chest No</th>
                  <th className="px-6 py-4 text-left">Candidate Name</th>
                  <th className="px-6 py-4 text-left">{entityLabel}</th>
                  <th className="px-6 py-4 text-left">Category</th>
                  <th className="px-6 py-4 text-center">Event count</th>
                  <th className="px-6 py-4 text-right">Overall Marks</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-sm">
                {scoreboard.length > 0 ? (
                  scoreboard.map((row) => {
                    const isTopThree = row.rank <= 3;
                    return (
                      <tr key={row.participantId} className={`hover:bg-slate-50/40 transition-colors ${isTopThree ? 'bg-amber-50/10' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-xs ${
                              row.rank === 1 ? 'bg-amber-400 text-amber-950 shadow-md ring-2 ring-amber-100' :
                              row.rank === 2 ? 'bg-slate-200 text-slate-800' :
                              row.rank === 3 ? 'bg-orange-200 text-orange-900' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {row.rank}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-500 whitespace-nowrap">{row.chestNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-800">{row.name}</td>
                        <td className="px-6 py-4 font-semibold text-slate-600 whitespace-nowrap">{row.unitName}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-xl">
                            {row.categoryName}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center font-semibold text-slate-600">{row.totalEvents}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-base font-extrabold text-emerald-700">{row.overallMarks}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => setSelectedRow(row)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-50 border border-slate-200/50"
                            title="View Score Breakdown"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-mono text-xs">
                      No scores entered yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- SCORE BREAKDOWN DRAWERS MODAL --- */}
      {selectedRow && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-scale-up space-y-4">
            
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-display font-extrabold text-slate-800 text-base">{selectedRow.name} Scorecard</h3>
                <span className="text-[10px] font-mono text-slate-400 block mt-0.5 uppercase font-bold">
                  {selectedRow.chestNumber} • {selectedRow.unitName} • {selectedRow.categoryName}
                </span>
              </div>
              <button onClick={() => setSelectedRow(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              
              {/* Individual vs Group contributions card */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border">
                <div className="text-center">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase font-mono">Individual Contribution</span>
                  <span className="text-lg font-extrabold text-slate-800 mt-1 block">{selectedRow.individualMarks} marks</span>
                </div>
                <div className="text-center border-l">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase font-mono">Group Contribution</span>
                  <span className="text-lg font-extrabold text-slate-800 mt-1 block">{selectedRow.groupMarks} marks</span>
                </div>
              </div>

              {/* Placement logs */}
              <div>
                <h4 className="font-display font-bold text-slate-700 text-xs mb-2">Detailed Placements</h4>
                <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {selectedRow.placements.map((pl: any, idx: number) => (
                    <li key={idx} className="bg-slate-50 border p-2.5 rounded-xl flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-800 block">{pl.compName}</span>
                        <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">{pl.type} • Rank {pl.rank || 'N/A'}</span>
                      </div>
                      <span className="font-bold text-emerald-600">{pl.marks} marks</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            <button
              onClick={() => setSelectedRow(null)}
              className="mt-4 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Close Scorecard
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
