import React, { useState, useEffect } from 'react';
import { FileBadge, Search, Filter, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { UserRole, Category, Unit, Participant, Competition, Result, Team } from '../types';
import CertificateGenerator from './CertificateGenerator';

interface CertificatesViewProps {
  user: any;
  token: string;
  eventSettings?: any;
  onSettingsUpdated?: () => void;
}

export default function CertificatesView({ user, token, eventSettings, onSettingsUpdated }: CertificatesViewProps) {
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';
  const [results, setResults] = useState<Result[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<{names: string[], comp: string, compId: string, rank: number} | null>(null);

  // Filters
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRes, catRes, compRes, partRes, teamRes, unitRes] = await Promise.all([
        fetch('/api/results', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/categories', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/competitions', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/participants', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/teams', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/units', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (resRes.ok) {
        const data = await resRes.json();
        // Only get results that have rank 1 or 2 (or 3 if we add it later)
        setResults(data.filter((r: Result) => r.rank && r.rank <= 3));
      }
      if (catRes.ok) setCategories(await catRes.json());
      if (compRes.ok) setCompetitions(await compRes.json());
      if (partRes.ok) setParticipants(await partRes.json());
      if (teamRes.ok) setTeams(await teamRes.json());
      if (unitRes.ok) setUnits(await unitRes.json());
      
    } catch (error) {
      console.error('Error fetching data for certificates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // Grouping logic
  const filteredCategories = categories.filter(cat => 
    selectedCategoryId ? cat.id === selectedCategoryId : true
  );

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 font-bold text-[10px] rounded uppercase tracking-wider border border-amber-200">1st Place</span>;
      case 2:
        return <span className="px-2 py-1 bg-slate-200 text-slate-700 font-bold text-[10px] rounded uppercase tracking-wider border border-slate-300">2nd Place</span>;
      case 3:
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 font-bold text-[10px] rounded uppercase tracking-wider border border-orange-200">3rd Place</span>;
      default:
        return null;
    }
  };

  const togglePublish = async (resultId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/results/${resultId}/publish-certificate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ published: !currentStatus })
      });
      if (res.ok) {
        setResults(prev => prev.map(r => r.id === resultId ? { ...r, certificatePublished: !currentStatus } : r));
      } else {
        alert('Failed to update status');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans min-w-0 w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Certificate Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">Generate and print certificates for announced results</p>
        </div>
        <button 
          onClick={fetchData}
          className="p-2 hover:bg-slate-50 rounded-full transition-colors group"
          title="Refresh Data"
        >
          <RefreshCw className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search competition or winner name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
          />
        </div>
        <div className="md:w-64 relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <select 
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
          <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin mb-4" />
          <p className="text-slate-500 font-medium text-sm">Loading certificate data...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredCategories.map(category => {
            const catComps = competitions.filter(c => c.categoryId === category.id);
            // Filter comps by search query
            const filteredComps = catComps.filter(c => 
              c.name.toLowerCase().includes(searchQuery.toLowerCase())
            );

            // Filter comps that have announced results (which we filtered by rank earlier)
            const compsWithResults = filteredComps.filter(c => 
              results.some(r => r.competitionId === c.id)
            );

            if (compsWithResults.length === 0) return null;

            return (
              <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                    {category.name}
                  </h2>
                </div>

                <div className="divide-y divide-slate-100">
                  {compsWithResults.map(comp => {
                    const compResults = results
                      .filter(r => r.competitionId === comp.id)
                      .sort((a, b) => (a.rank || 0) - (b.rank || 0));

                    return (
                      <div key={comp.id} className="p-6">
                        <h3 className="font-bold text-slate-700 text-sm mb-4">{comp.name}</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {compResults.map(res => {
                            let certNames: string[] = [];
                            let winnerName = 'Unknown Participant';
                            let winnerUnitName = 'Unknown Unit';

                            if (res.participantId) {
                              const p = participants.find(part => part.id === res.participantId);
                              if (p) {
                                winnerName = p.fullName;
                                certNames = [p.fullName];
                                const u = units.find(unit => unit.id === p.unitId);
                                winnerUnitName = u ? u.name : 'Unknown';
                              }
                            } else if (res.teamId) {
                              const t = teams.find(team => team.id === res.teamId);
                              if (t) {
                                winnerName = t.teamName || 'Group Team';
                                if (t.memberIds && t.memberIds.length > 0) {
                                  const validMemberNames = t.memberIds.map(mid => participants.find(p => p.id === mid)?.fullName).filter(Boolean) as string[];
                                  certNames = validMemberNames.length > 0 ? validMemberNames : [winnerName];
                                  const memberNames = validMemberNames.join(', ');
                                  winnerName = `${winnerName} (${memberNames})`;
                                } else {
                                  certNames = [winnerName];
                                }
                                const u = units.find(unit => unit.id === t.unitId);
                                winnerUnitName = u ? u.name : 'Unknown';
                              }
                            }

                            // Filter by search query if name doesn't match and comp didn't match
                            if (searchQuery && 
                                !comp.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
                                !winnerName.toLowerCase().includes(searchQuery.toLowerCase())) {
                              return null;
                            }

                            return (
                              <div key={res.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    {getRankBadge(res.rank || 0)}
                                  </div>
                                  <p className="font-bold text-slate-800 text-sm line-clamp-2" title={winnerName}>
                                    {winnerName}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-medium mt-1 truncate">
                                    {entityLabel}: {winnerUnitName}
                                  </p>
                                </div>
                                <div className="mt-4 flex gap-2">
                                  <button 
                                    onClick={() => setSelectedCertificate({ names: certNames.length > 0 ? certNames : [winnerName], comp: comp.name, compId: comp.id, rank: res.rank as number })}
                                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-200 rounded-lg text-xs font-bold transition-colors"
                                  >
                                    <FileBadge className="w-4 h-4" />
                                    Generate
                                  </button>
                                  <button 
                                    onClick={() => togglePublish(res.id, !!res.certificatePublished)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 border rounded-lg text-xs font-bold transition-colors ${
                                      res.certificatePublished 
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                                    title={res.certificatePublished ? "Unpublish from participant portal" : "Publish to participant portal"}
                                  >
                                    {res.certificatePublished ? <><Eye className="w-4 h-4" /> Published</> : <><EyeOff className="w-4 h-4" /> Hidden</>}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          
          {compsWithResultsLength(filteredCategories) === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-slate-100">
              <FileBadge className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">No Certificates Available</h3>
              <p className="text-slate-500 text-sm mt-1">Results must be entered and announced first.</p>
            </div>
          )}
        </div>
      )}

      {/* Certificate Generator Modal */}
      {selectedCertificate && (
        <CertificateGenerator
          participantNames={selectedCertificate.names}
          competitionName={selectedCertificate.comp}
          competitionId={selectedCertificate.compId}
          rank={selectedCertificate.rank}
          eventSettings={eventSettings}
          user={user}
          token={token}
          onClose={() => setSelectedCertificate(null)}
          onSettingsUpdated={onSettingsUpdated}
        />
      )}

    </div>
  );

  function compsWithResultsLength(cats: Category[]) {
    let count = 0;
    cats.forEach(cat => {
      const catComps = competitions.filter(c => c.categoryId === cat.id);
      const filteredComps = catComps.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
      const compsWithResults = filteredComps.filter(c => results.some(r => r.competitionId === c.id));
      count += compsWithResults.length;
    });
    return count;
  }
}
