import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, Database, Trash2, ShieldAlert, 
  RefreshCw, CheckCircle2, Download, Upload, AlertTriangle, Sparkles, UserCheck 
} from 'lucide-react';
import { User, UserRole } from '../types';

interface SettingsViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

const removeBackgroundFromLogo = (imageSource: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 500;
      const MAX_HEIGHT = 500;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSource);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // Sample background color from 4 corners
      const cornerIndices = [0, (width - 1) * 4, (height - 1) * width * 4, (width * height - 1) * 4];
      let bgR = 255, bgG = 255, bgB = 255;
      let validCorners = 0;
      let sumR = 0, sumG = 0, sumB = 0;

      cornerIndices.forEach((idx) => {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a > 180 && (r > 160 || g > 160 || b > 160)) {
          sumR += r;
          sumG += g;
          sumB += b;
          validCorners++;
        }
      });

      if (validCorners > 0) {
        bgR = Math.round(sumR / validCorners);
        bgG = Math.round(sumG / validCorners);
        bgB = Math.round(sumB / validCorners);
      }

      const threshold = 45;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) continue;

        const dist = Math.sqrt(
          (r - bgR) * (r - bgR) +
          (g - bgG) * (g - bgG) +
          (b - bgB) * (b - bgB)
        );

        const isLightBackground = r > 220 && g > 220 && b > 220;

        if (dist < threshold || isLightBackground) {
          if (dist < threshold / 2 || (r > 235 && g > 235 && b > 235)) {
            data[i + 3] = 0; // Fully transparent
          } else {
            const alphaFactor = (dist - threshold / 2) / (threshold / 2);
            data[i + 3] = Math.min(a, Math.round(a * alphaFactor));
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => resolve(imageSource);
    img.src = imageSource;
  });
};

