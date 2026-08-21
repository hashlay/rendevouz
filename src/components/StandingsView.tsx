import React, { useState, useEffect } from 'react';
import { 
  Trophy, Award, RefreshCw, BarChart2, Star, Calendar, Medal, ChevronDown 
} from 'lucide-react';
import { User, UserRole } from '../types';

interface StandingsViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

export default function StandingsView({ user, token, eventSettings }: StandingsViewProps) {
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';
  const entityLabelPlural = eventSettings?.entityMode === 'house' ? 'Houses' : eventSettings?.entityMode === 'team' ? 'Teams' : 'Units';

  const [standings, setStandings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded breakdowns state per unit row
  const [selectedUnit, setSelectedUnit] = useState<any>(null);

  const fetchStandings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/standings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch standings');
      }
      setStandings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStandings();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
        <span className="text-slate-500 font-mono text-xs">Loading {entityLabel.toLowerCase()} standings...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans min-w-0 w-full overflow-x-hidden">
      
      {/* 1. Visual Bento Standings Card lists - Centered for 1, 2, or 3+ units */}
      <div className={`gap-4 min-w-0 w-full ${
        standings.length === 1 
          ? 'flex justify-center max-w-md mx-auto' 
          : standings.length === 2 
          ? 'grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto' 
          : 'grid grid-cols-1 md:grid-cols-3'
      }`}>
        {standings.slice(0, 3).map((unit, index) => {
          return (
            <div 
              key={unit.unitId} 
              className={`bg-gradient-to-br p-5 sm:p-6 rounded-2xl sm:rounded-3xl border flex flex-col justify-between cursor-pointer min-w-0 w-full overflow-hidden ${
                index === 0 ? 'from-emerald-900 to-emerald-950 text-emerald-100 border-emerald-800' : 'bg-white text-slate-800 border-slate-200/80'
              }`}
              onClick={() => setSelectedUnit(unit)}
            >
              <div>
                <div className="flex justify-between items-start">
                  <span className={`px-2.5 py-1 rounded-full font-mono text-[10px] font-bold tracking-widest uppercase ${
                    index === 0 ? 'bg-emerald-800 text-emerald-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    Podium #{index + 1}
                  </span>
                  <Trophy className={`h-6 w-6 ${index === 0 ? 'text-amber-400' : 'text-slate-400'}`} />
                </div>

                <div className="mt-5">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Campus {entityLabel}</span>
                  <h3 className={`font-display font-extrabold text-xl md:text-2xl mt-1 truncate ${index === 0 ? 'text-white' : 'text-slate-800'}`}>
                    {unit.unitName}
                  </h3>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100/10 flex justify-between items-baseline font-mono">
                <div>
                  <span className="text-[10px] font-bold text-slate-400">OFFICIAL POINTS</span>
                  <span className={`text-2xl font-extrabold block mt-1 ${index === 0 ? 'text-amber-400' : 'text-emerald-700'}`}>
                    {unit.overallPoints} pts
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400">RAW MARKS</span>
                  <span className={`text-base font-bold block mt-1 ${index === 0 ? 'text-white' : 'text-slate-600'}`}>
                    {unit.overallMarks}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Full Standings list */}
      <div className="no-print">
        {/* Mobile card list layout */}
        <div className="block md:hidden space-y-3">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex justify-between items-center text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            <span>{entityLabel} Standings</span>
            <span>Sorted by Points</span>
          </div>
          {standings.map((row, index) => {
            const standing = index + 1;
            return (
              <div key={row.unitId} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <span className="h-6 w-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-mono font-extrabold text-xs">
                      #{standing}
                    </span>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{row.unitName}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">Code: {row.unitCode}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-extrabold text-emerald-700 block">{row.overallPoints} pts</span>
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase">{row.overallMarks} marks</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-bold">
                    <span className="flex items-center gap-0.5 bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200" title="1st Place">
                      <Medal className="h-3 w-3 text-amber-500" />
                      {row.firstPlaceCount}
                    </span>
                    <span className="flex items-center gap-0.5 bg-slate-50 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200" title="2nd Place">
                      <Medal className="h-3 w-3 text-slate-400" />
                      {row.secondPlaceCount}
                    </span>
                    <span className="flex items-center gap-0.5 bg-orange-50 text-orange-900 px-1.5 py-0.5 rounded border border-orange-200" title="3rd Place">
                      <Medal className="h-3 w-3 text-orange-400" />
                      {row.thirdPlaceCount}
                    </span>
                    <span className="flex items-center gap-0.5 bg-emerald-50 text-emerald-900 px-1.5 py-0.5 rounded border border-emerald-200" title="4th to 7th Place">
                      <Star className="h-3 w-3 text-emerald-500" />
                      {row.fourthToSeventhPlaceCount || 0}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedUnit(row)}
                    className="px-3 py-1.5 bg-slate-50 border hover:bg-slate-100 rounded-xl font-bold text-[10px] text-slate-700 transition-colors"
                  >
                    Breakdown
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden min-w-0 w-full">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-emerald-600" />
              <h4 className="font-display font-bold text-slate-800 text-base">{entityLabel} Standings Registry</h4>
            </div>
          </div>

          <div className="overflow-x-auto w-full min-w-0">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Standing</th>
                  <th className="px-6 py-4 text-left">{entityLabel} Code</th>
                  <th className="px-6 py-4 text-left">{entityLabel} Name</th>
                  <th className="px-6 py-4 text-center">Medal Tally (R1 - R2 - R3 - R4-7)</th>
                  <th className="px-6 py-4 text-right">Raw Marks</th>
                  <th className="px-6 py-4 text-right">Official Points</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-sm">
                {standings.map((row, index) => {
                  const standing = index + 1;
                  return (
                    <tr key={row.unitId} className="hover:bg-slate-50/40 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-bold text-slate-500">#{standing}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono font-extrabold text-slate-700">{row.unitCode}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-800">{row.unitName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-3 font-mono font-bold text-xs">
                          <span className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200" title="1st Place">
                            <Medal className="h-3.5 w-3.5 text-amber-500" />
                            {row.firstPlaceCount}
                          </span>
                          <span className="flex items-center gap-1 bg-slate-50 text-slate-800 px-2 py-0.5 rounded border border-slate-200" title="2nd Place">
                            <Medal className="h-3.5 w-3.5 text-slate-400" />
                            {row.secondPlaceCount}
                          </span>
                          <span className="flex items-center gap-1 bg-orange-50 text-orange-900 px-2 py-0.5 rounded border border-orange-200" title="3rd Place">
                            <Medal className="h-3.5 w-3.5 text-orange-400" />
                            {row.thirdPlaceCount}
                          </span>
                          <span className="flex items-center gap-1 bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded border border-emerald-200" title="4th to 7th Place">
                            <Star className="h-3.5 w-3.5 text-emerald-500" />
                            {row.fourthToSeventhPlaceCount || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-slate-600">{row.overallMarks}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-base font-extrabold text-emerald-700">{row.overallPoints}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => setSelectedUnit(row)}
                          className="px-3 py-1.5 bg-slate-50 border hover:bg-slate-100 rounded-xl font-semibold text-xs text-slate-700"
                        >
                          Breakdown
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- DETAILED CATEGORY BREAKDOWN DIALOG --- */}
      {selectedUnit && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg max-w-md w-full p-6 space-y-4">
            
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-display font-extrabold text-slate-800 text-base">{selectedUnit.unitName} Standings</h3>
                <span className="text-[10px] font-mono text-slate-400 block mt-0.5 font-bold">
                  OFFICIAL POINTS: {selectedUnit.overallPoints} pts • MARKS: {selectedUnit.overallMarks}
                </span>
              </div>
              <button onClick={() => setSelectedUnit(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              
              {/* Category-wise Breakdown Lists */}
              <div>
                <h4 className="font-display font-bold text-slate-700 text-xs mb-2 uppercase tracking-wider font-mono">Category Contributions</h4>
                <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {selectedUnit.categoryBreakdown.map((item: any) => (
                    <li key={item.categoryId} className="bg-slate-50 border p-2.5 rounded-xl flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-800 block">{item.categoryName}</span>
                        <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">{item.count} registered candidates</span>
                      </div>
                      <div className="text-right font-mono font-bold text-slate-700">
                        <span className="block text-emerald-700">{item.points} pts</span>
                        <span className="text-[10px] text-slate-400">{item.marks} marks</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

            <button
              onClick={() => setSelectedUnit(null)}
              className="mt-4 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Close Breakdown
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
