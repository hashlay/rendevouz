import React, { useState, useEffect } from 'react';
import { FileBadge, Search, Filter, RefreshCw, Eye, EyeOff, Download, Share2, Trophy, Check, Loader2 } from 'lucide-react';
import { UserRole, Category, Unit, Participant, Competition, Result, Team } from '../types';
import CertificateGenerator from './CertificateGenerator';
import { renderCertificateToBlob, preloadCertificateImages } from '../utils/certificateRenderer';

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

  const filteredCategories = categories.filter(cat =>
    !selectedCategoryId || cat.id === selectedCategoryId
  );

  // Bulk action states
  const [downloadingCompId, setDownloadingCompId] = useState<string | null>(null);
  const [sharingCompId, setSharingCompId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const ts = Date.now();
      const headers = { 'Authorization': `Bearer ${token}` };
      const [resRes, catRes, compRes, partRes, teamRes, unitRes] = await Promise.all([
        fetch(`/api/results?t=${ts}`, { headers }),
        fetch(`/api/categories?t=${ts}`, { headers }),
        fetch(`/api/competitions?t=${ts}`, { headers }),
        fetch(`/api/participants?t=${ts}`, { headers }),
        fetch(`/api/teams?t=${ts}`, { headers }),
        fetch(`/api/units?t=${ts}`, { headers })
      ]);

      if (resRes.ok) {
        const data = await resRes.json();
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
    preloadCertificateImages(eventSettings);
    fetchData();
  }, [token]);

  // Extract certificate targets for a competition
  const getCompCertificateTargets = (comp: Competition, compResults: Result[]) => {
    const targets: { participantName: string; competitionName: string; competitionId: string; rank: number; unitName: string }[] = [];
    
    compResults.forEach(res => {
      const rank = res.rank || 0;
      if (rank < 1 || rank > 3) return;

      if (res.participantId) {
        const p = participants.find(part => part.id === res.participantId);
        const u = p ? units.find(unit => unit.id === p.unitId) : null;
        targets.push({
          participantName: p ? p.fullName : 'Participant',
          competitionName: comp.name,
          competitionId: comp.id,
          rank,
          unitName: u ? u.name : ''
        });
      } else if (res.teamId) {
        const t = teams.find(team => team.id === res.teamId);
        const u = t ? units.find(unit => unit.id === t.unitId) : null;
        const teamName = t?.teamName || 'Group Team';
        if (t?.memberIds && t.memberIds.length > 0) {
          const memberNames = t.memberIds.map(mid => participants.find(p => p.id === mid)?.fullName).filter(Boolean) as string[];
          if (memberNames.length > 0) {
            memberNames.forEach(mName => {
              targets.push({
                participantName: mName,
                competitionName: comp.name,
                competitionId: comp.id,
                rank,
                unitName: u ? u.name : ''
              });
            });
          } else {
            targets.push({
              participantName: teamName,
              competitionName: comp.name,
              competitionId: comp.id,
              rank,
              unitName: u ? u.name : ''
            });
          }
        } else {
          targets.push({
            participantName: teamName,
            competitionName: comp.name,
            competitionId: comp.id,
            rank,
            unitName: u ? u.name : ''
          });
        }
      }
    });

    return targets;
  };

  const handleDownloadAll = async (comp: Competition, compResults: Result[]) => {
    const targets = getCompCertificateTargets(comp, compResults);
    if (targets.length === 0) {
      alert('No certificates available to download for this competition.');
      return;
    }

    setDownloadingCompId(comp.id);
    setToastMessage(`Generating and downloading ${targets.length} certificate(s)...`);

    try {
      for (let i = 0; i < targets.length; i++) {
        const target = targets[i];
        const { blob, fileName } = await renderCertificateToBlob({
          participantName: target.participantName,
          competitionName: target.competitionName,
          competitionId: target.competitionId,
          rank: target.rank,
          eventSettings
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Stagger downloads by 350ms so browser accepts them as separate files without dropping
        await new Promise(r => setTimeout(r, 350));
        URL.revokeObjectURL(url);
      }
      setToastMessage(`Downloaded ${targets.length} certificate(s) separately!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('Error downloading certificates:', err);
      alert('Failed to download certificates: ' + err.message);
    } finally {
      setDownloadingCompId(null);
    }
  };

  const handleShareAll = async (comp: Competition, compResults: Result[]) => {
    const targets = getCompCertificateTargets(comp, compResults);
    if (targets.length === 0) {
      alert('No certificates available to share for this competition.');
      return;
    }

    setSharingCompId(comp.id);
    setToastMessage(`Preparing ${targets.length} certificate image(s)...`);

    try {
      const files: File[] = [];
      for (const target of targets) {
        const { blob, fileName } = await renderCertificateToBlob({
          participantName: target.participantName,
          competitionName: target.competitionName,
          competitionId: target.competitionId,
          rank: target.rank,
          eventSettings
        });
        files.push(new File([blob], fileName, { type: 'image/jpeg' }));
      }

      const festivalTitle = (eventSettings?.festivalName || 'TABASSUM MEELAD FEST 2K26').toUpperCase();
      const compIdx = competitions.findIndex(c => c.id === comp.id) + 1;
      const formattedNum = compIdx > 0 ? String(compIdx).padStart(2, '0') : '01';
      const slogan = eventSettings?.festivalTagline || eventSettings?.slogan || 'A Smile That Brings Hearts Together...';
      const campus = eventSettings?.campusName || eventSettings?.sectorName || 'Noorul Islam Madrasa, Jeppu';
      const hashtags = eventSettings?.shareHashtags || '#Tabassum2K26 #MeeladFest #Results #NoorulIslamMadrasa #Jeppu #Congratulations';

      const catName = categories.find(c => c.id === comp.categoryId)?.name || '';

      const rank1Targets = targets.filter(t => t.rank === 1);
      const rank2Targets = targets.filter(t => t.rank === 2);
      const rank3Targets = targets.filter(t => t.rank === 3);

      const formatCertRankLine = (emoji: string, rankStr: string, list: typeof targets) => {
        if (list.length === 0) return '';
        return list
          .map(t => {
            const rawUnit = (t.unitName || '').trim();
            const cleanUnit = rawUnit.replace(/^team\s*[:\-]?\s*/i, '').trim();
            const teamLabel = cleanUnit ? `    Team ${cleanUnit}` : '';
            return `${emoji} ${rankStr} — ${t.participantName}${teamLabel}`;
          })
          .join('\n');
      };

      const winnersSummary = [
        formatCertRankLine('🥇', '1st', rank1Targets),
        formatCertRankLine('🥈', '2nd', rank2Targets),
        formatCertRankLine('🥉', '3rd', rank3Targets)
      ].filter(Boolean).join('\n');

      const shareTitle = `🏆 ${festivalTitle} — RESULT ${formattedNum}`;
      const shareText = `🏆 ${festivalTitle} — RESULT ${formattedNum}
✨ ${slogan}

${comp.name}
${catName}

${winnersSummary}

🌿 Congratulations to all the winners and participants!
May your talents continue to shine. ✨
${campus}
${hashtags}`;

      if (navigator.canShare && navigator.canShare({ files })) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: files
        });
        setToastMessage(`All ${targets.length} certificates shared successfully!`);
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        // Fallback for browsers/desktops without native file share
        for (const file of files) {
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          await new Promise(r => setTimeout(r, 350));
          URL.revokeObjectURL(url);
        }
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareText);
        }
        setToastMessage(`Downloaded ${targets.length} separate certificate images & copied winner announcement text! (Direct app share is active on mobile)`);
        setTimeout(() => setToastMessage(null), 6000);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error sharing certificates:', err);
        alert('Could not share certificates: ' + err.message);
      }
    } finally {
      setSharingCompId(null);
    }
  };

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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                              <Trophy className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800 text-sm leading-tight">{comp.name}</h3>
                              <p className="text-[11px] text-slate-400 font-medium">
                                {compResults.length} announced position(s) • Rank 1, 2 & 3
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button 
                              onClick={() => handleDownloadAll(comp, compResults)}
                              disabled={downloadingCompId === comp.id || sharingCompId === comp.id}
                              className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                              title="Download all certificates for this competition as separate images"
                            >
                              {downloadingCompId === comp.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              ) : (
                                <Download className="w-3.5 h-3.5 text-emerald-600" />
                              )}
                              <span>{downloadingCompId === comp.id ? 'Downloading...' : 'Download All (Separate)'}</span>
                            </button>

                            <button 
                              onClick={() => handleShareAll(comp, compResults)}
                              disabled={downloadingCompId === comp.id || sharingCompId === comp.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                              title="Share all certificates together to WhatsApp / other apps without ZIP"
                            >
                              {sharingCompId === comp.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Share2 className="w-3.5 h-3.5" />
                              )}
                              <span>{sharingCompId === comp.id ? 'Preparing...' : 'Share All (No ZIP)'}</span>
                            </button>
                          </div>
                        </div>
                        
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

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold border border-slate-700/80 max-w-md animate-bounce-short">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1 leading-relaxed">{toastMessage}</span>
        </div>
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
