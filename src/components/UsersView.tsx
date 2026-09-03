import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, UserPlus, Trash2, Edit3, Key, RefreshCw, CheckCircle, 
  X, HelpCircle, Eye, EyeOff, Plus, UserCheck 
} from 'lucide-react';
import { User, UserRole } from '../types';

interface UsersViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

export default function UsersView({ user, token, eventSettings }: UsersViewProps) {
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';
  const leaderRoleLabel = `${entityLabel} Leader`;
  const [usersList, setUsersList] = useState<User[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form toggles
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Operator state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.SECTOR_TEAM);
  const [assignedUnitId, setAssignedUnitId] = useState('');
  const [assignedCompetitionIds, setAssignedCompetitionIds] = useState<string[]>([]);

  // Password reset targeting
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Edit Operator state
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>(UserRole.SECTOR_TEAM);
  const [editAssignedUnitId, setEditAssignedUnitId] = useState('');
  const [editAssignedCompetitionIds, setEditAssignedCompetitionIds] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);

  // Program Assignment Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetUser, setAssignTargetUser] = useState<User | null>(null);
  const [programSelection, setProgramSelection] = useState<string[]>([]);

  const fetchUsersAndUnits = async () => {
    setLoading(true);
    try {
      const [uRes, unitRes, compRes, catRes] = await Promise.all([
        fetch('/api/users', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/units'),
        fetch('/api/competitions'),
        fetch('/api/categories')
      ]);

      const [uData, unitData, compData, catData] = await Promise.all([
        uRes.json(), 
        unitRes.json(),
        compRes.json(),
        catRes.json()
      ]);
      setUsersList(uData);
      setUnits(unitData);
      setCompetitions(compData);
      setCategories(catData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndUnits();
  }, []);

  // Handle User creation
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !username || !password) {
      alert('Please fill in all required fields');
      return;
    }

    if (role === UserRole.UNIT_TEAM_LEADER && !assignedUnitId) {
      alert('Unit Team Leaders must be assigned to a specific unit');
      return;
    }

    setSubmitting(true);
    const payload = {
      fullName,
      username: username.toLowerCase().trim(),
      password,
      role,
      assignedUnitId: role === UserRole.UNIT_TEAM_LEADER ? assignedUnitId : undefined,
      assignedCompetitionIds: role === UserRole.JUDGE ? assignedCompetitionIds : undefined
    };

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create user account');

      setCreateOpen(false);
      setFullName('');
      setUsername('');
      setPassword('');
      setRole(UserRole.SECTOR_TEAM);
      setAssignedUnitId('');
      setAssignedCompetitionIds([]);
      fetchUsersAndUnits();
      alert('Operator account successfully registered!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle user active status
  const handleToggleStatus = async (targetUser: User) => {
    const actionLabel = targetUser.active ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${actionLabel} operator "${targetUser.fullName}"?`)) return;

    try {
      const res = await fetch(`/api/users/${targetUser.id}/toggle-active`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to toggle status');

      fetchUsersAndUnits();
      alert(`Operator account ${targetUser.active ? 'deactivated' : 'activated'} successfully`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Trigger Force password reset
  const handleForceResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !newPassword) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${resetTargetUser.id}/force-reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to override password');

      setResetOpen(false);
      setResetTargetUser(null);
      setNewPassword('');
      alert('Operator password modified successfully! They will be asked to change it upon next login.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to count only active existing competitions currently assigned to a judge
  const getLiveAssignedCount = (assignedIds?: string[]): number => {
    if (!assignedIds || !Array.isArray(assignedIds) || assignedIds.length === 0) return 0;
    return assignedIds.filter(id => competitions.some(c => c.id === id)).length;
  };

  // Start Edit User
  const handleStartEdit = (targetUser: User) => {
    setEditingUser(targetUser);
    setEditFullName(targetUser.fullName);
    setEditRole(targetUser.role);
    setEditAssignedUnitId(targetUser.assignedUnitId || '');
    const liveSelected = (targetUser.assignedCompetitionIds || []).filter(id => competitions.some(c => c.id === id));
    setEditAssignedCompetitionIds(liveSelected);
    setEditActive(targetUser.active);
    setEditOpen(true);
  };

  // Open Program Assignment Modal for Judge
  const handleOpenAssignModal = (targetUser: User) => {
    setAssignTargetUser(targetUser);
    const liveSelected = (targetUser.assignedCompetitionIds || []).filter(id => competitions.some(c => c.id === id));
    setProgramSelection(liveSelected);
    setAssignModalOpen(true);
  };

  // Save Program Assignments
  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetUser) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${assignTargetUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assignedCompetitionIds: programSelection
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign programs');

      setAssignModalOpen(false);
      setAssignTargetUser(null);
      fetchUsersAndUnits();
      alert('Assigned programs updated successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Update User (Edit)
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editFullName) {
      alert('Please fill in all required fields');
      return;
    }

    if (editRole === UserRole.UNIT_TEAM_LEADER && !editAssignedUnitId) {
      alert('Unit Team Leaders must be assigned to a specific unit');
      return;
    }

    setSubmitting(true);
    const payload = {
      fullName: editFullName,
      role: editRole,
      assignedUnitId: editRole === UserRole.UNIT_TEAM_LEADER ? editAssignedUnitId : undefined,
      assignedCompetitionIds: editRole === UserRole.JUDGE ? editAssignedCompetitionIds : undefined,
      active: editActive
    };

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to update user account');

      setEditOpen(false);
      setEditingUser(null);
      fetchUsersAndUnits();
      alert('Operator account successfully updated!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete User
  const handleDeleteUser = async (targetUser: User) => {
    if (targetUser.id === 'usr_admin') {
      alert('Cannot delete the main admin account.');
      return;
    }
    if (targetUser.id === user.id) {
      alert('Cannot delete your own logged-in account.');
      return;
    }
    if (!confirm(`Are you sure you want to PERMANENTLY delete operator "${targetUser.fullName}" (@${targetUser.username})? This will revoke all their active sessions and delete their account from the system.`)) return;

    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      fetchUsersAndUnits();
      alert('Operator account successfully deleted!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
        <span className="text-slate-500 font-mono text-xs">Loading operator configurations...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans min-w-0 w-full overflow-x-hidden">
      
      {/* Overview stats and Action Button Row */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center no-print">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-emerald-600" />
          <h4 className="font-display font-bold text-slate-800 text-sm">Operator Accounts Registry</h4>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md shadow-emerald-600/10 gap-1.5"
        >
          <UserPlus className="h-4.5 w-4.5" />
          Add System Operator
        </button>
      </div>

      {/* Operators List Grid */}
      <div className="no-print">
        {/* Mobile card list layout */}
        <div className="block md:hidden space-y-3">
          {usersList.map((op) => {
            const assignedUnit = units.find(u => u.id === op.assignedUnitId);
            return (
              <div key={op.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3 hover:shadow-sm transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shadow-inner uppercase shrink-0">
                      {op.fullName.charAt(0)}
                    </div>
                    <div>
                      <h5 className="font-semibold text-slate-900 text-sm">{op.fullName}</h5>
                      <span className="font-mono text-[10px] text-slate-400 font-bold block mt-0.5">@{op.username}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(op)}
                    className={`inline-flex items-center gap-1 text-[9px] font-bold font-mono px-2 py-0.5 rounded-full uppercase border ${
                      op.active 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                        : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                  >
                    <span className={`h-1 w-1 rounded-full ${op.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    {op.active ? 'Active' : 'Disabled'}
                  </button>
                </div>

                <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 text-xs">
                  <span className="text-slate-500 font-medium">
                    {op.role === UserRole.UNIT_TEAM_LEADER ? (
                      <>{entityLabel}: <strong className="text-slate-700">{assignedUnit ? assignedUnit.name : 'Unknown'}</strong></>
                    ) : op.role === UserRole.JUDGE ? (
                      <strong className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-mono text-[10px]">
                        {getLiveAssignedCount(op.assignedCompetitionIds)} {getLiveAssignedCount(op.assignedCompetitionIds) === 1 ? 'Program' : 'Programs'} Assigned
                      </strong>
                    ) : (
                      'Global'
                    )}
                  </span>
                  <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-lg border ${
                    op.role === UserRole.SUPER_ADMIN 
                      ? 'bg-rose-50 border-rose-200 text-rose-800' 
                      : op.role === UserRole.SECTOR_TEAM 
                        ? 'bg-blue-50 border-blue-200 text-blue-800' 
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    {op.role === UserRole.SUPER_ADMIN ? 'Super Admin' : op.role === UserRole.SECTOR_TEAM ? 'Admin' : op.role === UserRole.UNIT_TEAM_LEADER ? leaderRoleLabel : op.role.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-2.5 border-t border-slate-100">
                  {op.role === UserRole.JUDGE && (
                    <button
                      onClick={() => handleOpenAssignModal(op)}
                      className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-xl border border-indigo-100 transition-colors shadow-sm"
                      title="Assign Programs to Judge"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Assign Programs</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setResetTargetUser(op);
                      setResetOpen(true);
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-emerald-700 bg-slate-50 px-2.5 py-1.5 rounded-xl border transition-colors shadow-sm"
                    title="Force Reset Password"
                  >
                    <Key className="h-3.5 w-3.5" />
                    <span>Reset Pin</span>
                  </button>

                  <button
                    onClick={() => handleStartEdit(op)}
                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-xl border border-blue-100 transition-colors shadow-sm"
                    title="Edit Operator details"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>

                  {op.id !== 'usr_admin' && op.id !== user.id && (
                    <button
                      onClick={() => handleDeleteUser(op)}
                      className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-xl border border-rose-100 transition-colors shadow-sm"
                      title="Delete Operator"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table Layout */}
        <div className="hidden md:block bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Operator Profile</th>
                  <th className="px-6 py-4 text-left">Role Access</th>
                  <th className="px-6 py-4 text-left">Assigned {entityLabel}</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100 text-sm">
                {usersList.map((op) => {
                  const assignedUnit = units.find(u => u.id === op.assignedUnitId);
                  return (
                    <tr key={op.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shadow-inner uppercase">
                            {op.fullName.charAt(0)}
                          </div>
                          <div>
                            <h5 className="font-semibold text-slate-900">{op.fullName}</h5>
                            <span className="font-mono text-[10px] text-slate-400 font-bold block mt-0.5">@{op.username}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-block text-[10px] font-bold px-2.5 py-1 rounded-xl border ${
                          op.role === UserRole.SUPER_ADMIN 
                            ? 'bg-rose-50 border-rose-200 text-rose-800' 
                            : op.role === UserRole.SECTOR_TEAM 
                              ? 'bg-blue-50 border-blue-200 text-blue-800' 
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}>
                          {op.role === UserRole.SUPER_ADMIN ? 'Super Admin' : op.role === UserRole.SECTOR_TEAM ? 'Admin' : op.role === UserRole.UNIT_TEAM_LEADER ? leaderRoleLabel : op.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-600">
                        {op.role === UserRole.UNIT_TEAM_LEADER ? (
                          assignedUnit ? assignedUnit.name : 'Unknown'
                        ) : op.role === UserRole.JUDGE ? (
                          <span className="inline-block text-[11px] font-bold font-mono text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">
                            {getLiveAssignedCount(op.assignedCompetitionIds)} {getLiveAssignedCount(op.assignedCompetitionIds) === 1 ? 'Program' : 'Programs'} Assigned
                          </span>
                        ) : (
                          'Global Campus access'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleToggleStatus(op)}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold font-mono px-2.5 py-1 rounded-full uppercase border ${
                            op.active 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                              : 'bg-slate-100 border-slate-200 text-slate-400'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${op.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {op.active ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {op.role === UserRole.JUDGE && (
                            <button
                              onClick={() => handleOpenAssignModal(op)}
                              className="flex items-center gap-1 text-[11.5px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/50 px-3 py-1.5 rounded-xl border border-indigo-100 transition-colors shadow-sm"
                              title="Assign Programs to Judge"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              <span>Assign Programs</span>
                            </button>
                          )}

                          {/* Password Reset Force Button */}
                          <button
                            onClick={() => {
                              setResetTargetUser(op);
                              setResetOpen(true);
                            }}
                            className="flex items-center gap-1 text-[11.5px] font-bold text-slate-600 hover:text-emerald-700 bg-slate-50 px-3 py-1.5 rounded-xl border transition-colors shadow-sm"
                            title="Force Reset Password"
                          >
                            <Key className="h-3.5 w-3.5 text-slate-400" />
                            <span>Reset Pin</span>
                          </button>

                          {/* Edit Operator Button */}
                          <button
                            onClick={() => handleStartEdit(op)}
                            className="flex items-center gap-1 text-[11.5px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/50 px-3 py-1.5 rounded-xl border border-blue-100 transition-colors shadow-sm"
                            title="Edit Operator details"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>

                          {/* Delete Operator Button */}
                          {op.id !== 'usr_admin' && op.id !== user.id && (
                            <button
                              onClick={() => handleDeleteUser(op)}
                              className="flex items-center gap-1 text-[11.5px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/50 px-3 py-1.5 rounded-xl border border-rose-100 transition-colors shadow-sm"
                              title="Delete Operator Account"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Delete</span>
                            </button>
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
      </div>

      {/* --- ADD SYSTEM OPERATOR DIALOG MODAL --- */}
      {createOpen && (
        <div className="fixed inset-0 bg-slate-900/60  z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg max-w-md w-full p-6  space-y-4">
            
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-display font-bold text-slate-800 text-base">Register Operator Account</h3>
              <button onClick={() => setCreateOpen(false)} className="p-1 rounded-lg text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs font-sans">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Operator Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="E.g. Shafi Campus"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Operator Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none"
                    placeholder="shafi9"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Temporary PIN / Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Role Access level</label>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as UserRole);
                    setAssignedUnitId('');
                  }}
                  className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-700 bg-white"
                >
                  <option value={UserRole.SECTOR_TEAM}>Admin</option>
                  <option value={UserRole.UNIT_TEAM_LEADER}>{leaderRoleLabel}</option>
                  <option value={UserRole.GREEN_ROOM_MANAGER}>Green Room Manager</option>
                  <option value={UserRole.JUDGE}>Judge</option>
                  <option value={UserRole.RESULT_MANAGER}>Result Manager</option>
                  <option value={UserRole.VIEWER}>Viewer (Read-Only Portal Access)</option>
                  {user.role === UserRole.SUPER_ADMIN && (
                    <option value={UserRole.SUPER_ADMIN}>Super Admin access</option>
                  )}
                </select>
              </div>

              {/* Unit assignment picker (Only if role is unit leader!) */}
              {role === UserRole.UNIT_TEAM_LEADER && (
                <div className="animate-fade-in bg-slate-50 p-4 border rounded-2xl">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Assign {entityLabel}</label>
                  <select
                    required
                    value={assignedUnitId}
                    onChange={(e) => setAssignedUnitId(e.target.value)}
                    className="mt-1.5 block w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700"
                  >
                    <option value="">Choose {entityLabel}</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}

              {/* Judge Program Assignment Checklist */}
              {role === UserRole.JUDGE && (
                <div className="animate-fade-in bg-indigo-50/50 p-4 border border-indigo-100 rounded-2xl space-y-2 max-h-48 overflow-y-auto">
                  <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider font-mono">
                    Assign Programs / Competitions to Judge
                  </label>
                  <p className="text-[11px] text-indigo-700">Select which programs this Judge is responsible for evaluating:</p>
                  <div className="space-y-1.5 pt-1">
                    {competitions.filter(c => c.active).map(comp => {
                      const cat = categories.find(c => c.id === comp.categoryId);
                      const isChecked = assignedCompetitionIds.includes(comp.id);
                      return (
                        <label key={comp.id} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-indigo-100/80 cursor-pointer hover:bg-indigo-50">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAssignedCompetitionIds(prev => [...prev, comp.id]);
                              } else {
                                setAssignedCompetitionIds(prev => prev.filter(id => id !== comp.id));
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <div className="text-xs font-semibold text-slate-800">
                            {comp.name} <span className="text-[10px] text-slate-400 font-mono">({cat?.name})</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Creating...' : 'Register Operator'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- FORCE RESET PASSWORD PIN DIALOG --- */}
      {resetOpen && resetTargetUser && (
        <div className="fixed inset-0 bg-slate-900/60  z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg max-w-md w-full p-6  space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-base">Override Password PIN</h3>
                <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">Operator: {resetTargetUser.fullName}</span>
              </div>
              <button onClick={() => { setResetOpen(false); setResetTargetUser(null); }} className="p-1 rounded-lg text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleForceResetPassword} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">New PIN / Password Override</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-sm shadow-inner"
                  placeholder="••••••••"
                />
                <span className="text-[10px] text-slate-400 block mt-1.5 leading-relaxed font-semibold">
                  This forces a password reset on this operator's next login. They will be immediately asked to change it upon signing in.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => { setResetOpen(false); setResetTargetUser(null); }}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newPassword}
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Updating...' : 'Override PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT SYSTEM OPERATOR DIALOG MODAL --- */}
      {editOpen && editingUser && (
        <div className="fixed inset-0 bg-slate-900/60  z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg max-w-md w-full p-6  space-y-4">
            
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-base">Edit Operator Account</h3>
                <span className="text-[10px] font-mono text-slate-400 mt-0.5 block">Username: @{editingUser.username}</span>
              </div>
              <button 
                onClick={() => { setEditOpen(false); setEditingUser(null); }} 
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 text-xs font-sans">
              
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Operator Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans text-sm"
                  placeholder="E.g. Shafi Campus"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Role Access level</label>
                <select
                  value={editRole}
                  onChange={(e) => {
                    setEditRole(e.target.value as UserRole);
                    setEditAssignedUnitId('');
                  }}
                  className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-700 bg-white font-sans text-sm"
                  disabled={editingUser.id === 'usr_admin'} // Main admin can't change their role
                >
                  <option value={UserRole.SECTOR_TEAM}>Admin</option>
                  <option value={UserRole.UNIT_TEAM_LEADER}>{leaderRoleLabel}</option>
                  <option value={UserRole.GREEN_ROOM_MANAGER}>Green Room Manager</option>
                  <option value={UserRole.JUDGE}>Judge</option>
                  <option value={UserRole.RESULT_MANAGER}>Result Manager</option>
                  <option value={UserRole.VIEWER}>Viewer (Read-Only Portal Access)</option>
                  {user.role === UserRole.SUPER_ADMIN && (
                    <option value={UserRole.SUPER_ADMIN}>Super Admin access</option>
                  )}
                </select>
              </div>

              {/* Unit assignment picker (Only if role is unit leader!) */}
              {editRole === UserRole.UNIT_TEAM_LEADER && (
                <div className="animate-fade-in bg-slate-50 p-4 border rounded-2xl">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Assign {entityLabel}</label>
                  <select
                    required
                    value={editAssignedUnitId}
                    onChange={(e) => setEditAssignedUnitId(e.target.value)}
                    className="mt-1.5 block w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 font-sans text-sm"
                  >
                    <option value="">Choose {entityLabel}</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}

              {/* Judge Program Assignment Checklist */}
              {editRole === UserRole.JUDGE && (
                <div className="animate-fade-in bg-indigo-50/50 p-4 border border-indigo-100 rounded-2xl space-y-2 max-h-48 overflow-y-auto">
                  <label className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider font-mono">
                    Assign Programs / Competitions to Judge
                  </label>
                  <p className="text-[11px] text-indigo-700">Select which programs this Judge is responsible for evaluating:</p>
                  <div className="space-y-1.5 pt-1">
                    {competitions.filter(c => c.active).map(comp => {
                      const cat = categories.find(c => c.id === comp.categoryId);
                      const isChecked = editAssignedCompetitionIds.includes(comp.id);
                      return (
                        <label key={comp.id} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-indigo-100/80 cursor-pointer hover:bg-indigo-50">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditAssignedCompetitionIds(prev => [...prev, comp.id]);
                              } else {
                                setEditAssignedCompetitionIds(prev => prev.filter(id => id !== comp.id));
                              }
                            }}
                            className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                          />
                          <div className="text-xs font-semibold text-slate-800">
                            {comp.name} <span className="text-[10px] text-slate-400 font-mono">({cat?.name})</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status checkbox toggle */}
              {editingUser.id !== 'usr_admin' && (
                <div className="flex items-center gap-2 p-1">
                  <input
                    type="checkbox"
                    id="editActiveCheckbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                  />
                  <label htmlFor="editActiveCheckbox" className="text-xs font-semibold text-slate-700">
                    Operator Account Active (Allowed to log in)
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => { setEditOpen(false); setEditingUser(null); }}
                  className="px-4 py-2 border rounded-xl font-semibold text-slate-600 bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --- DEDICATED ASSIGN PROGRAMS MODAL FOR JUDGES --- */}
      {assignModalOpen && assignTargetUser && (
        <div className="fixed inset-0 bg-slate-900/60  z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg max-w-lg w-full p-6  space-y-4">
            
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-base">Assign Programs for Judge</h3>
                <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">{assignTargetUser.fullName} (@{assignTargetUser.username})</span>
              </div>
              <button 
                onClick={() => { setAssignModalOpen(false); setAssignTargetUser(null); }} 
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignments} className="space-y-4 text-xs font-sans">
              <p className="text-xs text-slate-600 leading-relaxed">
                Check off all competitions that <strong>{assignTargetUser.fullName}</strong> is assigned to evaluate. Upon logging in, this Judge will only see their assigned program judgment sheets.
              </p>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 max-h-64 overflow-y-auto space-y-2">
                {categories.map(cat => {
                  const compList = competitions.filter(c => c.categoryId === cat.id && c.active);
                  if (compList.length === 0) return null;

                  return (
                    <div key={cat.id} className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-100">
                      <h5 className="font-display font-bold text-slate-800 text-[11px] uppercase tracking-wider text-emerald-800">{cat.name} Category</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                        {compList.map(comp => {
                          const isChecked = programSelection.includes(comp.id);
                          return (
                            <label key={comp.id} className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold' : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100'}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setProgramSelection(prev => [...prev, comp.id]);
                                  } else {
                                    setProgramSelection(prev => prev.filter(id => id !== comp.id));
                                  }
                                }}
                                className="h-4 w-4 text-indigo-600 rounded focus:ring-indigo-500"
                              />
                              <span className="truncate">{comp.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-xs font-mono text-slate-500 font-bold">
                  Selected: {programSelection.length} Programs
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setAssignModalOpen(false); setAssignTargetUser(null); }}
                    className="px-4 py-2 border rounded-xl font-semibold text-slate-600 bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                  >
                    {submitting ? 'Saving...' : 'Save Assigned Programs'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
