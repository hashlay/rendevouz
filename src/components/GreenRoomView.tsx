import React, { useState, useEffect } from 'react';
import {
  Theater, RefreshCw, Printer, Search, ChevronDown,
  CheckCircle, Clock, AlertTriangle, Plus, Shuffle, Eye
} from 'lucide-react';
import { User, UserRole, GreenRoomStatus } from '../types';

interface GreenRoomViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  assigned: 'bg-blue-100 text-blue-700',
  printed: 'bg-amber-100 text-amber-700',
  checked_in: 'bg-emerald-100 text-emerald-700',
  stage_ready: 'bg-purple-100 text-purple-700'
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  printed: 'Printed',
  checked_in: 'Checked In',
  stage_ready: 'Stage Ready'
};

export default function GreenRoomView({ user, token, eventSettings }: GreenRoomViewProps) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Workflow state
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
  const [competitionAssignments, setCompetitionAssignments] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'dashboard' | 'generate' | 'view'>('dashboard');
  const [printMode, setPrintMode] = useState(false);

  const fetchData = async () => {
    try {
      const ts = Date.now();
      const [assignRes, statsRes, catRes, compRes] = await Promise.all([
        fetch(`/api/green-room?t=${ts}`, { credentials: 'include' }),
        fetch(`/api/green-room/stats?t=${ts}`, { credentials: 'include' }),
        fetch(`/api/categories?t=${ts}`, { credentials: 'include' }),
        fetch(`/api/competitions?t=${ts}`, { credentials: 'include' })
      ]);
      if (assignRes.ok) setAssignments(await assignRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (compRes.ok) setCompetitions(await compRes.json());
    } catch (e) {
      console.error('Error fetching green room data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredCompetitions = selectedCategoryId
    ? competitions.filter((c: any) => c.categoryId === selectedCategoryId && c.active)
    : [];

  const handleQuickGenerate = async (compId: string) => {
    if (!confirm('Generate codes for this competition?')) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/green-room/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ competitionId: compId })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Codes generated successfully!' });
        if (selectedCompetitionId === compId && Array.isArray(data.assignments)) {
          setCompetitionAssignments(data.assignments);
        }
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to generate codes' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to generate codes' });
    }
    setGenerating(false);
  };

  const handleQuickRegenerate = async (compId: string) => {
    if (!confirm('Are you sure you want to regenerate codes? This will replace all existing codes for this competition.')) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/green-room/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ competitionId: compId })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Codes regenerated successfully!' });
        if (selectedCompetitionId === compId && Array.isArray(data.assignments)) {
          setCompetitionAssignments(data.assignments);
        }
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to regenerate codes' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to regenerate codes' });
    }
    setGenerating(false);
  };

  const handleGenerate = async () => {
    if (!selectedCompetitionId) return;
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/green-room/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId: selectedCompetitionId })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        if (Array.isArray(data.assignments) && data.assignments.length > 0) {
          setCompetitionAssignments(data.assignments);
        } else {
          await loadCompetitionAssignments(selectedCompetitionId);
        }
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to generate codes' });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!selectedCompetitionId) return;
    if (!confirm('Are you sure you want to regenerate codes? This will replace all existing codes for this competition.')) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/green-room/regenerate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId: selectedCompetitionId, confirmed: true })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        if (Array.isArray(data.assignments) && data.assignments.length > 0) {
          setCompetitionAssignments(data.assignments);
        } else {
          await loadCompetitionAssignments(selectedCompetitionId);
        }
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to regenerate codes' });
    } finally {
      setGenerating(false);
    }
  };

  const loadCompetitionAssignments = async (compId: string) => {
    try {
      const res = await fetch(`/api/green-room/competition/${compId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCompetitionAssignments(data);
      }
    } catch (e) { console.error(e); }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (!selectedCompetitionId) return;
    try {
      const res = await fetch(`/api/green-room/competition/${selectedCompetitionId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        loadCompetitionAssignments(selectedCompetitionId);
        fetchData();
      }
    } catch (e) { setMessage({ type: 'error', text: 'Failed to update status' }); }
  };

  useEffect(() => {
    if (selectedCompetitionId) {
      loadCompetitionAssignments(selectedCompetitionId);
    }
  }, [selectedCompetitionId]);

  const selectedComp = competitions.find((c: any) => c.id === selectedCompetitionId);
  const selectedCat = categories.find((c: any) => c.id === selectedCategoryId);

  // Check which competitions already have assignments
  const assignedCompIds = new Set(assignments.map((a: any) => a.competitionId));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" /></div>;
  }

  // Print mode: Green Room Sheet
  if (printMode && selectedComp && competitionAssignments.length > 0) {
    return (
      <div className="print-sheet bg-white p-8 max-w-[210mm] mx-auto text-black" id="green-room-print">
        {/* Print Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-3">
            <img
              src={eventSettings?.sahityotsavLogoUrl || '/logos/sahityotsav-logo.png'}
              alt="Sahityotsav"
              className="h-12 max-h-12 w-auto object-contain"
              style={{ height: '48px', maxHeight: '48px', maxWidth: '160px', width: 'auto', objectFit: 'contain' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <h1 className="text-2xl font-normal text-slate-800">{eventSettings?.festivalName || 'Festival'}</h1>
          <h2 className="text-lg font-normal text-slate-600 mt-1">Green Room Sheet</h2>
        </div>

        {/* Details Row */}
        <div className="flex justify-between items-start mb-6 text-[15px]">
          <div className="flex-1 font-bold">Category: {selectedCat?.name || ''}</div>
          <div className="flex-1 text-center font-bold px-2 whitespace-pre-wrap">Program: {selectedComp.name}</div>
          <div className="flex-1 text-right font-bold">Individual: {selectedComp.participationType === 'individual' ? 'Yes' : 'No'}</div>
        </div>

        {/* Table */}
        <table className="w-full text-[15px] border-collapse border border-black">
          <thead>
            <tr>
              <th className="border border-black px-4 py-3 text-left font-bold w-28">Code Letter</th>
              <th className="border border-black px-4 py-3 text-left font-bold w-24">Chest #</th>
              <th className="border border-black px-4 py-3 text-left font-bold">Name</th>
              <th className="border border-black px-4 py-3 text-left font-bold w-40">Team</th>
              <th className="border border-black px-4 py-3 text-left font-bold w-24">Sign</th>
            </tr>
          </thead>
          <tbody>
            {competitionAssignments
              .sort((a: any, b: any) => a.codeLetter.localeCompare(b.codeLetter))
              .map((a: any) => (
                <tr key={a.id}>
                  <td className="border border-black px-4 py-4">{a.codeLetter}</td>
                  <td className="border border-black px-4 py-4">{a.chestNumber || ''}</td>
                  <td className="border border-black px-4 py-4">{a.participantName}</td>
                  <td className="border border-black px-4 py-4">{a.unitName}</td>
                  <td className="border border-black px-4 py-4"></td>
                </tr>
              ))
            }
          </tbody>
        </table>

        {/* Footer Status */}
        <div className="flex justify-between items-start mt-6 text-[13px] font-bold">
          <div>Result Entered: Yes / No</div>
          <div>Result Announced: Yes / No</div>
          <div>Prize Distributed: Yes / No</div>
        </div>

        <div className="mt-16 text-[11px] text-black flex justify-between">
          <div>Copyright © 2026-2027 {eventSettings?.campusName || eventSettings?.sectorName || 'Campus'}. All rights reserved. Developed by Zenith Software.</div>
          <div></div>
        </div>

        <div className="mt-6 print:hidden no-print">
          <button onClick={() => setPrintMode(false)} className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm mr-2">← Back</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">🖨 Print Sheet</button>
        </div>
      </div>
    );
  }

  const canGenerate = user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SECTOR_TEAM || user.role === UserRole.GREEN_ROOM_MANAGER;

  return (
    <div className="space-y-6 min-w-0 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Theater className="h-7 w-7 text-purple-500" />
            Green Room
          </h1>
          <p className="text-sm text-slate-500 mt-1">Generate anonymous code letters before judging</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewMode('dashboard')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'dashboard' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Dashboard</button>
          <button onClick={() => setViewMode('generate')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'generate' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Generate / View</button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {viewMode === 'dashboard' && (
        <>
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg"><Theater className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stats.totalCompetitions}</p>
                    <p className="text-xs text-slate-500">Total Competitions</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stats.assigned}</p>
                    <p className="text-xs text-slate-500">Assigned</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
                    <p className="text-xs text-slate-500">Pending</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg"><Printer className="h-5 w-5 text-purple-600" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stats.printed}</p>
                    <p className="text-xs text-slate-500">Printed</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Competitions List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">Competitions Overview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Competition</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Category</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Type</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Status</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {competitions.filter((c: any) => c.active).map((comp: any) => {
                    const cat = categories.find((c: any) => c.id === comp.categoryId);
                    const hasAssignment = assignedCompIds.has(comp.id);
                    const assignmentCount = assignments.filter((a: any) => a.competitionId === comp.id).length;
                    return (
                      <tr key={comp.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-4 py-2.5 font-medium text-slate-800">{comp.name}</td>
                        <td className="px-4 py-2.5 text-slate-600">{cat?.name || ''}</td>
                        <td className="px-4 py-2.5"><span className="text-xs px-2 py-0.5 rounded-full bg-slate-100">{comp.participationType}</span></td>
                        <td className="px-4 py-2.5">
                          {hasAssignment ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{assignmentCount} Codes</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Not Generated</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => { setSelectedCategoryId(comp.categoryId); setSelectedCompetitionId(comp.id); setViewMode('generate'); }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              {hasAssignment ? 'View' : 'Configure'} →
                            </button>
                            {canGenerate && (
                              hasAssignment ? (
                                <button
                                  onClick={() => handleQuickRegenerate(comp.id)}
                                  disabled={generating}
                                  className="text-xs text-amber-600 hover:text-amber-700 font-medium disabled:opacity-50"
                                >
                                  Regenerate
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleQuickGenerate(comp.id)}
                                  disabled={generating}
                                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                                >
                                  Generate
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {viewMode === 'generate' && (
        <>
          {/* Category & Competition Selectors */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Select Competition</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={e => { setSelectedCategoryId(e.target.value); setSelectedCompetitionId(''); }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Competition</label>
                <select
                  value={selectedCompetitionId}
                  onChange={e => setSelectedCompetitionId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                  disabled={!selectedCategoryId}
                >
                  <option value="">Select Competition</option>
                  {filteredCompetitions.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {assignedCompIds.has(c.id) ? '✓' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedCompetitionId && canGenerate && (
              <div className="mt-4 flex gap-2 flex-wrap">
                {!assignedCompIds.has(selectedCompetitionId) ? (
                  <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                    {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shuffle className="h-4 w-4" />}
                    Generate Random Codes
                  </button>
                ) : (
                  <>
                    {user.role === UserRole.SUPER_ADMIN && (
                      <button onClick={handleRegenerate} disabled={generating} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50">
                        <Shuffle className="h-4 w-4" /> Regenerate
                      </button>
                    )}
                    <button onClick={() => handleBulkStatusUpdate('printed')} className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700">
                      <Printer className="h-4 w-4" /> Mark All Printed
                    </button>
                    <button onClick={() => setPrintMode(true)} className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg text-sm font-semibold hover:bg-slate-700">
                      <Printer className="h-4 w-4" /> Print Green Room Sheet
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Assignments Table */}
          {competitionAssignments.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-700">
                  Assignments for {selectedComp?.name || 'Competition'}
                </h3>
                <span className="text-xs text-slate-500">{competitionAssignments.length} entries</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-2 font-semibold text-slate-600 w-24">Code Letter</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-600 w-24">Chest #</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-600">Participant</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-600">Unit</th>
                      <th className="text-left px-4 py-2 font-semibold text-slate-600 w-28">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competitionAssignments
                      .sort((a: any, b: any) => a.codeLetter.localeCompare(b.codeLetter))
                      .map((a: any) => (
                        <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-2.5">
                            <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded">{a.codeLetter}</span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-emerald-700">{a.chestNumber || '—'}</td>
                          <td className="px-4 py-2.5 font-medium text-slate-800">{a.participantName}</td>
                          <td className="px-4 py-2.5 text-slate-600">{a.unitName}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || 'bg-slate-100'}`}>
                              {STATUS_LABELS[a.status] || a.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
