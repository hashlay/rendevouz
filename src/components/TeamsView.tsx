import React, { useState, useEffect } from 'react';
import { 
  Users2, UserPlus, Trash2, Search, Filter, RefreshCw, Check, CheckCircle2, AlertCircle, X, Plus, Edit2 
} from 'lucide-react';
import { User, UserRole, Category, Unit, Competition, Team, Participant, ParticipationType } from '../types';

interface TeamsViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

export default function TeamsView({ user, token, eventSettings }: TeamsViewProps) {
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';
  const entityLabelPlural = eventSettings?.entityMode === 'house' ? 'Houses' : eventSettings?.entityMode === 'team' ? 'Teams' : 'Units';

  const [teams, setTeams] = useState<Team[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedUnitId, setSelectedUnitId] = useState(user.role === UserRole.UNIT_TEAM_LEADER ? (user.assignedUnitId || '') : '');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedCompId, setSelectedCompId] = useState('');

  // Team Creator Wizard
  const [createOpen, setCreateOpen] = useState(false);
  const [wizardUnitId, setWizardUnitId] = useState(user.role === UserRole.UNIT_TEAM_LEADER ? (user.assignedUnitId || '') : '');
  const [wizardCategoryId, setWizardCategoryId] = useState('');
  const [wizardCompId, setWizardCompId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Edit Team Modal
  const [editOpen, setEditOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingMemberIds, setEditingMemberIds] = useState<string[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editSearchQuery, setEditSearchQuery] = useState('');

  const fetchLists = async () => {
    setLoading(true);
    try {
      const [tRes, cRes, uRes, compRes, pRes] = await Promise.all([
        fetch(`/api/teams?unitId=${selectedUnitId}&competitionId=${selectedCompId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/categories'),
        fetch('/api/units'),
        fetch('/api/competitions'),
        fetch('/api/participants', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!tRes.ok) {
        const err = await tRes.json();
        throw new Error(err.error || 'Failed to load teams');
      }

      const [tData, cData, uData, compData, pData] = await Promise.all([tRes.json(), cRes.json(), uRes.json(), compRes.json(), pRes.json()]);

      setTeams(tData);
      setCategories(cData);
      setUnits(uData);
      setCompetitions(compData);
      setParticipants(pData);
      if (uData.length > 0 && user.role !== UserRole.UNIT_TEAM_LEADER) {
        setWizardUnitId(prev => prev || uData[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, [selectedUnitId, selectedCompId]);

  // Handle Team Creation Submit
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wizardUnitId || !wizardCategoryId || !wizardCompId || selectedMembers.length === 0) {
      alert('Please fill in all required fields and select team members');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          unitId: wizardUnitId,
          categoryId: wizardCategoryId,
          competitionId: wizardCompId,
          teamName: teamName.trim() || undefined,
          memberIds: selectedMembers
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register group team');

      setCreateOpen(false);
      setTeamName('');
      setSelectedMembers([]);
      setWizardCompId('');
      fetchLists();
      alert('Group team registered successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Team
  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Are you sure you want to delete this group team?')) return;
    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete team');
      }
      fetchLists();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Edit Team Handlers
  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setEditingMemberIds([...team.memberIds]);
    setEditSearchQuery('');
    setEditOpen(true);
  };

  const handleRemoveEditMember = (memberId: string) => {
    setEditingMemberIds(editingMemberIds.filter(id => id !== memberId));
  };

  const handleAddEditMember = (memberId: string, maxTeamSize: number) => {
    if (editingMemberIds.length >= maxTeamSize) {
      alert(`Team size cannot exceed ${maxTeamSize} members.`);
      return;
    }
    if (!editingMemberIds.includes(memberId)) {
      setEditingMemberIds([...editingMemberIds, memberId]);
    }
  };

  const handleSaveEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    const comp = competitions.find(c => c.id === editingTeam.competitionId);
    const maxCapacity = comp?.teamSize || 2;

    if (editingMemberIds.length < 2) {
      alert('Minimum 2 team members required.');
      return;
    }

    if (editingMemberIds.length > maxCapacity) {
      alert(`Team size cannot exceed ${maxCapacity} members for this event.`);
      return;
    }

    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/teams/${editingTeam.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          memberIds: editingMemberIds
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update group team');

      setEditOpen(false);
      setEditingTeam(null);
      setEditingMemberIds([]);
      fetchLists();
      alert('Group team members updated successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
        <span className="text-slate-500 font-mono text-xs">Loading group teams master...</span>
      </div>
    );
  }

  // Filter group competitions
  const groupComps = competitions.filter(c => c.participationType === ParticipationType.GROUP);
  // Wizard group comps filtered by selected wizard category
  const wizardGroupComps = groupComps.filter(c => c.categoryId === wizardCategoryId);
  const selectedWizardComp = competitions.find(c => c.id === wizardCompId);

  // Eligible members: same unit, same category, not already in a team for this same competition
  const eligibleMembers = participants.filter(p => {
    const isSameUnit = p.unitId === wizardUnitId || (p.unitId && wizardUnitId && String(p.unitId).trim() === String(wizardUnitId).trim());
    const pCatId = p.selectedCategoryId || (p as any).categoryId;
    const isSameCategory = pCatId === wizardCategoryId || (pCatId && wizardCategoryId && String(pCatId).trim() === String(wizardCategoryId).trim());
    const notDeleted = !p.deletedAt;
    const notInOtherTeam = !wizardCompId || !teams.some(t => t.competitionId === wizardCompId && t.memberIds.includes(p.id) && !t.deletedAt);
    return isSameUnit && isSameCategory && notDeleted && notInOtherTeam;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans min-w-0 w-full overflow-x-hidden">
      
      {/* Filters and Registration button row */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center no-print">
        <div className="flex flex-wrap gap-3 w-full sm:w-auto items-center">
          
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
            value={selectedCompId}
            onChange={(e) => setSelectedCompId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-slate-700 focus:outline-none text-xs font-semibold bg-slate-50 max-w-xs"
          >
            <option value="">All Group Events</option>
            {groupComps.map(c => {
              const catName = categories.find(cat => cat.id === c.categoryId)?.name || 'General';
              return <option key={c.id} value={c.id}>{c.name} ({catName})</option>;
            })}
          </select>

        </div>

        <button
          onClick={() => {
            setWizardUnitId(user.role === UserRole.UNIT_TEAM_LEADER ? (user.assignedUnitId || '') : (selectedUnitId || units[0]?.id || ''));
            setCreateOpen(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-emerald-600/10 gap-1.5"
        >
          <Plus className="h-4.5 w-4.5" />
          Register Group Team
        </button>
      </div>

      {/* Grid of registered Group Teams */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.length > 0 ? (
          teams.map((team) => {
            const comp = competitions.find(c => c.id === team.competitionId);
            const unit = units.find(u => u.id === team.unitId);
            const cat = categories.find(c => c.id === team.categoryId);
            const displayTeamName = team.teamName || `${unit?.name} Team`;

            return (
              <div key={team.id} className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between transition-colors">
                <div>
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-display font-extrabold text-slate-800 text-base">{displayTeamName}</h4>
                      <span className="text-xs font-semibold text-emerald-600 font-mono mt-0.5 block">{comp?.name} • {unit?.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(team)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Edit Team Members"
                      >
                        <Edit2 className="h-4.5 w-4.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeam(team.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Delete Team"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>

                  {/* Team Members List */}
                  <div className="mt-4">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-2">Team Members ({team.memberIds.length} Registered)</span>
                    <ul className="space-y-1.5">
                      {team.memberIds.map(mid => {
                        const p = participants.find(part => part.id === mid);
                        return (
                          <li key={mid} className="flex justify-between items-center bg-slate-50 border p-2 rounded-xl text-xs font-medium text-slate-700">
                            <span>{p ? p.fullName : 'Deleted Participant'}</span>
                            <span className="font-mono text-[10px] text-slate-400 font-bold">{p?.profilePhoto || '-'}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] font-mono font-bold text-slate-400">
                  <span>CATEGORY: {cat?.name}</span>
                  <span>SIZE: 2 - {comp?.teamSize}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full bg-white p-12 text-center text-slate-400 text-sm font-mono border rounded-2xl">
            No group teams found under selected filters
          </div>
        )}
      </div>

      {/* --- CREATE/REGISTER GROUP TEAM MODAL WIZARD --- */}
      {createOpen && (
        <div className="fixed inset-0 bg-slate-900/60  z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg max-w-lg w-full p-6  space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-display font-bold text-slate-800 text-base">Register Group Team</h3>
              <button 
                onClick={() => {
                  setCreateOpen(false);
                  setWizardCategoryId('');
                  setWizardCompId('');
                  setSelectedMembers([]);
                }} 
                className="p-1 rounded-lg hover:bg-slate-50 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="space-y-4 font-sans text-xs">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Unit Lock for Unit leaders */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Unit</label>
                  <select
                    disabled={user.role === UserRole.UNIT_TEAM_LEADER}
                    value={wizardUnitId}
                    onChange={(e) => setWizardUnitId(e.target.value)}
                    className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold bg-slate-50"
                  >
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>

                {/* Category selectors */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Category</label>
                  <select
                    required
                    value={wizardCategoryId}
                    onChange={(e) => {
                      setWizardCategoryId(e.target.value);
                      setWizardCompId('');
                      setSelectedMembers([]);
                    }}
                    className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-700 font-semibold bg-white focus:outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              {wizardCategoryId && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Group Competition</label>
                  <select
                    required
                    value={wizardCompId}
                    onChange={(e) => {
                      setWizardCompId(e.target.value);
                      setSelectedMembers([]);
                    }}
                    className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-700 bg-white focus:outline-none"
                  >
                    <option value="">Select Competition</option>
                    {wizardGroupComps.map(c => <option key={c.id} value={c.id}>{c.name} (Max {c.teamSize} members)</option>)}
                  </select>
                </div>
              )}

              {/* Members check list */}
              {wizardCompId && selectedWizardComp && (
                <div className="space-y-2 border border-slate-200 p-4 rounded-2xl">
                  <div className="flex justify-between items-center border-b pb-2 mb-2">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] font-mono">Select Team Members</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      selectedMembers.length >= 2 && selectedMembers.length <= selectedWizardComp.teamSize 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      Size: {selectedMembers.length} / {selectedWizardComp.teamSize} Selected
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto pr-2 space-y-1">
                    {eligibleMembers.length > 0 ? (
                      eligibleMembers.map((p) => {
                        const isChecked = selectedMembers.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setSelectedMembers(selectedMembers.filter(id => id !== p.id));
                              } else {
                                if (selectedMembers.length >= selectedWizardComp.teamSize) {
                                  alert(`Team size cannot exceed ${selectedWizardComp.teamSize} members.`);
                                  return;
                                }
                                setSelectedMembers([...selectedMembers, p.id]);
                              }
                            }}
                            className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between w-full ${
                              isChecked ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <span className="font-semibold text-slate-800">{p.fullName}</span>
                            <span className="font-mono text-[10px] text-slate-400">{p.profilePhoto}</span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="text-center py-4 text-slate-400 font-mono text-[11px]">No eligible candidates found in this unit & category</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(false);
                    setWizardCategoryId('');
                    setWizardCompId('');
                    setSelectedMembers([]);
                  }}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !wizardCompId || selectedMembers.length < 2 || selectedMembers.length > (selectedWizardComp?.teamSize || 2)}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Team'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- EDIT GROUP TEAM MODAL --- */}
      {editOpen && editingTeam && (() => {
        const comp = competitions.find(c => c.id === editingTeam.competitionId);
        const unit = units.find(u => u.id === editingTeam.unitId);
        const targetCatId = editingTeam.categoryId || comp?.categoryId || '';
        const targetUnitId = editingTeam.unitId || '';
        const cat = categories.find(c => c.id === targetCatId);
        const maxCapacity = comp?.teamSize || 2;

        // Eligible candidates from same unit and category, excluding current editing members & members in other teams for this comp
        const eligibleCandidates = participants.filter(p => {
          const isSameUnit = p.unitId === targetUnitId || (p.unitId && targetUnitId && String(p.unitId).trim() === String(targetUnitId).trim()) || (unit && p.unitId === unit.name);
          const pCatId = p.selectedCategoryId || (p as any).categoryId;
          const isSameCategory = pCatId === targetCatId || (pCatId && targetCatId && String(pCatId).trim() === String(targetCatId).trim()) || (cat && pCatId === cat.name);
          const notDeleted = !p.deletedAt;
          const notCurrentMember = !editingMemberIds.includes(p.id);
          const notInOtherTeam = !teams.some(t => t.id !== editingTeam.id && t.competitionId === editingTeam.competitionId && t.memberIds.includes(p.id) && !t.deletedAt);
          return isSameUnit && isSameCategory && notDeleted && notCurrentMember && notInOtherTeam;
        });

        // Filter eligible candidates by search query
        const filteredEligible = eligibleCandidates.filter(p => 
          p.fullName.toLowerCase().includes(editSearchQuery.toLowerCase()) ||
          (p.profilePhoto && p.profilePhoto.toLowerCase().includes(editSearchQuery.toLowerCase()))
        );

        const isSizeValid = editingMemberIds.length >= 2 && editingMemberIds.length <= maxCapacity;

        return (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="flex justify-between items-start border-b pb-3 shrink-0">
                <div>
                  <h3 className="font-display font-bold text-slate-800 text-base flex items-center gap-2">
                    <Edit2 className="h-4 w-4 text-emerald-600" />
                    Edit Group Team Members
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {comp?.name} • <span className="text-emerald-700 font-semibold">{unit?.name}</span> ({cat?.name})
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setEditOpen(false);
                    setEditingTeam(null);
                    setEditingMemberIds([]);
                  }} 
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Status Banner */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-semibold shrink-0 ${
                isSizeValid ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <span>Team Capacity: {editingMemberIds.length} / {maxCapacity} Members</span>
                <span className="font-mono text-[11px]">Min: 2 • Max: {maxCapacity}</span>
              </div>

              <div className="overflow-y-auto space-y-5 pr-1 flex-1">
                {/* 1. CURRENT MEMBERS */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-2">
                    Current Registered Members ({editingMemberIds.length})
                  </label>
                  <div className="space-y-2">
                    {editingMemberIds.map((mid) => {
                      const p = participants.find(part => part.id === mid);
                      const canRemove = editingMemberIds.length > 2;
                      return (
                        <div 
                          key={mid} 
                          className="flex items-center justify-between p-3 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs font-mono">
                              {p?.profilePhoto || '#'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 text-xs">{p?.fullName || 'Deleted Participant'}</p>
                              <p className="text-[10px] text-slate-400 font-mono font-medium">{unit?.name} • {cat?.name}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveEditMember(mid)}
                            disabled={!canRemove}
                            className={`p-1.5 rounded-xl border flex items-center gap-1 text-xs font-semibold transition-all ${
                              canRemove 
                                ? 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100 hover:border-rose-300' 
                                : 'text-slate-300 border-slate-200 cursor-not-allowed bg-slate-100'
                            }`}
                            title={canRemove ? "Remove member from team" : "Cannot remove: Minimum 2 members required"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="text-[11px]">Remove</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {editingMemberIds.length <= 2 && (
                    <p className="text-[11px] text-amber-600 font-medium mt-1.5 flex items-center gap-1 font-mono">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Minimum 2 members are required per group team. Add another member before removing one.
                    </p>
                  )}
                </div>

                {/* 2. AVAILABLE ELIGIBLE PARTICIPANTS */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Add Participants from {unit?.name} ({cat?.name})
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {eligibleCandidates.length} eligible available
                    </span>
                  </div>

                  {/* Search Bar */}
                  {eligibleCandidates.length > 3 && (
                    <div className="relative mb-2">
                      <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={editSearchQuery}
                        onChange={(e) => setEditSearchQuery(e.target.value)}
                        placeholder="Search candidate by name or chest no..."
                        className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:bg-white focus:border-emerald-500"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {filteredEligible.length > 0 ? (
                      filteredEligible.map((p) => {
                        const isAtMax = editingMemberIds.length >= maxCapacity;
                        return (
                          <div
                            key={p.id}
                            className="p-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                                {p.profilePhoto || '#'}
                              </span>
                              <span className="font-semibold text-slate-800 text-xs">{p.fullName}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddEditMember(p.id, maxCapacity)}
                              disabled={isAtMax}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                                isAtMax
                                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20'
                              }`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center py-4 text-slate-400 font-mono text-[11px] bg-slate-50 rounded-2xl border border-slate-200/80">
                        {editSearchQuery ? 'No matching candidates found' : 'No available eligible candidates found in this unit & category'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditingTeam(null);
                    setEditingMemberIds([]);
                  }}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditTeam}
                  disabled={editSubmitting || !isSizeValid}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