export default function SettingsView({ user, token, eventSettings }: SettingsViewProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // CMS Settings form states
  const [sectorName, setSectorName] = useState('');
  const [eventTitle, setEventTitle] = useState('');
  const [festivalName, setFestivalName] = useState('Sahityotsav');
  const [campusName, setCampusName] = useState('Campus');
  const [ssfLogoUrl, setSsfLogoUrl] = useState('');
  const [sahityotsavLogoUrl, setSahityotsavLogoUrl] = useState('');
  const [certTheme1Url, setCertTheme1Url] = useState('');
  const [certTheme2Url, setCertTheme2Url] = useState('');
  const [certTheme3Url, setCertTheme3Url] = useState('');
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [gradeSystemEnabled, setGradeSystemEnabled] = useState(false);
  const [maxIndividualEvents, setMaxIndividualEvents] = useState(3);
  const [maxGroupEvents, setMaxGroupEvents] = useState(2);
  const [hasOnStageLimit, setHasOnStageLimit] = useState(false);
  const [maxOnStageEvents, setMaxOnStageEvents] = useState(3);
  const [hasOffStageLimit, setHasOffStageLimit] = useState(false);
  const [maxOffStageEvents, setMaxOffStageEvents] = useState(5);
  const [globalPoints1, setGlobalPoints1] = useState(20);
  const [globalPoints2, setGlobalPoints2] = useState(14);
  const [globalPoints3, setGlobalPoints3] = useState(7);
  const [globalPoints4, setGlobalPoints4] = useState(5);
  const [globalPoints5, setGlobalPoints5] = useState(4);
  const [globalPoints6, setGlobalPoints6] = useState(3);
  const [globalPoints7, setGlobalPoints7] = useState(2);
  const [globalPoints8, setGlobalPoints8] = useState(1);
  const [globalPoints9, setGlobalPoints9] = useState(1);
  const [globalPoints10, setGlobalPoints10] = useState(1);
  const [entityMode, setEntityMode] = useState<'unit' | 'house' | 'team'>('unit');
  const [autoRemoveLogoBg, setAutoRemoveLogoBg] = useState(false);
  const [fillLogo, setFillLogo] = useState(false);

  // Participant Login Criteria Settings
  const [participantLoginCriteria, setParticipantLoginCriteria] = useState<'dob' | 'class'>('dob');
  const [classRangeStart, setClassRangeStart] = useState<number>(1);
  const [classRangeEnd, setClassRangeEnd] = useState<number>(10);

  // Units / Houses CRUD state
  const [units, setUnits] = useState<any[]>([]);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitCode, setNewUnitCode] = useState('');

  // Categories & Rank Points State
  const [categories, setCategories] = useState<any[]>([]);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catStartChestNo, setCatStartChestNo] = useState(1001);
  const [catCriteria, setCatCriteria] = useState<'dob'|'class'>('dob');
  const [catDobStart, setCatDobStart] = useState('');
  const [catDobEnd, setCatDobEnd] = useState('');
  const [catClassStart, setCatClassStart] = useState('');
  const [catClassEnd, setCatClassEnd] = useState('');
  

  // Backup file uploading state
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  const fetchSettingsAndUnits = async () => {
    setLoading(true);
    try {
      const [sRes, uRes, cRes] = await Promise.all([
        fetch('/api/settings', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/units'),
        fetch('/api/categories')
      ]);
      const data = await sRes.json();
      setSectorName(data.sectorName || '');
      setEventTitle(data.eventTitle || '');
      setFestivalName(data.festivalName || 'Sahityotsav');
      setCampusName(data.campusName || data.sectorName || 'Campus');
      setSsfLogoUrl(data.ssfLogoUrl || '');
      setSahityotsavLogoUrl(data.sahityotsavLogoUrl || '');
      setCertTheme1Url(data.certTheme1Url || '');
      setCertTheme2Url(data.certTheme2Url || '');
      setCertTheme3Url(data.certTheme3Url || '');
      setRegistrationOpen(data.registrationOpen ?? true);
      setGradeSystemEnabled(data.gradeSystemEnabled ?? false);
      setMaxIndividualEvents(data.maxIndividualEvents || 3);
      setMaxGroupEvents(data.maxGroupEvents || 2);
      setHasOnStageLimit(data.maxOnStageEvents !== null && data.maxOnStageEvents !== undefined);
      setMaxOnStageEvents(data.maxOnStageEvents || 3);
      setHasOffStageLimit(data.maxOffStageEvents !== null && data.maxOffStageEvents !== undefined);
      setMaxOffStageEvents(data.maxOffStageEvents || 5);
      setGlobalPoints1(data.globalPointsRank1 || 20);
      setGlobalPoints2(data.globalPointsRank2 || 14);
      setGlobalPoints3(data.globalPointsRank3 || 7);
      setGlobalPoints4(data.globalPointsRank4 || 5);
      setGlobalPoints5(data.globalPointsRank5 || 4);
      setGlobalPoints6(data.globalPointsRank6 || 3);
      setGlobalPoints7(data.globalPointsRank7 || 2);
      setGlobalPoints8(data.globalPointsRank8 || 1);
      setGlobalPoints9(data.globalPointsRank9 || 1);
      setGlobalPoints10(data.globalPointsRank10 || 1);
      setEntityMode(data.entityMode || 'unit');
      setAutoRemoveLogoBg(data.autoRemoveLogoBg ?? false);
      setFillLogo(data.fillLogo ?? false);
      setParticipantLoginCriteria(data.participantLoginCriteria || 'dob');
      setClassRangeStart(data.classRangeStart ?? 1);
      setClassRangeEnd(data.classRangeEnd ?? 10);

      if (uRes.ok) setUnits(await uRes.json());
      if (cRes.ok) setCategories(await cRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndUnits();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          sectorName, 
          eventTitle, 
          festivalName,
          campusName,
          ssfLogoUrl, 
          sahityotsavLogoUrl,
          certTheme1Url,
          certTheme2Url,
          certTheme3Url,
          registrationOpen,
          gradeSystemEnabled,
          maxIndividualEvents,
          maxGroupEvents,
          maxOnStageEvents: hasOnStageLimit ? maxOnStageEvents : null,
          maxOffStageEvents: hasOffStageLimit ? maxOffStageEvents : null,
          globalPointsRank1: globalPoints1,
          globalPointsRank2: globalPoints2,
          globalPointsRank3: globalPoints3,
          globalPointsRank4: globalPoints4,
          globalPointsRank5: globalPoints5,
          globalPointsRank6: globalPoints6,
          globalPointsRank7: globalPoints7,
          globalPointsRank8: globalPoints8,
          globalPointsRank9: globalPoints9,
          globalPointsRank10: globalPoints10,
          entityMode,
          entityLabel: entityMode === 'house' ? 'House' : entityMode === 'team' ? 'Team' : 'Unit',
          autoRemoveLogoBg,
          fillLogo,
          participantLoginCriteria,
          classRangeStart,
          classRangeEnd,
          availableClasses: Array.from({ length: Math.max(1, classRangeEnd - classRangeStart + 1) }, (_, i) => `Class ${classRangeStart + i}`)
        })
      });
      const responseText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        if (!res.ok) throw new Error(`Server error (${res.status}). Payload may be too large or invalid response.`);
      }

      if (!res.ok) throw new Error(data.error || 'Failed to update settings');

      alert('CMS branding and settings updated successfully!');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName || !newUnitCode) return;

    try {
      const res = await fetch('/api/units', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newUnitName, code: newUnitCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add item');

      setNewUnitName('');
      setNewUnitCode('');
      fetchSettingsAndUnits();
      alert(`${entityMode === 'house' ? 'House' : entityMode === 'team' ? 'Team' : 'Unit'} added successfully!`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!confirm(`Are you sure you want to delete this ${entityMode}?`)) return;

    try {
      const res = await fetch(`/api/units/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');

      fetchSettingsAndUnits();
      alert('Deleted successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Export db backup trigger
  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/backup/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sahityotsav_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      alert('Failed to generate backup export file');
    }
  };

  // Restore DB state from file upload
  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupFile) return;

    if (!confirm('CRITICAL WARNING: Restoring a backup overrides the entire active database state! Are you absolutely sure?')) return;

    setRestoring(true);
    const formData = new FormData();
    formData.append('backup', backupFile);

    try {
      const res = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to restore DB backup');

      alert('Database restored successfully! The app will refresh.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRestoring(false);
    }
  };

  const handleSaveCategoryInSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      alert('Category name is required');
      return;
    }

    try {
      const url = editingCatId ? `/api/categories/${editingCatId}` : '/api/categories';
      const method = editingCatId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: catName.trim(),
          startingChestNumber: Number(catStartChestNo) || 1001,
          criteriaType: catCriteria,
          dobStart: catDobStart || undefined,
          dobEnd: catDobEnd || undefined,
          classStart: catClassStart || undefined,
          classEnd: catClassEnd || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save category');

      setEditingCatId(null);
      setCatName('');
      fetchSettingsAndUnits();
      alert(editingCatId ? 'Category updated successfully!' : 'Category created successfully!');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteCategoryInSettings = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete category');
      fetchSettingsAndUnits();
      alert('Category deleted');
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Complete DB reset wipes registrations
  const handleResetApp = async () => {
    if (!confirm('EXTREMELY DANGEROUS RESET: This deletes all candidate registrations, results, and team mappings! Only master configurations will remain. Do you want to continue?')) return;
    if (prompt('Please type "RESET SYSTEM" to confirm system wipe:') !== 'RESET SYSTEM') {
      alert('Reset cancelled due to incorrect confirmation string.');
      return;
    }

    try {
      const res = await fetch('/api/backup/reset', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Wipe operation failed');

      alert('System registrations reset successfully for a new Sahityotsav year!');
      window.location.reload();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
        <span className="text-slate-500 font-mono text-xs">Loading settings console...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto font-sans min-w-0 w-full overflow-x-hidden">
      
      {/* 1. CMS Portal & Event Visual Branding */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="border-b pb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-slate-800 text-lg flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-600" />
              <span>CMS Portal & Festival Branding</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">Configure logo, festival titles, sector/campus names, and dynamic organizational mode.</p>
          </div>
          {ssfLogoUrl && (
            <div className="flex items-center gap-2 p-2 bg-slate-50 border rounded-2xl">
              <img src={ssfLogoUrl} alt="Logo Preview" className="h-8 w-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
              <span className="text-[10px] font-mono font-bold text-slate-500">Live Logo</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Festival Name</label>
              <input
                type="text"
                required
                value={festivalName}
                onChange={(e) => setFestivalName(e.target.value)}
                placeholder="e.g. Sahityotsav"
                className="mt-1.5 block w-full px-3 py-2.5 border border-slate-300 rounded-xl text-slate-900 focus:outline-none font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Campus / Campus Name</label>
              <input
                type="text"
                required
                value={campusName}
                onChange={(e) => {
                  setCampusName(e.target.value);
                  setSectorName(e.target.value);
                }}
                placeholder="e.g. Campus"
                className="mt-1.5 block w-full px-3 py-2.5 border border-slate-300 rounded-xl text-slate-900 focus:outline-none font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Event Title Prefix</label>
              <input
                type="text"
                required
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="mt-1.5 block w-full px-3 py-2.5 border border-slate-300 rounded-xl text-slate-900 focus:outline-none font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Official Logo Image URL / Upload</label>
              <input
                type="text"
                value={ssfLogoUrl}
                onChange={(e) => {
                  setSsfLogoUrl(e.target.value);
                  setSahityotsavLogoUrl(e.target.value);
                }}
                placeholder="https://example.com/logo.png"
                className="mt-1.5 block w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 font-mono text-xs"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs cursor-pointer border border-emerald-200 transition-colors">
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Upload Logo from Gallery</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async (uploadEvent) => {
                          const rawSrc = uploadEvent.target?.result as string;
                          if (autoRemoveLogoBg) {
                            const transparentPng = await removeBackgroundFromLogo(rawSrc);
                            setSsfLogoUrl(transparentPng);
                            setSahityotsavLogoUrl(transparentPng);
                          } else {
                            setSsfLogoUrl(rawSrc);
                            setSahityotsavLogoUrl(rawSrc);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }} 
                  />
                </label>

                <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors">
                  <input 
                    type="checkbox" 
                    checked={autoRemoveLogoBg} 
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      setAutoRemoveLogoBg(checked);
                      if (checked && ssfLogoUrl) {
                        const transparentPng = await removeBackgroundFromLogo(ssfLogoUrl);
                        setSsfLogoUrl(transparentPng);
                        setSahityotsavLogoUrl(transparentPng);
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500" 
                  />
                  <span className="text-xs font-bold text-slate-700">Auto Remove Background</span>
                </label>

                <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors">
                  <input 
                    type="checkbox" 
                    checked={fillLogo} 
                    onChange={(e) => setFillLogo(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" 
                  />
                  <span className="text-xs font-bold text-slate-700">Fill Logo</span>
                </label>
              </div>
            </div>
          </div>



          {/* Organizational Entity Mode Selector */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-2">
            <label className="block text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider font-mono">
              Organizational Entity Structure
            </label>
            <p className="text-xs text-emerald-800">
              Select whether participants compete as <strong>Units</strong>, <strong>Houses</strong> (e.g. Red House, Blue House), or <strong>Teams</strong> across the system.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { key: 'unit', label: 'Units', desc: 'Unit Leaders & Campus Units' },
                { key: 'house', label: 'Houses', desc: 'Red, Blue, Green Houses' },
                { key: 'team', label: 'Teams', desc: 'Custom Campus Teams' }
              ].map(m => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setEntityMode(m.key as any)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    entityMode === m.key
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="font-extrabold text-xs">{m.label}</div>
                  <div className={`text-[10px] ${entityMode === m.key ? 'text-emerald-100' : 'text-slate-400'}`}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Registration Lock Toggle */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-semibold text-slate-800 text-xs">Campus Registration Window</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Toggle whether team leaders can register candidates, edit details, or manage group teams.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={registrationOpen} 
                onChange={(e) => setRegistrationOpen(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ml-2.5 text-xs font-bold font-mono uppercase text-slate-600">
                {registrationOpen ? 'ENABLED' : 'DISABLED'}
              </span>
            </label>
          </div>

          {/* Grade Awarding System Toggle */}
          <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-semibold text-indigo-950 text-xs">Grade Awarding System (A+, A, B+, B, C)</h4>
              <p className="text-[11px] text-indigo-800 mt-0.5">Enable or disable automatic performance grade badges on result certificates and score sheets.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={gradeSystemEnabled} 
                onChange={(e) => setGradeSystemEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              <span className="ml-2.5 text-xs font-bold font-mono uppercase text-indigo-900">
                {gradeSystemEnabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </label>
          </div>

          {/* Global Points System */}
          <div className="space-y-2 pt-2 border-t border-slate-200 mt-4">
            <label className="block text-[10px] font-extrabold text-slate-900 uppercase tracking-wider font-mono">Global Points Distribution (Ranks 1st through 10th)</label>
            <p className="text-[11px] text-slate-500 mb-2">This single point system applies to all categories.</p>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {[
                { label: '1st', state: globalPoints1, setter: setGlobalPoints1, color: 'text-emerald-700 font-extrabold' },
                { label: '2nd', state: globalPoints2, setter: setGlobalPoints2, color: 'text-slate-800 font-extrabold' },
                { label: '3rd', state: globalPoints3, setter: setGlobalPoints3, color: 'text-orange-700 font-extrabold' },
                { label: '4th', state: globalPoints4, setter: setGlobalPoints4, color: 'text-slate-700 font-bold' },
                { label: '5th', state: globalPoints5, setter: setGlobalPoints5, color: 'text-slate-700 font-bold' },
                { label: '6th', state: globalPoints6, setter: setGlobalPoints6, color: 'text-slate-700 font-bold' },
                { label: '7th', state: globalPoints7, setter: setGlobalPoints7, color: 'text-slate-700 font-bold' },
                { label: '8th', state: globalPoints8, setter: setGlobalPoints8, color: 'text-slate-600' },
                { label: '9th', state: globalPoints9, setter: setGlobalPoints9, color: 'text-slate-600' },
                { label: '10th', state: globalPoints10, setter: setGlobalPoints10, color: 'text-slate-600' }
              ].map(item => (
                <div key={item.label}>
                  <label className="block text-[9px] font-bold text-slate-500 text-center font-mono">{item.label}</label>
                  <input
                    type="number"
                    min={0}
                    value={item.state}
                    onChange={(e) => item.setter(Number(e.target.value))}
                    className={`mt-0.5 block w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center text-xs font-mono ${item.color}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Program Limits Controls */}
          <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-200 space-y-3">
            <h4 className="font-bold text-purple-950 text-xs uppercase tracking-wider font-mono">Participant Competition Program Limits</h4>
            <p className="text-[11px] text-purple-800">Set the maximum number of individual and group events a candidate can register for.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Max Individual Events Per Candidate</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxIndividualEvents}
                  onChange={(e) => setMaxIndividualEvents(Number(e.target.value))}
                  className="mt-1 block w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Max Group Events Per Candidate</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={maxGroupEvents}
                  onChange={(e) => setMaxGroupEvents(Number(e.target.value))}
                  className="mt-1 block w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-purple-900 focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-purple-200/60">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Max On-Stage Events Per Candidate</label>
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={!hasOnStageLimit} onChange={() => setHasOnStageLimit(false)} className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-[11px] font-bold text-slate-600">No Limit</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={hasOnStageLimit} onChange={() => setHasOnStageLimit(true)} className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-[11px] font-bold text-slate-600">Set Limit</span>
                  </label>
                </div>
                {hasOnStageLimit && (
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxOnStageEvents}
                    onChange={(e) => setMaxOnStageEvents(Number(e.target.value))}
                    className="block w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-rose-700 focus:ring-2 focus:ring-rose-500"
                  />
                )}
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Max Off-Stage Events Per Candidate</label>
                <div className="flex items-center gap-2 mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={!hasOffStageLimit} onChange={() => setHasOffStageLimit(false)} className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-[11px] font-bold text-slate-600">No Limit</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={hasOffStageLimit} onChange={() => setHasOffStageLimit(true)} className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-[11px] font-bold text-slate-600">Set Limit</span>
                  </label>
                </div>
                {hasOffStageLimit && (
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxOffStageEvents}
                    onChange={(e) => setMaxOffStageEvents(Number(e.target.value))}
                    className="block w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-sky-700 focus:ring-2 focus:ring-sky-500"
                  />
                )}
              </div>
            </div>

            {/* Participant Verification & Login Criteria */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                  Participant Verification & Login Criteria
                </h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Configure whether participant login and candidate registration verification relies on Date of Birth or Class/Grade.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1.5">
                    Verification Criteria Mode
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-2 rounded-xl border border-slate-200 hover:border-emerald-400 text-xs font-bold text-slate-700">
                      <input
                        type="radio"
                        name="criteriaMode"
                        value="dob"
                        checked={participantLoginCriteria === 'dob'}
                        onChange={() => setParticipantLoginCriteria('dob')}
                        className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      Date of Birth Mode
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer bg-white px-3 py-2 rounded-xl border border-slate-200 hover:border-emerald-400 text-xs font-bold text-slate-700">
                      <input
                        type="radio"
                        name="criteriaMode"
                        value="class"
                        checked={participantLoginCriteria === 'class'}
                        onChange={() => setParticipantLoginCriteria('class')}
                        className="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      Class / Grade Mode
                    </label>
                  </div>
                </div>

                {participantLoginCriteria === 'class' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1.5">
                      Available Class Range
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 font-mono">Class</span>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={classRangeStart}
                        onChange={(e) => setClassRangeStart(Number(e.target.value))}
                        className="w-16 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 text-center"
                      />
                      <span className="text-xs font-bold text-slate-600 font-mono">to Class</span>
                      <input
                        type="number"
                        min={1}
                        max={25}
                        value={classRangeEnd}
                        onChange={(e) => setClassRangeEnd(Number(e.target.value))}
                        className="w-16 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 text-center"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      Generated options: Class {classRangeStart} to Class {classRangeEnd}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Updating...' : 'Save CMS Branding'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 2. Category & Rank Points Manager (1st to 10th Place) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="border-b pb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display font-extrabold text-slate-800 text-lg flex items-center gap-2">
              <span>Category Manager & Rank Points System (1st to 10th Place)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">Configure competition categories, starting chest numbers, and points distribution for 1st through 10th place.</p>
          </div>
        </div>

        {/* Categories Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b text-slate-500 font-mono uppercase text-[10px]">
              <tr>
                <th className="p-3">Category Name</th>
                <th className="p-3">Start Chest No</th>
                <th className="p-3">Criteria</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-slate-50/80 font-medium">
                  <td className="p-3 font-bold text-slate-800">{cat.name}</td>
                  <td className="p-3 font-mono font-bold text-purple-900">{cat.startingChestNumber || 1001}</td>
                  <td className="p-3 text-slate-600">
                    {cat.criteriaType === 'dob' && (cat.dobStart || cat.dobEnd) ? `DOB: ${cat.dobStart || '*'} to ${cat.dobEnd || '*'}` : ''}
                    {cat.criteriaType === 'class' && (cat.classStart || cat.classEnd) ? `Class: ${cat.classStart || '*'} to ${cat.classEnd || '*'}` : ''}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setCatName(cat.name);
                        setCatStartChestNo(cat.startingChestNumber || 1001);
                        setCatCriteria(cat.criteriaType || 'dob');
                        setCatDobStart(cat.dobStart || '');
                        setCatDobEnd(cat.dobEnd || '');
                        setCatClassStart(cat.classStart || '');
                        setCatClassEnd(cat.classEnd || '');
                        setTimeout(() => document.getElementById('category-form')?.scrollIntoView({ behavior: 'smooth' }), 50);
                      }}
                      className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-bold"
                    >
                      Edit Category
                    </button>
                    <button
                      onClick={() => handleDeleteCategoryInSettings(cat.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Category Form */}
        <form id="category-form" onSubmit={handleSaveCategoryInSettings} className="bg-purple-50/40 p-5 rounded-2xl border border-purple-200/80 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-purple-950 text-xs uppercase tracking-wider font-mono">
              {editingCatId ? `Edit Category: "${catName}"` : '+ Add New Category'}
            </h4>
            {editingCatId && (
              <button
                type="button"
                onClick={() => { setEditingCatId(null); setCatName(''); }}
                className="text-xs font-bold text-slate-500 hover:text-slate-700"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Category Name</label>
              <input
                type="text"
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Sub-Junior"
                className="mt-1 block w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Starting Chest Number</label>
              <input
                type="number"
                required
                value={catStartChestNo}
                onChange={(e) => setCatStartChestNo(Number(e.target.value))}
                className="mt-1 block w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-extrabold text-purple-900"
              />
            </div>
          </div>

          {/* Criteria Settings */}
          <div className="space-y-3 pt-2 border-t border-purple-200/60">
            <div className="flex items-center gap-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Criteria Type</label>
              <select value={catCriteria} onChange={(e) => setCatCriteria(e.target.value as any)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs">
                <option value="dob">Date of Birth</option>
                <option value="class">Class/Grade</option>
              </select>
            </div>
            
            {catCriteria === 'dob' ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">DOB Start (Optional)</label>
                  <input type="date" value={catDobStart} onChange={(e) => setCatDobStart(e.target.value)} className="mt-1 block w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">DOB End (Optional)</label>
                  <input type="date" value={catDobEnd} onChange={(e) => setCatDobEnd(e.target.value)} className="mt-1 block w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Class Start (Optional)</label>
                  <input type="text" value={catClassStart} onChange={(e) => setCatClassStart(e.target.value)} placeholder="e.g. 5" className="mt-1 block w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Class End (Optional)</label>
                  <input type="text" value={catClassEnd} onChange={(e) => setCatClassEnd(e.target.value)} placeholder="e.g. 7" className="mt-1 block w-full px-3 py-1.5 border rounded-lg text-xs" />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-extrabold shadow cursor-pointer"
            >
              {editingCatId ? 'Update Category' : '+ Save Category'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Units / Houses / Teams Manager */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-5">
        <div className="border-b pb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-slate-800 text-lg capitalize">
              Manage {entityMode === 'house' ? 'Houses' : entityMode === 'team' ? 'Teams' : 'Units'} ({units.length})
            </h3>
            <p className="text-xs text-slate-400 mt-1">Add, edit, or remove active {entityMode === 'house' ? 'houses' : entityMode === 'team' ? 'teams' : 'units'} participating in the festival.</p>
          </div>
        </div>

        {/* Add Unit / House Form */}
        <form onSubmit={handleAddUnit} className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <input
            type="text"
            required
            placeholder={`e.g. ${entityMode === 'house' ? 'Red House' : entityMode === 'team' ? 'Alpha Team' : 'Nekkila Unit'}`}
            value={newUnitName}
            onChange={(e) => setNewUnitName(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-white"
          />
          <input
            type="text"
            required
            placeholder="Code (e.g. RED)"
            value={newUnitCode}
            onChange={(e) => setNewUnitCode(e.target.value)}
            className="w-full sm:w-32 px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono uppercase font-bold text-slate-900 bg-white"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow cursor-pointer whitespace-nowrap"
          >
            + Add {entityMode === 'house' ? 'House' : entityMode === 'team' ? 'Team' : 'Unit'}
          </button>
        </form>

        {/* Units / Houses List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {units.map((u) => (
            <div key={u.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div>
                <div className="font-extrabold text-xs text-slate-900">{u.name}</div>
                <div className="text-[10px] font-mono text-emerald-700 font-bold">Code: {u.code}</div>
              </div>
              <button
                onClick={() => handleDeleteUnit(u.id)}
                className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg transition cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Backup & Disaster recovery */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="border-b pb-4">
          <h3 className="font-display font-bold text-slate-800 text-lg">Backup & Restore Engine</h3>
          <p className="text-xs text-slate-400 mt-1">Export persistent DB dumps or restore state instantly for offline security and multi-device syncing</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Export Dump Box */}
          <div className="border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <h4 className="font-display font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <Database className="h-4.5 w-4.5 text-emerald-600" />
                Export DB Dump
              </h4>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                Download a fully compliant JSON backup dump file containing all units, categories, registered participants, and competition marks sheets.
              </p>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="mt-6 flex items-center justify-center gap-1.5 w-full py-2 bg-slate-50 border hover:bg-slate-100 rounded-xl font-bold text-slate-700 text-xs shadow-sm transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download JSON Dump</span>
            </button>
          </div>

          {/* Import Restore dump */}
          <div className="border border-slate-200 rounded-2xl p-5">
            <h4 className="font-display font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Upload className="h-4.5 w-4.5 text-amber-600" />
              Restore DB Dump
            </h4>
            <form onSubmit={handleRestoreBackup} className="mt-4 space-y-4">
              <input
                type="file"
                required
                accept=".json"
                onChange={(e) => setBackupFile(e.target.files ? e.target.files[0] : null)}
                className="block w-full text-[11px] file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 font-mono text-slate-500"
              />
              <button
                type="submit"
                disabled={restoring || !backupFile}
                className="flex items-center justify-center gap-1.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold text-xs shadow-md disabled:opacity-50"
              >
                {restoring ? 'Restoring DB...' : 'Restore Database'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 3. System Reset Wipe option */}
      <div className="bg-red-50/50 p-6 rounded-3xl border border-red-200 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5 animate-pulse" />
          <div>
            <h3 className="font-display font-extrabold text-red-800 text-sm">Danger Zone / New Year Reset</h3>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              To launch the Sahityotsav system for a new academic year or empty the records safely, you can wipe all active candidate registrations, results sheets, and team configurations. Master settings (units, categories, active users, competitions) will be preserved!
            </p>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <button
            onClick={handleResetApp}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md shadow-red-600/15"
          >
            <Trash2 className="h-4 w-4" />
            <span>Reset Registration & Results</span>
          </button>
        </div>
      </div>

    </div>
  );
}
