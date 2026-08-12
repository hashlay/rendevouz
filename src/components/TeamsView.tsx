import React, { useState, useEffect } from 'react';
import { 
  Users2, UserPlus, Trash2, Search, Filter, RefreshCw, Check, CheckCircle2, AlertCircle, X, Plus 
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

  // Eligible members: same unit, same category, not already in a team for this same competition, under the group event limits
  const eligibleMembers = participants.filter(p => 
    p.unitId === wizardUnitId && 
    p.selectedCategoryId === wizardCategoryId &&
    !p.deletedAt
  );

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
            setWizardUnitId(user.role === UserRole.UNIT_TEAM_LEADER ? (user.assignedUnitId || '') : '');
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
                    <button
                      onClick={() => handleDeleteTeam(team.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete Team"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
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

    </div>
  );
}
