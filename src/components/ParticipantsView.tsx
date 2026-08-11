import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, Trash2, Edit3, Eye, FileSpreadsheet, 
  RefreshCw, CheckCircle, Award, Compass, Sparkles, X, ChevronRight, ListCollapse, Hash, Printer 
} from 'lucide-react';
import { User, UserRole, Category, Unit, Participant, Competition, EducationStatus } from '../types';

interface ParticipantsViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

export default function ParticipantsView({ user, token, eventSettings }: ParticipantsViewProps) {
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';
  const entityLabelPlural = eventSettings?.entityMode === 'house' ? 'Houses' : eventSettings?.entityMode === 'team' ? 'Teams' : 'Units';
  // Master lists
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState(user.role === UserRole.UNIT_TEAM_LEADER ? (user.assignedUnitId || '') : '');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedEdStatus, setSelectedEdStatus] = useState('');

  // Selected participant details drawer/modal
  const [selectedPart, setSelectedPart] = useState<Participant | null>(null);
  const [partProfile, setPartProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Edit State
  const [editingPart, setEditingPart] = useState<Participant | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGPhone, setEditGPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editComps, setEditComps] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Deletion confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletionReason, setDeletionReason] = useState('');

  // Bulk Import State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [importingBulk, setImportingBulk] = useState(false);

  const handleBulkImport = async () => {
    if (!bulkText.trim()) return;
    setImportingBulk(true);

    try {
      // Parse CSV lines: Name, Category, Unit/House, DOB, Gender
      const lines = bulkText.trim().split('\n');
      const participantsToImport = lines.map(line => {
        const parts = line.split(',').map(s => s.trim());
        return {
          fullName: parts[0] || '',
          categoryName: parts[1] || '',
          unitName: parts[2] || '',
          dob: parts[3] || '2010-01-01',
          gender: parts[4] || 'male'
        };
      }).filter(p => p.fullName.length > 0);

      const res = await fetch('/api/participants/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ participants: participantsToImport })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk import failed');

      alert(data.message || `Successfully imported ${data.imported} participants!`);
      setShowBulkModal(false);
      setBulkText('');
      fetchLists();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImportingBulk(false);
    }
  };

  const fetchLists = async () => {
    setLoading(true);
    try {
      const [pRes, cRes, uRes, compRes] = await Promise.all([
        fetch(`/api/participants?unitId=${selectedUnitId}&categoryId=${selectedCategoryId}&search=${search}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/categories'),
        fetch('/api/units'),
        fetch('/api/competitions')
      ]);

      if (!pRes.ok) {
        const errorData = await pRes.json();
        throw new Error(errorData.error || 'Failed to fetch participants');
      }

      const [pData, cData, uData, compData] = await Promise.all([pRes.json(), cRes.json(), uRes.json(), compRes.json()]);

      setParticipants(pData);
      setCategories(cData);
      setUnits(uData);
      setCompetitions(compData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [selectedUnitId, selectedCategoryId, search, selectedEdStatus]);

  // Fetch complete profile details (results, rankings, registered events)
  const viewProfile = async (p: Participant) => {
    setSelectedPart(p);
    setPartProfile(null);
    setProfileLoading(true);

    try {
      const [sbRes, resRes, teamsRes, regRes] = await Promise.all([
        fetch(`/api/scoreboard?categoryId=${p.selectedCategoryId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/results', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/teams', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/registrations', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [sbData, resultsData, teamsData, regsData] = await Promise.all([
        sbRes.json(), resRes.json(), teamsRes.json(), regRes.json()
      ]);

      const profile = sbData.find((entry: any) => entry.participantId === p.id);
      const participantResults = resultsData.filter((r: any) => r.participantId === p.id);
      const joinedTeams = teamsData.filter((t: any) => t.memberIds && t.memberIds.includes(p.id));

      const userReg = regsData.find((r: any) => r.participantId === p.id);
      const indCompIds: string[] = userReg?.selectedIndividualCompetitionIds || [];

      // Calculate total registered events count (Individual + Group Teams)
      const eventsCount = indCompIds.length + joinedTeams.length;

      // Build complete breakdown list for both Individual & Group competitions
      const breakdowns: any[] = [];

      indCompIds.forEach(cId => {
        const comp = competitions.find(c => c.id === cId);
        const res = resultsData.find((r: any) => r.competitionId === cId && r.participantId === p.id && r.publishedStatus && !r.deletedAt);
        breakdowns.push({
          id: `ind_${cId}`,
          compName: comp ? comp.name : 'Individual Competition',
          type: 'Individual Event',
          stageType: comp ? comp.stageType : 'on_stage',
          result: res
        });
      });

      joinedTeams.forEach(t => {
        const comp = competitions.find(c => c.id === t.competitionId);
        const res = resultsData.find((r: any) => r.competitionId === t.competitionId && r.teamId === t.id && r.publishedStatus && !r.deletedAt);
        breakdowns.push({
          id: `grp_${t.id}`,
          compName: comp ? comp.name : (t.teamName || 'Group Event'),
          type: 'Group Event',
          stageType: comp ? comp.stageType : 'on_stage',
          result: res
        });
      });

      setPartProfile({
        scoreboard: profile || { totalEvents: 0, overallMarks: 0, individualMarks: 0, groupMarks: 0, rank: 'N/A', placements: [] },
        results: participantResults,
        teams: joinedTeams,
        eventsCount,
        breakdowns
      });
    } catch (e) {
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  };

  // Open Edit Dialog
  const openEdit = async (p: Participant) => {
    setEditingPart(p);
    setEditName(p.fullName);
    setEditPhone(p.phone || '');
    setEditGPhone(p.guardianPhone || '');
    setEditAddress(p.address || '');
    setEditNotes(p.notes || '');

    // Fetch registered individual competitions
    try {
      const regRes = await fetch('/api/registrations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const regs = await regRes.json();
      const userReg = regs.find((r: any) => r.participantId === p.id);
      if (userReg) {
        setEditComps(userReg.selectedIndividualCompetitionIds || []);
      } else {
        setEditComps([]);
      }
    } catch (e) {
      console.error(e);
      setEditComps([]);
    }
  };

  // Edit Chest Number
  const handleEditChestNo = async (p: Participant) => {
    const newChest = prompt(`Enter new chest number for ${p.fullName}:`, p.profilePhoto);
    if (newChest === null || newChest.trim() === '') return;
    if (newChest === p.profilePhoto) return;

    try {
      const res = await fetch(`/api/participants/${p.id}/chest`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ chestNumber: newChest.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update chest number');
      
      // Update local list
      setParticipants(participants.map(part => part.id === p.id ? data.participant : part));
      alert(data.message);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Save Participant Changes
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPart) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/participants/${editingPart.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: editName,
          phone: editPhone,
          guardianPhone: editGPhone,
          address: editAddress,
          notes: editNotes,
          selectedCompetitionIds: editComps
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update participant');

      setEditingPart(null);
      fetchLists();
      alert('Participant updated successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Handle Soft Delete
  const handleSoftDelete = async () => {
    if (!deletingId) return;

    try {
      const res = await fetch(`/api/participants/${deletingId}/delete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: deletionReason })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete participant');

      setDeletingId(null);
      setDeletionReason('');
      fetchLists();
      alert('Participant record soft-deleted successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* Search and Filters Layout */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center no-print">
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4.5 w-4.5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search by candidate name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center justify-end">
          {/* Unit selection filter */}
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

          {/* Category selection filter */}
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-slate-700 focus:outline-none text-xs font-semibold bg-slate-50"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          
          <button 
            onClick={() => setShowBulkModal(true)} 
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Bulk Import CSV/Excel
          </button>

          <button 
            onClick={() => window.print()} 
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold shadow-sm transition-all border border-slate-200 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print List
          </button>
        </div>
      </div>

      {/* Bulk Import Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Bulk Import Participants (CSV / Excel)</span>
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl text-xs space-y-1 border border-emerald-200">
              <p className="font-bold">Format: One participant per line (CSV format):</p>
              <p className="font-mono text-[11px]">Full Name, Category, Unit/House, Date of Birth (YYYY-MM-DD), Gender (Male/Female)</p>
              <p className="text-[10px] text-emerald-700 mt-1">Example: Muhammad Raihan, Junior, Red House, 2008-04-15, Male</p>
            </div>

            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Paste CSV lines here..."
              className="w-full p-3 border border-slate-300 rounded-2xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                Cancel
              </button>
              <button
                onClick={handleBulkImport}
                disabled={importingBulk || !bulkText.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                {importingBulk ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Import Participants Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participants List */}
      <div>
        {/* Mobile-Friendly Grid List: compact, touch-optimized cards, hidden on medium screens and up */}
        <div className="block md:hidden space-y-3 print:hidden">
          {participants.length > 0 ? (
            participants.map((p) => {
              const unit = units.find(u => u.id === p.unitId);
              const cat = categories.find(c => c.id === p.selectedCategoryId);
              return (
                <div key={p.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border">
                          {p.profilePhoto}
                        </span>
                        <h4 className="font-semibold text-slate-900 text-sm">{p.fullName}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {p.educationStatus.replace('_', ' ')}
                      </p>
                    </div>
                    <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold px-2.5 py-0.5 rounded-lg">
                      {cat ? cat.name : 'Unknown'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 text-xs">
                    <div className="text-slate-500">
                      {entityLabel}: <span className="font-semibold text-slate-700">{unit ? unit.name : 'Unknown'}</span>
                    </div>
                    <div className="text-slate-400 font-mono text-[11px]">
                      DOB: {p.dob}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2.5 border-t border-slate-100 justify-end">
                    <button 
                      onClick={() => viewProfile(p)}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 flex items-center justify-center gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Profile</span>
                    </button>
                    <button 
                      onClick={() => openEdit(p)}
                      className="py-2 px-3 rounded-xl text-slate-500 hover:text-amber-600 bg-slate-50 hover:bg-amber-50/50 border border-slate-200/50 flex items-center justify-center"
                      title="Edit Record"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>

                    {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SECTOR_TEAM) && (
                      <button 
                        onClick={() => handleEditChestNo(p)}
                        className="py-2 px-3 rounded-xl text-slate-500 hover:text-amber-600 bg-slate-50 hover:bg-amber-50/50 border border-slate-200/50 flex items-center justify-center"
                        title="Edit Chest No"
                      >
                        <Hash className="h-4 w-4" />
                      </button>
                    )}

                    <button 
                      onClick={() => setDeletingId(p.id)}
                      className="py-2 px-3 rounded-xl text-slate-500 hover:text-rose-600 bg-slate-50 hover:bg-rose-50/50 border border-slate-200/50 flex items-center justify-center"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white p-8 text-center text-slate-400 font-mono text-xs border rounded-2xl">
              No participants registered under selected filters
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block print:block print-sheet bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden print:shadow-none print:border-none print:overflow-visible">
          
          <div className="hidden print:flex items-center justify-between pb-6 border-b border-dashed border-slate-300 mb-8">
            <div className="flex-shrink-0 w-32 flex justify-start">
              {eventSettings?.logoUrl && (
                <img src={eventSettings.logoUrl} alt="Festival Logo" className="max-h-24 object-contain" />
              )}
            </div>
            <div className="flex flex-col items-center text-center flex-1">
              <span className="font-display font-extrabold text-2xl tracking-wider text-slate-900 uppercase">{eventSettings?.festivalName?.toUpperCase() || 'FESTIVAL'} 2026</span>
              <span className="font-mono text-xs font-semibold text-emerald-700 tracking-widest uppercase mt-1">{eventSettings?.campusName?.toUpperCase() || 'CAMPUS'} COMMITTEE</span>
              <h1 className="text-xl font-bold text-center mt-4 uppercase">
                Candidates Registry
              </h1>
            </div>
            <div className="flex-shrink-0 w-32"></div>
          </div>

          <div className="overflow-x-auto print:overflow-visible">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Chest No</th>
                  <th className="px-6 py-4 text-left">Candidate</th>
                  <th className="px-6 py-4 text-left">{entityLabel}</th>
                  <th className="px-6 py-4 text-left">Category</th>
                  <th className="px-6 py-4 text-left">DOB</th>
                  <th className="px-6 py-4 text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-sm">
                {participants.length > 0 ? (
                  participants.map((p) => {
                    const unit = units.find(u => u.id === p.unitId);
                    const cat = categories.find(c => c.id === p.selectedCategoryId);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-slate-500 whitespace-nowrap">{p.profilePhoto}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900">{p.fullName}</div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{p.educationStatus.replace('_', ' ')}</span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">{unit ? unit.name : 'Unknown'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold px-2.5 py-1 rounded-xl">
                            {cat ? cat.name : 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-500 whitespace-nowrap">{p.dob}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center print:hidden">
                          <div className="flex items-center justify-center gap-1.5">
                            <button 
                              onClick={() => viewProfile(p)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-slate-50 border border-slate-200/50"
                              title="View Profile"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            
                            <button 
                              onClick={() => openEdit(p)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-50 border border-slate-200/50"
                              title="Edit Record"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SECTOR_TEAM) && (
                              <button 
                                onClick={() => handleEditChestNo(p)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-50 border border-slate-200/50"
                                title="Edit Chest No"
                              >
                                <Hash className="h-4 w-4" />
                              </button>
                            )}

                            <button 
                              onClick={() => setDeletingId(p.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-50 border border-slate-200/50"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-mono text-xs">
                      No participants registered under selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- PROFILE DETAILS DRAWER MODAL --- */}
      {selectedPart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end no-print">
          <div className="bg-white w-full max-w-lg h-full p-6 overflow-y-auto shadow-2xl flex flex-col justify-between animate-slide-in">
            <div className="space-y-6">
              
              {/* Profile Header */}
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-lg font-display uppercase shadow-inner">
                    {selectedPart.fullName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-display font-extrabold text-slate-800 text-lg leading-tight">{selectedPart.fullName}</h3>
                    <span className="text-xs font-mono font-bold text-slate-400">{selectedPart.profilePhoto} • {units.find(u => u.id === selectedPart.unitId)?.name}</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPart(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-slate-200/50"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {profileLoading ? (
                <div className="p-12 text-center text-xs font-mono text-slate-400 animate-pulse">Loading scoreboard breakdown...</div>
              ) : (
                <div className="space-y-6 text-sm font-sans">
                  
                  {/* Accumulated Statistics Spot */}
                  <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
                    <div className="text-center">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Rank Spot</span>
                      <span className="text-base font-extrabold text-emerald-700 mt-1 block">
                        {partProfile?.scoreboard?.overallMarks > 0 && partProfile?.scoreboard?.rank && partProfile.scoreboard.rank !== 'N/A'
                          ? `#${partProfile.scoreboard.rank}`
                          : '—'}
                      </span>
                    </div>
                    <div className="text-center border-x border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Total Score</span>
                      <span className="text-base font-extrabold text-slate-800 mt-1 block">{partProfile?.scoreboard?.overallMarks || 0}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase font-mono">Events count</span>
                      <span className="text-base font-extrabold text-amber-600 mt-1 block">{partProfile?.eventsCount ?? (partProfile?.scoreboard?.totalEvents || 0)}</span>
                    </div>
                  </div>

                  {/* Registered Events Directory */}
                  <div className="space-y-3">
                    <h4 className="font-display font-bold text-slate-800 text-sm">Competition Breakdowns</h4>
                    <ul className="space-y-2 divide-y divide-slate-100">
                      {partProfile?.breakdowns && partProfile.breakdowns.length > 0 ? (
                        partProfile.breakdowns.map((item: any) => (
                          <li key={item.id} className="pt-2.5 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-semibold text-slate-800 block">{item.compName}</span>
                              <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">{item.type} • {(item.stageType || 'on_stage').replace('_', ' ')}</span>
                            </div>
                            <div className="text-right">
                              {item.result ? (
                                <>
                                  <span className="font-bold text-emerald-600 block">{item.result.averageMark || 0} marks</span>
                                  <span className="text-[9px] font-mono bg-emerald-50 text-emerald-700 border px-1.5 py-0.5 rounded uppercase font-bold">
                                    Rank {item.result.rank || 'TBD'}
                                  </span>
                                </>
                              ) : (
                                <span className="text-[10px] font-mono font-bold text-amber-500 uppercase bg-amber-50/50 px-2 py-1 rounded">Pending</span>
                              )}
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="py-3 text-center text-xs font-mono text-slate-400">No competitions registered for this candidate yet.</li>
                      )}
                    </ul>
                  </div>

                  {/* Personal Metadata info */}
                  <div className="bg-slate-50/50 p-4 rounded-2xl border space-y-3 font-mono text-[11px] font-semibold text-slate-600">
                    <div className="flex justify-between">
                      <span>DATE OF BIRTH:</span>
                      <span className="text-slate-800 font-bold">{selectedPart.dob}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>EDUCATION STATUS:</span>
                      <span className="text-slate-800 font-bold capitalize">{selectedPart.educationStatus.replace('_', ' ')}</span>
                    </div>
                    {selectedPart.phone && (
                      <div className="flex justify-between">
                        <span>PHONE:</span>
                        <span className="text-slate-800 font-bold">{selectedPart.phone}</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
            
            <button 
              onClick={() => setSelectedPart(null)}
              className="mt-6 w-full py-2.5 text-center text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border rounded-xl"
            >
              Close Profile
            </button>
          </div>
        </div>
      )}

      {/* --- EDIT RECORD POPUP --- */}
      {editingPart && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-scale-up space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-display font-bold text-slate-800 text-base">Edit Candidate Records</h3>
              <button onClick={() => setEditingPart(null)} className="p-1 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="space-y-4 font-sans text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Phone</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Address</label>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5">Registered Competitions (Individual)</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                  {competitions
                    .filter(c => c.categoryId === editingPart.selectedCategoryId && c.participationType === 'individual')
                    .map(comp => {
                      const isChecked = editComps.includes(comp.id);
                      return (
                        <label key={comp.id} className="flex items-center gap-2.5 cursor-pointer select-none text-slate-700 hover:text-slate-900">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setEditComps(editComps.filter(id => id !== comp.id));
                              } else {
                                setEditComps([...editComps, comp.id]);
                              }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                          />
                          <span className="font-semibold text-xs">{comp.name}</span>
                        </label>
                      );
                    })}
                  {competitions.filter(c => c.categoryId === editingPart.selectedCategoryId && c.participationType === 'individual').length === 0 && (
                    <span className="text-slate-400 font-mono text-[10px]">No individual competitions available for this category.</span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPart(null)}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700"
                >
                  {savingEdit ? 'Saving...' : 'Save Records'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETION DIALOG --- */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-scale-up space-y-4">
            <h3 className="font-display font-bold text-slate-800 text-base">Confirm Soft Deletion</h3>
            <p className="text-xs text-slate-400">
              The record will be safely soft-deleted and removed from normal directories. You must provide a valid deletion reason.
            </p>
            
            <textarea
              required
              placeholder="E.g. Candidate withdrew or double entry error..."
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              rows={3}
            />

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => { setDeletingId(null); setDeletionReason(''); }}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!deletionReason.trim()}
                onClick={handleSoftDelete}
                className="px-5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
              >
                Soft Delete Candidate
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
