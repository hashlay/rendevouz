import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Search, Filter, RefreshCw, Eye, Medal, HelpCircle, ChevronDown, Layers, LayoutGrid,
  Plus, Edit3, Trash2, X, Settings, FileSpreadsheet
} from 'lucide-react';
import { User, UserRole, Category, Competition, ParticipationType, StageType } from '../types';

interface CompetitionsViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

export default function CompetitionsView({ user, token, eventSettings }: CompetitionsViewProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // View mode: 'grouped' by category & stage type, or 'grid' for plain layout
  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped');

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStageType, setSelectedStageType] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'duration'>('name');

  // Selected Comp Details Popup Modal (shows counts, limits, status)
  const [selectedComp, setSelectedComp] = useState<any>(null);
  const [compDetails, setCompDetails] = useState<any>(null);
  const [compLoading, setCompLoading] = useState(false);

  // Bulk Import Competition State
  const [showBulkCompModal, setShowBulkCompModal] = useState(false);
  const [bulkCompText, setBulkCompText] = useState('');
  const [importingBulkComp, setImportingBulkComp] = useState(false);

  // Competition CRUD Modal State
  const [showCompModal, setShowCompModal] = useState(false);
  const [editingComp, setEditingComp] = useState<Competition | null>(null);
  const [compFormName, setCompFormName] = useState('');
  const [compFormCatId, setCompFormCatId] = useState('');
  const [compFormType, setCompFormType] = useState<ParticipationType>(ParticipationType.INDIVIDUAL);
  const [compFormStageType, setCompFormStageType] = useState<StageType>(StageType.ON_STAGE);
  const [compFormTeamSize, setCompFormTeamSize] = useState<number>(2);
  const [compFormDuration, setCompFormDuration] = useState<number>(5);
  const [compFormNumJudges, setCompFormNumJudges] = useState<number>(2);
  const [savingComp, setSavingComp] = useState(false);

  // Category CRUD Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catCriteriaType, setCatCriteriaType] = useState<'dob' | 'class'>('dob');
  const [catDobStart, setCatDobStart] = useState('');
  const [catDobEnd, setCatDobEnd] = useState('');
  const [catClassStart, setCatClassStart] = useState('');
  const [catClassEnd, setCatClassEnd] = useState('');
  const [catRank1Pts, setCatRank1Pts] = useState(20);
  const [catRank2Pts, setCatRank2Pts] = useState(14);
  const [catRank3Pts, setCatRank3Pts] = useState(7);
  const [catStartingChestNumber, setCatStartingChestNumber] = useState<number>(1001);
  const [savingCategory, setSavingCategory] = useState(false);

  const handleBulkCompImport = async () => {
    if (!bulkCompText.trim()) return;
    setImportingBulkComp(true);

    try {
      // Format: Name, Category, ParticipationType (individual/group), StageType (on_stage/off_stage), Duration
      const lines = bulkCompText.trim().split('\n');
      const compsToImport = lines.map(line => {
        const parts = line.split(',').map(s => s.trim());
        return {
          name: parts[0] || '',
          categoryName: parts[1] || '',
          participationType: (parts[2] || '').toLowerCase().includes('group') ? 'group' : 'individual',
          stageType: (parts[3] || '').toLowerCase().includes('off') ? 'off_stage' : 'on_stage',
          duration: Number(parts[4]) || 5
        };
      }).filter(c => c.name.length > 0);

      const res = await fetch('/api/competitions/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ competitions: compsToImport })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk competition import failed');

      alert(data.message || `Successfully imported ${data.imported} competitions!`);
      setShowBulkCompModal(false);
      setBulkCompText('');
      fetchCompsAndCats();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setImportingBulkComp(false);
    }
  };

  const handleSaveComp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compFormName || !compFormCatId) {
      alert('Competition title and category are required');
      return;
    }
    setSavingComp(true);
    try {
      const url = editingComp ? `/api/competitions/${editingComp.id}` : '/api/competitions';
      const method = editingComp ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: compFormName,
          categoryId: compFormCatId,
          participationType: compFormType,
          stageType: compFormStageType,
          teamSize: compFormType === ParticipationType.GROUP ? compFormTeamSize : 1,
          duration: compFormDuration,
          numJudges: compFormNumJudges
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save competition');
      setShowCompModal(false);
      setEditingComp(null);
      fetchCompsAndCats();
      alert(editingComp ? 'Competition updated!' : 'Competition created successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingComp(false);
    }
  };

  const handleDeleteComp = async (id: string) => {
    if (!confirm('Are you sure you want to delete this competition program?')) return;
    try {
      const res = await fetch(`/api/competitions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete competition');
      fetchCompsAndCats();
      alert('Competition deleted successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) {
      alert('Category name is required');
      return;
    }
    setSavingCategory(true);
    try {
      const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: catName,
          criteriaType: catCriteriaType,
          dobStart: catCriteriaType === 'dob' ? catDobStart : undefined,
          dobEnd: catCriteriaType === 'dob' ? catDobEnd : undefined,
          classStart: catCriteriaType === 'class' ? catClassStart : undefined,
          classEnd: catCriteriaType === 'class' ? catClassEnd : undefined,
          pointsRank1: catRank1Pts,
          pointsRank2: catRank2Pts,
          pointsRank3: catRank3Pts,
          startingChestNumber: catStartingChestNumber
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save category');
      setEditingCategory(null);
      setCatName('');
      fetchCompsAndCats();
      alert(editingCategory ? 'Category updated!' : 'Category created successfully!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete category');
      fetchCompsAndCats();
      alert('Category deleted successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchCompsAndCats = async () => {
    setLoading(true);
    try {
      const [compRes, cRes] = await Promise.all([
        fetch('/api/competitions'),
        fetch('/api/categories')
      ]);

      const [compData, cData] = await Promise.all([compRes.json(), cRes.json()]);
      setCompetitions(compData);
      setCategories(cData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompsAndCats();
  }, []);

  // Fetch detailed registrations for selected competition
  const handleViewDetails = async (comp: Competition) => {
    setSelectedComp(comp);
    setCompDetails(null);
    setCompLoading(true);

    try {
      // In a real database, we could run specialized aggregates. Let's lookup via endpoint or simulate
      // We can query registrations or teams matching this competitionId
      const [regRes, resultsRes] = await Promise.all([
        fetch(`/api/participants`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/results?competitionId=${comp.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      const [regData, resultsData] = await Promise.all([regRes.json(), resultsRes.json()]);

      // Filter based on participation type
      let registeredCount = 0;
      if (comp.participationType === ParticipationType.INDIVIDUAL) {
        // Since participants store selected categories, let's look at scoreboard placements which maps individual events
        const sbRes = await fetch(`/api/scoreboard`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const sbData = await sbRes.json();
        // Count how many participants have placement records containing this compId
        registeredCount = sbData.filter((entry: any) => 
          entry.placements.some((pl: any) => pl.compId === comp.id)
        ).length;
      } else {
        // Count group teams registered for this competition
        const teamRes = await fetch(`/api/teams?competitionId=${comp.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const teamData = await teamRes.json();
        registeredCount = teamData.length;
      }

      setCompDetails({
        registeredCount,
        resultsPublished: resultsData.length > 0,
        results: resultsData
      });
    } catch (e) {
      console.error(e);
    } finally {
      setCompLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
        <span className="text-slate-500 font-mono text-xs">Loading competition master data...</span>
      </div>
    );
  }

  const filteredCompetitions = competitions.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategoryId ? c.categoryId === selectedCategoryId : true;
    const matchesType = selectedType ? c.participationType === selectedType : true;
    const matchesStageType = selectedStageType ? c.stageType === selectedStageType : true;
    return matchesSearch && matchesCategory && matchesType && matchesStageType && c.active;
  });

  const sortedCompetitions = [...filteredCompetitions].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'code') {
      return a.id.localeCompare(b.id);
    }
    if (sortBy === 'duration') {
      return (a.duration || 0) - (b.duration || 0);
    }
    return 0;
  });

  const renderCompCard = (comp: Competition, cat?: Category) => {
    return (
      <div key={comp.id} className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start border-b border-slate-100 pb-3">
            <div>
              <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {comp.id.replace('comp_', '').toUpperCase()}
              </span>
              <h4 className="font-display font-extrabold text-slate-800 text-sm leading-tight mt-1 truncate max-w-[200px]">{comp.name}</h4>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleViewDetails(comp)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-50"
                title="Inspect Registrations"
              >
                <Eye className="h-4 w-4" />
              </button>
              {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SECTOR_TEAM) && (
                <>
                  <button
                    onClick={() => {
                      setEditingComp(comp);
                      setCompFormName(comp.name);
                      setCompFormCatId(comp.categoryId);
                      setCompFormType(comp.participationType);
                      setCompFormStageType(comp.stageType);
                      setCompFormTeamSize(comp.teamSize || 2);
                      setCompFormDuration(comp.duration || 5);
                      setCompFormNumJudges(comp.numJudges || 2);
                      setShowCompModal(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                    title="Edit Competition"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteComp(comp.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Delete Competition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4 font-mono text-[10px] font-bold">
            <span className={`px-2.5 py-0.5 rounded-md uppercase ${
              comp.participationType === ParticipationType.INDIVIDUAL 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' 
                : 'bg-purple-50 text-purple-800 border border-purple-100'
            }`}>
              {comp.participationType}
            </span>
            <span className={`px-2.5 py-0.5 rounded-md uppercase ${
              comp.stageType === StageType.ON_STAGE 
                ? 'bg-amber-50 text-amber-800 border border-amber-100' 
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {comp.stageType.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-slate-100 flex justify-between items-baseline text-[10px] font-mono font-bold text-slate-400">
          <span>CATEGORY: {cat?.name || 'General'}</span>
          {comp.duration > 0 && <span>DUR: {comp.duration} mins</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row gap-4 justify-between items-center no-print">
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch sm:items-center">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4.5 w-4.5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search by code or program name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60 self-center sm:self-auto shrink-0">
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase font-mono ${
                viewMode === 'grouped'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Grouped
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all uppercase font-mono ${
                viewMode === 'grid'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 w-full lg:w-auto justify-end">
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-slate-700 focus:outline-none text-xs font-semibold bg-slate-50"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-slate-700 focus:outline-none text-xs font-semibold bg-slate-50"
          >
            <option value="">All Types</option>
            <option value={ParticipationType.INDIVIDUAL}>Individual Events</option>
            <option value={ParticipationType.GROUP}>Group Events</option>
          </select>

          <select
            value={selectedStageType}
            onChange={(e) => setSelectedStageType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-slate-700 focus:outline-none text-xs font-semibold bg-slate-50"
          >
            <option value="">All Stages</option>
            <option value={StageType.ON_STAGE}>On-Stage Only</option>
            <option value={StageType.OFF_STAGE}>Off-Stage Only</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-xl text-slate-700 focus:outline-none text-xs font-semibold bg-slate-50 font-mono"
          >
            <option value="name">Sort: Alphabetical (A-Z)</option>
            <option value="code">Sort: Program Code</option>
            <option value="duration">Sort: Duration (Shortest)</option>
          </select>

          {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SECTOR_TEAM) && (
            <>
              <button
                onClick={() => {
                  setEditingComp(null);
                  setCompFormName('');
                  setCompFormCatId(categories[0]?.id || '');
                  setCompFormType(ParticipationType.INDIVIDUAL);
                  setCompFormStageType(StageType.ON_STAGE);
                  setCompFormTeamSize(2);
                  setCompFormDuration(5);
                  setCompFormNumJudges(2);
                  setShowCompModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Competition
              </button>

              <button
                onClick={() => setShowBulkCompModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Bulk Import
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk Import Competition Modal */}
      {showBulkCompModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-600" />
                <span>Bulk Import Competitions (CSV / Excel)</span>
              </h3>
              <button onClick={() => setShowBulkCompModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                ✕
              </button>
            </div>

            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl text-xs space-y-1 border border-emerald-200">
              <p className="font-bold">Format: One competition per line (CSV format):</p>
              <p className="font-mono text-[11px]">Program Name, Category Name, Type (individual/group), Stage (on_stage/off_stage), Duration (mins)</p>
              <p className="text-[10px] text-emerald-700 mt-1">Example: Qira'at Recitation, Junior, individual, on_stage, 5</p>
            </div>

            <textarea
              rows={8}
              value={bulkCompText}
              onChange={(e) => setBulkCompText(e.target.value)}
              placeholder="Paste CSV lines here..."
              className="w-full p-3 border border-slate-300 rounded-2xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setShowBulkCompModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                Cancel
              </button>
              <button
                onClick={handleBulkCompImport}
                disabled={importingBulkComp || !bulkCompText.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                {importingBulkComp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
                Import Competitions Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid or Grouped list representation of Competitions */}
      {viewMode === 'grouped' ? (
        <div className="space-y-8">
          {categories
            .filter(cat => !selectedCategoryId || cat.id === selectedCategoryId)
            .map(cat => {
              const catComps = sortedCompetitions.filter(c => c.categoryId === cat.id);
              if (catComps.length === 0) return null;

              const onStageComps = catComps.filter(c => c.stageType === StageType.ON_STAGE);
              const offStageComps = catComps.filter(c => c.stageType === StageType.OFF_STAGE);

              return (
                <div key={cat.id} className="bg-slate-50/50 p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-5">
                  {/* Category Header */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse"></div>
                      <h3 className="font-display font-extrabold text-slate-800 text-sm uppercase tracking-wider">
                        {cat.name}
                      </h3>
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 font-mono text-[9px] font-bold px-2 py-0.5 rounded-full">
                        {catComps.length} {catComps.length === 1 ? 'Program' : 'Programs'}
                      </span>
                    </div>
                  </div>

                  {/* On Stage and Off Stage Subsections */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* On-Stage Subsection */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-amber-50/60 border border-amber-100/60 px-3.5 py-1.5 rounded-xl">
                        <span className="font-display font-bold text-amber-800 text-[10px] uppercase tracking-wider font-mono">
                          On-Stage Events
                        </span>
                        <span className="bg-amber-100 text-amber-900 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                          {onStageComps.length}
                        </span>
                      </div>

                      {onStageComps.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {onStageComps.map(comp => renderCompCard(comp, cat))}
                        </div>
                      ) : (
                        <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl text-[10px] font-mono text-slate-400 bg-white/60">
                          No on-stage programs found under this category
                        </div>
                      )}
                    </div>

                    {/* Off-Stage Subsection */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between bg-slate-100/80 border border-slate-200 px-3.5 py-1.5 rounded-xl">
                        <span className="font-display font-bold text-slate-700 text-[10px] uppercase tracking-wider font-mono">
                          Off-Stage Events
                        </span>
                        <span className="bg-slate-200 text-slate-800 font-mono text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                          {offStageComps.length}
                        </span>
                      </div>

                      {offStageComps.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {offStageComps.map(comp => renderCompCard(comp, cat))}
                        </div>
                      ) : (
                        <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl text-[10px] font-mono text-slate-400 bg-white/60">
                          No off-stage programs found under this category
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          {sortedCompetitions.length === 0 && (
            <div className="bg-white p-12 text-center text-slate-400 text-sm font-mono border border-slate-200 rounded-3xl">
              No competitions found matching filters
            </div>
          )}
        </div>
      ) : (
        /* Regular grid representation */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCompetitions.length > 0 ? (
            sortedCompetitions.map((comp) => {
              const cat = categories.find(c => c.id === comp.categoryId);
              return renderCompCard(comp, cat);
            })
          ) : (
            <div className="col-span-full bg-white p-12 text-center text-slate-400 text-sm font-mono border border-slate-200 rounded-3xl">
              No competitions found matching filters
            </div>
          )}
        </div>
      )}

      {/* --- DETAILED COMP INSIGHTS MODAL --- */}
      {selectedComp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 animate-scale-up space-y-4">
            
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="font-mono text-[10px] font-bold text-slate-400 block uppercase">Program Details insights</span>
                <h3 className="font-display font-extrabold text-slate-800 text-base mt-1">{selectedComp.name}</h3>
              </div>
              <button onClick={() => setSelectedComp(null)} className="p-1 rounded-lg text-slate-400">
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>

            {compLoading ? (
              <div className="py-8 text-center text-xs font-mono text-slate-400 animate-pulse">Aggregating records counts...</div>
            ) : (
              <div className="space-y-4 text-xs font-sans">
                
                {/* Visual aggregates summary cards */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 block uppercase font-mono">Registered Count</span>
                    <span className="text-lg font-extrabold text-slate-800 mt-1 block">
                      {compDetails?.registeredCount} {selectedComp.participationType === ParticipationType.INDIVIDUAL ? 'Candidates' : 'Teams'}
                    </span>
                  </div>
                  <div className="border-l pl-3">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase font-mono">Results status</span>
                    <span className={`text-xs font-extrabold mt-1.5 block uppercase ${
                      compDetails?.resultsPublished ? 'text-emerald-700 font-bold' : 'text-amber-600'
                    }`}>
                      {compDetails?.resultsPublished ? '● Published' : '○ Pending Entry'}
                    </span>
                  </div>
                </div>

                {/* Print Placement details list */}
                {compDetails?.resultsPublished && (
                  <div>
                    <h4 className="font-display font-bold text-slate-700 text-xs mb-2 uppercase tracking-wider font-mono">Published Standings</h4>
                    <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {compDetails.results.map((r: any) => (
                        <li key={r.id} className="bg-slate-50 border p-2.5 rounded-xl flex justify-between items-center">
                          <div>
                            <span className="font-semibold text-slate-800 block">{r.participantName || r.teamName || 'Group Team'}</span>
                            <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">Rank {r.rank || 'N/A'}</span>
                          </div>
                          {r.status === 'absent' || r.status === 'ABSENT' ? (
                            <span className="font-bold text-rose-600 font-mono text-xs">Absent</span>
                          ) : (
                            <span className="font-bold text-emerald-600 font-mono">{r.averageMark !== undefined ? r.averageMark : (r.totalMark || 0)} marks</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            )}

            <button
              onClick={() => setSelectedComp(null)}
              className="mt-4 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors font-mono"
            >
              Close Details
            </button>

          </div>
        </div>
      )}

      {/* --- ADD / EDIT COMPETITION MODAL --- */}
      {showCompModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-display font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>{editingComp ? 'Edit Competition Program' : 'Add New Competition Program'}</span>
              </h3>
              <button onClick={() => { setShowCompModal(false); setEditingComp(null); }} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveComp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Program Title</label>
                <input
                  type="text"
                  required
                  value={compFormName}
                  onChange={(e) => setCompFormName(e.target.value)}
                  placeholder="e.g. Arabic Elocution"
                  className="mt-1 block w-full px-3.5 py-2 border rounded-xl text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Category</label>
                  <select
                    required
                    value={compFormCatId}
                    onChange={(e) => setCompFormCatId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Participation Type</label>
                  <select
                    value={compFormType}
                    onChange={(e) => setCompFormType(e.target.value as ParticipationType)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold"
                  >
                    <option value={ParticipationType.INDIVIDUAL}>Individual</option>
                    <option value={ParticipationType.GROUP}>Group Team</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Stage Type</label>
                  <select
                    value={compFormStageType}
                    onChange={(e) => setCompFormStageType(e.target.value as StageType)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold"
                  >
                    <option value={StageType.ON_STAGE}>On-Stage</option>
                    <option value={StageType.OFF_STAGE}>Off-Stage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                    {compFormType === ParticipationType.GROUP ? 'Team Size Limit' : 'Duration (Mins)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={compFormType === ParticipationType.GROUP ? compFormTeamSize : compFormDuration}
                    onChange={(e) => {
                      if (compFormType === ParticipationType.GROUP) setCompFormTeamSize(Number(e.target.value));
                      else setCompFormDuration(Number(e.target.value));
                    }}
                    className="mt-1 block w-full px-3.5 py-2 border rounded-xl text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Number of Judges</label>
                <select
                  value={compFormNumJudges}
                  onChange={(e) => setCompFormNumJudges(Number(e.target.value))}
                  className="mt-1 block w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold"
                >
                  <option value={1}>1 Judge</option>
                  <option value={2}>2 Judges</option>
                  <option value={3}>3 Judges</option>
                  <option value={4}>4 Judges</option>
                  <option value={5}>5 Judges</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => { setShowCompModal(false); setEditingComp(null); }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingComp}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow"
                >
                  {savingComp ? 'Saving...' : editingComp ? 'Update Competition' : 'Create Competition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CATEGORY MANAGEMENT CONSOLE MODAL --- */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-display font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600" />
                  <span>CMS Category Criteria & Rules Manager</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">Create and configure category eligibility rules (DOB or Class) and rank points.</p>
              </div>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing Categories Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">Active Categories List</h4>
              <div className="border rounded-2xl overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 font-mono text-[10px] font-bold text-slate-400 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Category Name</th>
                      <th className="px-3 py-2 text-left">Criteria</th>
                      <th className="px-3 py-2 text-left">Range Details</th>
                      <th className="px-3 py-2 text-center">Points (1st/2nd/3rd)</th>
                      <th className="px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categories.map(cat => (
                      <tr key={cat.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-bold text-slate-800">{cat.name}</td>
                        <td className="px-3 py-2.5 font-mono text-[10px] font-bold uppercase text-purple-700">
                          {cat.criteriaType === 'class' ? 'Class / Grade' : 'Date of Birth'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500">
                          {cat.criteriaType === 'class' 
                            ? `Class ${cat.classStart || '1'} to ${cat.classEnd || '12'}` 
                            : `${cat.dobStart || 'Any'} → ${cat.dobEnd || 'Any'}`}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-emerald-700">
                          {cat.pointsRank1 || 20} / {cat.pointsRank2 || 14} / {cat.pointsRank3 || 7}
                        </td>
                        <td className="px-3 py-2.5 text-center flex justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setCatName(cat.name);
                              setCatCriteriaType(cat.criteriaType || 'dob');
                              setCatDobStart(cat.dobStart || '');
                              setCatDobEnd(cat.dobEnd || '');
                              setCatClassStart(cat.classStart || '');
                              setCatClassEnd(cat.classEnd || '');
                              setCatRank1Pts(cat.pointsRank1 || 20);
                              setCatRank2Pts(cat.pointsRank2 || 14);
                              setCatRank3Pts(cat.pointsRank3 || 7);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-600"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create/Edit Form */}
            <form onSubmit={handleSaveCategory} className="bg-purple-50/40 p-4 rounded-2xl border border-purple-100 space-y-3">
              <h4 className="text-xs font-extrabold text-purple-900 font-mono uppercase">
                {editingCategory ? `Edit Category (${editingCategory.name})` : '+ Add New Category'}
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Category Name</label>
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="e.g. Sub-Junior or Class 1-4"
                    className="mt-1 block w-full px-3 py-2 bg-white border rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Criteria System</label>
                  <select
                    value={catCriteriaType}
                    onChange={(e) => setCatCriteriaType(e.target.value as any)}
                    className="mt-1 block w-full px-3 py-2 bg-white border rounded-xl text-xs font-semibold"
                  >
                    <option value="dob">Date of Birth (DOB)</option>
                    <option value="class">Class / Grade Level</option>
                  </select>
                </div>
              </div>

              {catCriteriaType === 'dob' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">DOB Start (Oldest)</label>
                    <input
                      type="date"
                      value={catDobStart}
                      onChange={(e) => setCatDobStart(e.target.value)}
                      className="mt-1 block w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">DOB End (Youngest)</label>
                    <input
                      type="date"
                      value={catDobEnd}
                      onChange={(e) => setCatDobEnd(e.target.value)}
                      className="mt-1 block w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">From Class</label>
                    <input
                      type="text"
                      placeholder="e.g. 5th Class"
                      value={catClassStart}
                      onChange={(e) => setCatClassStart(e.target.value)}
                      className="mt-1 block w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">To Class</label>
                    <input
                      type="text"
                      placeholder="e.g. 7th Class"
                      value={catClassEnd}
                      onChange={(e) => setCatClassEnd(e.target.value)}
                      className="mt-1 block w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Start Chest No</label>
                  <input
                    type="number"
                    value={catStartingChestNumber}
                    onChange={(e) => setCatStartingChestNumber(Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-mono font-extrabold text-purple-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">1st Place Pts</label>
                  <input
                    type="number"
                    value={catRank1Pts}
                    onChange={(e) => setCatRank1Pts(Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">2nd Place Pts</label>
                  <input
                    type="number"
                    value={catRank2Pts}
                    onChange={(e) => setCatRank2Pts(Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-mono font-bold text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">3rd Place Pts</label>
                  <input
                    type="number"
                    value={catRank3Pts}
                    onChange={(e) => setCatRank3Pts(Number(e.target.value))}
                    className="mt-1 block w-full px-3 py-1.5 bg-white border rounded-xl text-xs font-mono font-bold text-orange-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingCategory && (
                  <button
                    type="button"
                    onClick={() => { setEditingCategory(null); setCatName(''); }}
                    className="px-3 py-1.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow"
                >
                  {savingCategory ? 'Saving...' : editingCategory ? 'Update Category' : '+ Add Category'}
                </button>
              </div>
            </form>

            <button
              onClick={() => setShowCategoryModal(false)}
              className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
            >
              Done Managing Categories
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
