import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, GraduationCap, ClipboardCheck, AlertTriangle, Check, RefreshCw, X
} from 'lucide-react';
import { User, UserRole, Gender, Category, Competition, ParticipationType } from '../types';

interface RegistrationViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

export default function RegistrationView({ user, token, eventSettings }: RegistrationViewProps) {
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';

  // Input Refs for fast keyboard navigation
  const fullNameRef = useRef<HTMLInputElement>(null);
  const dobDayRef = useRef<HTMLInputElement>(null);
  const dobMonthRef = useRef<HTMLInputElement>(null);
  const dobYearRef = useRef<HTMLInputElement>(null);

  // Master lists
  const [units, setUnits] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  // Status & toast state
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [gender, setGender] = useState<Gender>(Gender.MALE);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedComps, setSelectedComps] = useState<string[]>([]);

  // DOB 3 distinct numeric boxes state (DD / MM / YYYY)
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
  const [dob, setDob] = useState('');
  const [candidateClass, setCandidateClass] = useState('');

  const criteriaMode = eventSettings?.participantLoginCriteria || 'class';
  const classStart = eventSettings?.classRangeStart ?? 1;
  const classEnd = eventSettings?.classRangeEnd ?? 10;
  const availableClasses: string[] = eventSettings?.availableClasses || Array.from({ length: Math.max(1, classEnd - classStart + 1) }, (_, i) => `Class ${classStart + i}`);

  const updateCombinedDob = (d: string, m: string, y: string) => {
    if (d && m && y && y.length === 4) {
      const formattedDay = d.padStart(2, '0');
      const formattedMonth = m.padStart(2, '0');
      setDob(`${y}-${formattedMonth}-${formattedDay}`);
    } else {
      setDob('');
    }
  };

  const handleDobDayChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 2);
    setDobDay(clean);
    updateCombinedDob(clean, dobMonth, dobYear);
    if (clean.length === 2) {
      dobMonthRef.current?.focus();
      dobMonthRef.current?.select();
    }
  };

  const handleDobMonthChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 2);
    setDobMonth(clean);
    updateCombinedDob(dobDay, clean, dobYear);
    if (clean.length === 2) {
      dobYearRef.current?.focus();
      dobYearRef.current?.select();
    }
  };

  const handleDobYearChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    setDobYear(clean);
    updateCombinedDob(dobDay, dobMonth, clean);
  };

  // Fetch initial master lists
  const fetchMasterLists = async () => {
    try {
      const [uRes, cRes, compRes] = await Promise.all([
        fetch('/api/units'),
        fetch('/api/categories'),
        fetch('/api/competitions')
      ]);

      const [uData, cData, compData] = await Promise.all([uRes.json(), cRes.json(), compRes.json()]);

      setUnits(uData.filter((u: any) => u.active));
      setCategories(cData.filter((c: any) => c.active));
      setCompetitions(compData.filter((c: any) => c.active));

      // Auto-assign Unit Leader's unit
      if (user.role === UserRole.UNIT_TEAM_LEADER) {
        setSelectedUnitId(user.assignedUnitId || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterLists();
  }, []);

  const handleCategorySelect = (catId: string) => {
    setSelectedCategoryId(catId);
    setSelectedComps([]); // reset selected competitions on category change
  };

  const handleCompToggle = (compId: string) => {
    const comp = competitions.find(c => c.id === compId);
    if (!comp) return;

    const isSelected = selectedComps.includes(compId);

    if (isSelected) {
      setSelectedComps(selectedComps.filter(id => id !== compId));
    } else {
      const selectedModels = competitions.filter(c => selectedComps.includes(c.id));
      const individualCount = selectedModels.filter(c => c.participationType === ParticipationType.INDIVIDUAL).length;
      const groupCount = selectedModels.filter(c => c.participationType === ParticipationType.GROUP).length;

      const maxInd = eventSettings?.maxIndividualEvents || 3;
      const maxGrp = eventSettings?.maxGroupEvents || 2;

      if (comp.participationType === ParticipationType.INDIVIDUAL) {
        if (individualCount >= maxInd) {
          alert(`Maximum ${maxInd} individual competitions allowed per candidate.`);
          return;
        }
      } else {
        if (groupCount >= maxGrp) {
          alert(`Maximum ${maxGrp} group competitions allowed per candidate.`);
          return;
        }
      }
      setSelectedComps([...selectedComps, compId]);
    }
  };

  const handleFinalSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!fullName.trim()) {
      setMessage({ type: 'error', text: 'Please enter Candidate Full Name' });
      return;
    }
    if (!selectedUnitId) {
      setMessage({ type: 'error', text: `Please select a ${entityLabel}` });
      return;
    }
    if (!selectedCategoryId) {
      setMessage({ type: 'error', text: 'Please select a Category' });
      return;
    }
    if (criteriaMode === 'dob' && !dob) {
      setMessage({ type: 'error', text: 'Please enter Date of Birth (DD / MM / YYYY)' });
      return;
    }
    if (criteriaMode === 'class' && !candidateClass) {
      setMessage({ type: 'error', text: 'Please select Candidate Class / Grade' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const payload = {
      fullName: fullName.trim(),
      dob: dob || (criteriaMode === 'dob' ? '2010-01-01' : ''),
      candidateClass: candidateClass || '',
      unitId: selectedUnitId,
      gender,
      educationStatus: 'student',
      selectedCategoryId,
      selectedCompetitionIds: selectedComps
    };

    try {
      const res = await fetch('/api/participants', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete candidate registration');
      }

      const chestNo = data.chestNumber || data.participant?.profilePhoto || 'ASSIGNED';
      setMessage({
        type: 'success',
        text: `Candidate "${fullName}" registered successfully! Chest No Assigned: ${chestNo}`
      });

      // Reset candidate fields while keeping unit pre-selected for fast continuous registration!
      setFullName('');
      setDobDay('');
      setDobMonth('');
      setDobYear('');
      setDob('');
      setCandidateClass('');
      setSelectedComps([]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
        <span className="text-slate-500 font-mono text-xs">Loading single-page registration console...</span>
      </div>
    );
  }

  const filteredCompetitions = competitions.filter(c => c.categoryId === selectedCategoryId);

  const isDobValid = criteriaMode !== 'dob' || Boolean(dob);
  const isClassValid = criteriaMode !== 'class' || Boolean(candidateClass);
  const isFormValid = Boolean(fullName.trim()) && Boolean(selectedUnitId) && Boolean(selectedCategoryId) && isDobValid && isClassValid;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto font-sans space-y-6 min-w-0 w-full overflow-x-hidden">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 p-5 sm:p-6 rounded-2xl sm:rounded-3xl text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-w-0 w-full overflow-hidden">
        <div>
          <h2 className="font-display font-extrabold text-2xl mt-1 text-white">Candidate Registration Portal</h2>
          <p className="text-emerald-200/80 text-xs mt-0.5">Register candidates rapidly in 1 single view with instant Chest Number assignment.</p>
        </div>

        {user.role === UserRole.UNIT_TEAM_LEADER && (
          <div className="bg-emerald-900/60 border border-emerald-700/50 px-4 py-2 rounded-2xl font-mono text-xs font-bold text-emerald-200">
            {entityLabel}: {units.find(u => u.id === user.assignedUnitId)?.name || 'Assigned Unit'}
          </div>
        )}
      </div>

      {/* Alert Messages */}
      {message && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-md ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-rose-50 text-rose-900 border-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? <Check className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            <span className="text-xs font-bold font-mono">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 rounded-lg hover:bg-black/5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Single-Page Registration Form */}
      <form onSubmit={handleFinalSubmit} className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 space-y-6">

        {/* SECTION 1: CANDIDATE & UNIT IDENTIFICATION */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            <h3 className="font-display font-extrabold text-slate-800 text-sm uppercase tracking-wider">1. Candidate Basic Details</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Unit / Team Selector */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                {entityLabel} Name <span className="text-rose-500">*</span>
              </label>
              <select
                disabled={user.role === UserRole.UNIT_TEAM_LEADER}
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Select {entityLabel}</option>
                {units.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                ))}
              </select>
            </div>

            {/* Candidate Name */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Candidate Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                ref={fullNameRef}
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    dobDayRef.current?.focus();
                    dobDayRef.current?.select();
                  }
                }}
                placeholder="e.g. Muhammed Rayan"
                className="mt-1 block w-full px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            {/* Date of Birth: 3 Distinct Numeric Boxes (DD / MM / YYYY) */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Date of Birth (DD / MM / YYYY) {criteriaMode === 'dob' ? <span className="text-rose-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  ref={dobDayRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="DD"
                  value={dobDay}
                  onChange={(e) => handleDobDayChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      dobMonthRef.current?.focus();
                      dobMonthRef.current?.select();
                    }
                  }}
                  className="w-16 px-3 py-2 border border-slate-300 rounded-xl text-center text-xs font-mono font-extrabold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required={criteriaMode === 'dob'}
                />
                <span className="text-slate-400 font-bold">/</span>
                <input
                  ref={dobMonthRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="MM"
                  value={dobMonth}
                  onChange={(e) => handleDobMonthChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      dobYearRef.current?.focus();
                      dobYearRef.current?.select();
                    }
                  }}
                  className="w-16 px-3 py-2 border border-slate-300 rounded-xl text-center text-xs font-mono font-extrabold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required={criteriaMode === 'dob'}
                />
                <span className="text-slate-400 font-bold">/</span>
                <input
                  ref={dobYearRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="YYYY"
                  value={dobYear}
                  onChange={(e) => handleDobYearChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      dobYearRef.current?.blur();
                    }
                  }}
                  className="w-24 px-3 py-2 border border-slate-300 rounded-xl text-center text-xs font-mono font-extrabold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required={criteriaMode === 'dob'}
                />
              </div>
            </div>

            {/* Class / Grade Field */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Class / Grade {criteriaMode === 'class' ? <span className="text-rose-500">*</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
              </label>
              <select
                value={candidateClass}
                onChange={(e) => setCandidateClass(e.target.value)}
                required={criteriaMode === 'class'}
                className="mt-1 block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="">Select Class</option>
                {availableClasses.map((cls, idx) => (
                  <option key={idx} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Gender Selection */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Gender</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { key: Gender.MALE, label: 'Male' },
                  { key: Gender.FEMALE, label: 'Female' }
                ].map(g => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setGender(g.key)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      gender === g.key ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: CATEGORY SELECTOR (All categories fully available) */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-purple-600" />
              <span>2. Select Category</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {categories.map(cat => {
              const isSelected = selectedCategoryId === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`p-4 rounded-2xl border text-center transition-all relative overflow-hidden cursor-pointer ${
                    isSelected
                      ? 'bg-purple-900 text-white border-purple-900 shadow-md ring-2 ring-purple-500'
                      : 'bg-purple-50/50 text-purple-950 border-purple-200 hover:border-purple-400'
                  }`}
                >
                  <span className="font-display font-extrabold text-sm block">{cat.name}</span>
                  {isSelected && (
                    <span className="absolute top-2 right-2 bg-purple-500 text-white p-0.5 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 3: COMPETITIONS CHECKLIST FOR SELECTED CATEGORY */}
        {selectedCategoryId && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h3 className="font-display font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                <span>3. Select Competition Programs</span>
              </h3>
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-lg">
                  Individual: {competitions.filter(c => selectedComps.includes(c.id) && c.participationType === ParticipationType.INDIVIDUAL).length} / {eventSettings?.maxIndividualEvents || 3}
                </span>
                <span className="bg-purple-100 text-purple-800 px-2.5 py-1 rounded-lg">
                  Group: {competitions.filter(c => selectedComps.includes(c.id) && c.participationType === ParticipationType.GROUP).length} / {eventSettings?.maxGroupEvents || 2}
                </span>
              </div>
            </div>

            {filteredCompetitions.length === 0 ? (
              <div className="p-6 text-center text-slate-400 font-mono text-xs bg-slate-50 rounded-2xl border">
                No active competition programs configured for this category yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {filteredCompetitions.map(comp => {
                  const isChecked = selectedComps.includes(comp.id);

                  return (
                    <div
                      key={comp.id}
                      onClick={() => handleCompToggle(comp.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isChecked
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all ${
                          isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-slate-50'
                        }`}>
                          {isChecked && <Check className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <span className="font-bold text-xs block">{comp.name}</span>
                          <div className="flex gap-2 mt-0.5 font-mono text-[9px] font-bold">
                            <span className={`uppercase px-1.5 py-0.2 rounded ${
                              comp.participationType === ParticipationType.INDIVIDUAL ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                            }`}>
                              {comp.participationType}
                            </span>
                            <span className="text-slate-400 uppercase">{comp.stageType.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>

                      {comp.duration > 0 && (
                        <span className="font-mono text-[10px] text-slate-400 font-bold shrink-0">{comp.duration}m</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUBMIT ACTION BUTTON */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-[11px] text-slate-400 font-mono">
            {selectedComps.length > 0 
              ? `Ready to register with ${selectedComps.length} program(s) selected.` 
              : 'Ready to register candidate (competition programs can also be assigned later).'
            }
          </div>

          <button
            type="submit"
            disabled={submitting || !isFormValid}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-display font-extrabold text-sm shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Registering Candidate...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Register Candidate & Generate Chest No.</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
