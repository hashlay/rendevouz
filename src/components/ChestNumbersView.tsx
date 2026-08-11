import React, { useState, useEffect } from 'react';
import { 
  Hash, RefreshCw, Download, Printer, Search, AlertTriangle,
  CheckCircle, Clock, XCircle, Edit2, ChevronDown, Plus
} from 'lucide-react';
import { User, UserRole } from '../types';

interface ChestNumbersViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

export default function ChestNumbersView({ user, token, eventSettings }: ChestNumbersViewProps) {
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';

  const [chestNumbers, setChestNumbers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [cnRes, statsRes, catRes] = await Promise.all([
        fetch('/api/chest-numbers', { credentials: 'include' }),
        fetch('/api/chest-numbers/stats', { credentials: 'include' }),
        fetch('/api/categories', { credentials: 'include' })
      ]);
      if (cnRes.ok) setChestNumbers(await cnRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (catRes.ok) setCategories(await catRes.json());
    } catch (e) {
      console.error('Error fetching chest numbers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleBulkGenerate = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/chest-numbers/generate-bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to generate chest numbers' });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateAll = async () => {
    if (!confirm('Are you sure you want to regenerate all chest numbers? This will reset all assigned chest numbers based on CMS category starting settings.')) return;
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/chest-numbers/regenerate-all', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to regenerate chest numbers' });
    } finally {
      setGenerating(false);
    }
  };

  const handleEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/chest-numbers/${id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chestNumber: editValue })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        setEditingId(null);
        fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update chest number' });
    }
  };

  const handleExport = () => {
    window.open('/api/chest-numbers/export', '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  const filtered = chestNumbers
    .filter(cn => {
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return cn.participantName?.toLowerCase().includes(s) || 
               cn.chestNumber?.toString().includes(s) ||
               cn.unitName?.toLowerCase().includes(s);
      }
      return true;
    })
    .filter(cn => !filterCategory || cn.categoryId === filterCategory)
    .sort((a, b) => a.chestNumber - b.chestNumber);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const isAdmin = user.role === UserRole.SUPER_ADMIN;
  const canGenerate = isAdmin || user.role === UserRole.SECTOR_TEAM;

  return (
    <div className="space-y-6 print:space-y-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Hash className="h-7 w-7 text-amber-500" />
            Chest Numbers
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage permanent unique chest numbers for all participants</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canGenerate && (
            <>
              <button
                onClick={handleBulkGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Generate Missing
              </button>
              <button
                onClick={handleRegenerateAll}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold text-sm hover:bg-amber-700 transition disabled:opacity-50"
                title="Reset and recalculate chest numbers for all candidates based on CMS category starting ranges"
              >
                {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Regenerate All (CMS Ranges)
              </button>
            </>
          )}
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg font-semibold text-sm hover:bg-slate-700 transition">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg text-sm font-medium print:hidden ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.totalGenerated}</p>
                <p className="text-xs text-slate-500">Total Generated</p>
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
              <div className="p-2 bg-red-100 rounded-lg"><XCircle className="h-5 w-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.missing}</p>
                <p className="text-xs text-slate-500">Missing</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Hash className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.totalParticipants}</p>
                <p className="text-xs text-slate-500">Total Participants</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category Summary */}
      {stats?.categorySummary && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm print:hidden">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Category Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {stats.categorySummary.map((cat: any) => (
              <div key={cat.categoryId} className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-xs font-semibold text-slate-600 truncate">{cat.categoryName}</p>
                <p className="text-lg font-bold text-emerald-700">{cat.generated}</p>
                <p className="text-[10px] text-slate-400">{cat.missing > 0 ? `${cat.missing} missing` : 'Complete'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={`Search by name, chest number, or ${entityLabel.toLowerCase()}...`}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="relative">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="appearance-none bg-white border border-slate-300 rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Print Wrapper */}
      <div className="print-sheet print:overflow-visible">
        {/* Print Header */}
        <div className="hidden print:flex items-center justify-between pb-6 border-b border-dashed border-slate-300 mb-6">
          <div className="flex-shrink-0 w-32 flex justify-start">
            {eventSettings?.logoUrl && (
              <img src={eventSettings.logoUrl} alt="Festival Logo" className="max-h-24 object-contain" />
            )}
          </div>
          <div className="flex flex-col items-center text-center flex-1">
            <span className="font-display font-extrabold text-2xl tracking-wider text-slate-900 uppercase">{eventSettings?.festivalName?.toUpperCase() || 'FESTIVAL'} 2026</span>
            <span className="font-mono text-xs font-semibold text-emerald-700 tracking-widest uppercase mt-1">{eventSettings?.campusName?.toUpperCase() || 'CAMPUS'} COMMITTEE</span>
            <h1 className="text-xl font-bold text-center mt-4 uppercase">
              Chest Number List
            </h1>
          </div>
          <div className="flex-shrink-0 w-32"></div>
        </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border print:overflow-visible">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Chest #</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Participant</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">{entityLabel}</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 print:hidden">Generated By</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600 print:hidden">Date</th>
                {isAdmin && <th className="text-left px-4 py-3 font-semibold text-slate-600 print:hidden">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400">No chest numbers found</td></tr>
              ) : (
                filtered.map(cn => (
                  <tr key={cn.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                    <td className="px-4 py-3">
                      {editingId === cn.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editValue}
                            onChange={e => setEditValue(parseInt(e.target.value))}
                            className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
                          />
                          <button onClick={() => handleEdit(cn.id)} className="text-emerald-600 text-xs font-semibold">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-slate-400 text-xs">Cancel</button>
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">{cn.chestNumber}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{cn.participantName}</td>
                    <td className="px-4 py-3 text-slate-600">{cn.unitName}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{cn.categoryName}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 print:hidden">{cn.generatedByName}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs print:hidden">{new Date(cn.generatedAt).toLocaleDateString()}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 print:hidden">
                        <button
                          onClick={() => { setEditingId(cn.id); setEditValue(cn.chestNumber); }}
                          className="text-amber-600 hover:text-amber-700"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 print:hidden">
          Showing {filtered.length} of {chestNumbers.length} chest numbers
        </div>
      </div>
      </div>
    </div>
  );
}
