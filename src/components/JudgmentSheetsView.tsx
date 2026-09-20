import React, { useState, useEffect } from 'react';
import {
  Scale, RefreshCw, Printer, Search, ChevronDown,
  CheckCircle, Clock, AlertTriangle, FileText, Check, Save, Lock, Plus,
  Trophy, X
} from 'lucide-react';
import { User, UserRole, JudgmentSheetStatus, JudgeScoreStatus } from '../types';

interface JudgmentSheetsViewProps {
  user: User;
  token: string;
  eventSettings?: any;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  locked: 'bg-blue-100 text-blue-700'
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  locked: 'Locked'
};

const computeGrade = (mark: number, isGroup: boolean): string => {
  const m = Math.round(Number(mark) || 0);
  if (m <= 0) return '';
  if (isGroup) {
    if (m >= 95) return 'A+';
    if (m >= 80) return 'A';
    if (m >= 55) return 'B';
    if (m >= 30) return 'C';
    return '';
  } else {
    if (m >= 95) return 'A+';
    if (m >= 85) return 'A';
    if (m >= 70) return 'B';
    if (m >= 50) return 'C';
    return '';
  }
};

const computePoints = (mark: number, isGroup: boolean, eventSettings?: any, rank?: number): number => {
  const gradeSystemEnabled = eventSettings?.gradeSystemEnabled !== false;
  const m = Math.round(Number(mark) || 0);

  if (gradeSystemEnabled) {
    if (m <= 0) return 0;
    if (isGroup) {
      if (m >= 95) return 20;
      if (m >= 90) return 19;
      if (m >= 85) return 18;
      if (m >= 80) return 17;
      if (m >= 75) return 16;
      if (m >= 70) return 15;
      if (m >= 65) return 14;
      if (m >= 55) return 13;
      if (m >= 50) return 12;
      if (m >= 40) return 11;
      if (m >= 30) return 10;
      return 5;
    } else {
      if (m >= 95) return 10;
      if (m >= 90) return 9;
      if (m >= 85) return 8;
      if (m >= 80) return 7;
      if (m >= 75) return 6;
      if (m >= 70) return 5;
      if (m >= 65) return 4;
      if (m >= 55) return 3;
      if (m >= 50) return 2;
      if (m >= 40) return 1;
      return 0;
    }
  }

  // Fallback: Rank-based points (when Grade Pointing System is disabled)
  if (!rank || rank > 10) return 0;
  const settingsKey = `globalPointsRank${rank}`;
  const settingsVal = eventSettings?.[settingsKey];
  if (settingsVal !== undefined && settingsVal !== null) {
    const val = Number(settingsVal);
    if (!isNaN(val)) return val;
  }
  const defaultMap: Record<number, number> = { 1: 20, 2: 14, 3: 7, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
  return defaultMap[rank] || 0;
};

export default function JudgmentSheetsView({ user, token, eventSettings }: JudgmentSheetsViewProps) {
  const [sheets, setSheets] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Workflow state
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('');
  const [currentSheet, setCurrentSheet] = useState<any>(null);
  const [currentScores, setCurrentScores] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'dashboard' | 'generate' | 'enter' | 'print' | 'print-winners'>('dashboard');
  const [printType, setPrintType] = useState<'blank' | 'filled'>('blank');

  // Preview Champions state
  const [showChampionsModal, setShowChampionsModal] = useState(false);
  const [championsData, setChampionsData] = useState<any[]>([]);
  const [championsLoading, setChampionsLoading] = useState(false);

  // Print Winners state
  const [winnersData, setWinnersData] = useState<any[]>([]);
  const [winnersLoading, setWinnersLoading] = useState(false);

  const fetchChampionsPreview = async () => {
    setChampionsLoading(true);
    setShowChampionsModal(true);
    try {
      const res = await fetch(`/api/judgment-sheets/preview-champions?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to calculate champion preview');
      setChampionsData(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setChampionsLoading(false);
    }
  };

  const openWinnersPrint = async () => {
    setWinnersLoading(true);
    try {
      const res = await fetch(`/api/judgment-sheets/winners-list?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch locked winners list');
      setWinnersData(data);
      setViewMode('print-winners');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setWinnersLoading(false);
    }
  };

  // Active Judge slot toggle (for judge users evaluating as Judge 1 or Judge 2)
  const [activeJudgeNumber, setActiveJudgeNumber] = useState<number>(1);

  // Marks entry state
  const [savingScores, setSavingScores] = useState(false);
  const [actionLoading, setActionLoading] = useState<'saving' | 'locking' | 'unlocking' | 'publishing' | null>(null);

  const fetchData = async () => {
    try {
      const ts = Date.now();
      const [sheetsRes, statsRes, catRes, compRes] = await Promise.all([
        fetch(`/api/judgment-sheets?t=${ts}`, { credentials: 'include' }),
        fetch(`/api/judgment-sheets/stats?t=${ts}`, { credentials: 'include' }),
        fetch(`/api/categories?t=${ts}`, { credentials: 'include' }),
        fetch(`/api/competitions?t=${ts}`, { credentials: 'include' })
      ]);
      if (sheetsRes.ok) setSheets(await sheetsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (catRes.ok) setCategories(await catRes.json());
      if (compRes.ok) setCompetitions(await compRes.json());
    } catch (e) {
      console.error('Error fetching judgment sheets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleGenerateSheet = async () => {
    if (!selectedCompetitionId) return;
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch('/api/judgment-sheets/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId: selectedCompetitionId })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        fetchData();
        loadSheet(data.sheet.id);
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to generate judgment sheet' });
    } finally {
      setGenerating(false);
    }
  };

  const loadSheet = async (sheetId: string) => {
    try {
      const ts = Date.now();
      const res = await fetch(`/api/judgment-sheets/${sheetId}?t=${ts}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCurrentSheet(data.sheet);
        setCurrentScores(data.scores);
        if (data.sheet.assignedJudgeNumber) {
          setActiveJudgeNumber(data.sheet.assignedJudgeNumber);
        }
        setViewMode('enter');
      }
    } catch (e) { console.error(e); }
  };

  const handleCriteriaChange = (scoreId: string, judgeNum: number, critKey: 'c1' | 'c2' | 'c3' | 'c4', value: string) => {
    let isEmpty = value.trim() === '';
    let numVal = parseFloat(value);
    if (!isEmpty && (isNaN(numVal) || numVal < 0)) numVal = 0;
    if (numVal > 25) numVal = 25;

    setCurrentScores(prev => prev.map(s => {
      if (s.id !== scoreId) return s;

      let newJudgeScores = [...s.judgeScores];
      let jIdx = newJudgeScores.findIndex((j: any) => j.judgeNumber === judgeNum);

      if (jIdx < 0) {
        if (isEmpty) return s; // Nothing to clear
        newJudgeScores.push({ judgeNumber: judgeNum });
        jIdx = newJudgeScores.length - 1;
      }

      const existingJm = { ...newJudgeScores[jIdx] };

      if (isEmpty) {
        delete existingJm[critKey];
      } else {
        existingJm[critKey] = numVal;
      }

      // Auto sum c1+c2+c3+c4 if any is entered
      const c1 = existingJm.c1 !== undefined ? existingJm.c1 : 0;
      const c2 = existingJm.c2 !== undefined ? existingJm.c2 : 0;
      const c3 = existingJm.c3 !== undefined ? existingJm.c3 : 0;
      const c4 = existingJm.c4 !== undefined ? existingJm.c4 : 0;

      if (existingJm.c1 === undefined && existingJm.c2 === undefined && existingJm.c3 === undefined && existingJm.c4 === undefined) {
        delete existingJm.mark;
      } else {
        const autoSum = c1 + c2 + c3 + c4;
        existingJm.mark = Math.min(Math.max(autoSum, 0), 100);
      }

      if (existingJm.mark === undefined) {
        newJudgeScores.splice(jIdx, 1);
      } else {
        newJudgeScores[jIdx] = existingJm;
      }

      const nonZeroMarks = newJudgeScores.filter((j: any) => typeof j.mark === 'number' && !Number.isNaN(j.mark) && j.mark > 0);
      const sumMarks = newJudgeScores.reduce((sum, j) => sum + (typeof j.mark === 'number' && !Number.isNaN(j.mark) ? j.mark : 0), 0);
      const activeJudgesCount = nonZeroMarks.length > 0 ? nonZeroMarks.length : 1;
      const avg = sumMarks / activeJudgesCount;

      return {
        ...s,
        judgeScores: newJudgeScores,
        totalMark: sumMarks,
        averageMark: Math.round(avg * 100) / 100
      };
    }));
  };

  const handleScoreChange = (scoreId: string, judgeNum: number, value: string) => {
    let isEmpty = value.trim() === '';
    let numVal = parseFloat(value);
    if (!isEmpty && (isNaN(numVal) || numVal < 0)) numVal = 0;
    const maxMarksVal = currentSheet?.maxMarks || 100;
    if (numVal > maxMarksVal) numVal = maxMarksVal;

    setCurrentScores(prev => prev.map(s => {
      if (s.id !== scoreId) return s;

      let newJudgeScores = [...s.judgeScores];
      const jIdx = newJudgeScores.findIndex((j: any) => j.judgeNumber === judgeNum);

      if (isEmpty) {
        if (jIdx >= 0) {
          newJudgeScores.splice(jIdx, 1);
        }
      } else {
        if (jIdx >= 0) {
          newJudgeScores[jIdx].mark = numVal;
        } else {
          newJudgeScores.push({ judgeNumber: judgeNum, mark: numVal });
        }
      }

      // Calculate frontend total and average based on non-zero judge marks
      const nonZeroMarks = newJudgeScores.filter((j: any) => typeof j.mark === 'number' && !Number.isNaN(j.mark) && j.mark > 0);
      const sumMarks = newJudgeScores.reduce((sum, j) => sum + (typeof j.mark === 'number' && !Number.isNaN(j.mark) ? j.mark : 0), 0);
      const activeJudgesCount = nonZeroMarks.length > 0 ? nonZeroMarks.length : 1;
      const avg = sumMarks / activeJudgesCount;

      return {
        ...s,
        judgeScores: newJudgeScores,
        totalMark: sumMarks,
        averageMark: Math.round(avg * 100) / 100
      };
    }));
  };

  const handleStatusChange = (scoreId: string, status: string) => {
    setCurrentScores(prev => prev.map(s => {
      if (s.id !== scoreId) return s;
      return { ...s, status };
    }));
  };

  const handleSaveScores = async () => {
    if (!currentSheet || actionLoading) return;
    setSavingScores(true);
    setActionLoading('saving');
    setMessage(null);
    try {
      const payload = currentScores.map(s => ({
        scoreId: s.id,
        judgeScores: s.judgeScores,
        status: s.status,
        remarks: s.remarks
      }));

      const res = await fetch(`/api/judgment-sheets/${currentSheet.id}/scores`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: payload })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        await loadSheet(currentSheet.id);
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save scores' });
    } finally {
      setSavingScores(false);
      setActionLoading(null);
    }
  };

  const handleLockResults = async () => {
    if (!currentSheet || actionLoading) return;
    if (!confirm('Are you sure you want to lock these results? This action cannot be undone, and scores will no longer be editable.')) return;

    setActionLoading('locking');
    try {
      const res = await fetch(`/api/judgment-sheets/${currentSheet.id}/lock`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        await loadSheet(currentSheet.id);
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to lock results' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublishResults = async () => {
    if (!currentSheet || actionLoading) return;

    setActionLoading('publishing');
    try {
      const res = await fetch(`/api/judgment-sheets/${currentSheet.id}/calculate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        await loadSheet(currentSheet.id);
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to publish results' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlockSheet = async () => {
    if (!currentSheet || actionLoading) return;
    if (!confirm('Unlock this judgment sheet so scores can be edited again?')) return;
    setActionLoading('unlocking');
    try {
      const res = await fetch(`/api/judgment-sheets/${currentSheet.id}/unlock`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: data.message });
        await loadSheet(currentSheet.id);
        await fetchData();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to unlock sheet' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleLockAndPublish = async () => {
    if (!currentSheet || actionLoading) return;
    if (!confirm('Are you sure you want to lock and publish these results immediately? Scores will no longer be editable and results will be visible.')) return;

    setSavingScores(true);
    setActionLoading('publishing');
    setMessage(null);
    try {
      // 1. Save scores
      const payload = currentScores.map(s => ({
        scoreId: s.id,
        judgeScores: s.judgeScores,
        status: s.status,
        remarks: s.remarks
      }));
      const saveRes = await fetch(`/api/judgment-sheets/${currentSheet.id}/scores`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores: payload })
      });
      if (!saveRes.ok) throw new Error((await saveRes.json()).error || 'Failed to save scores');

      // 2. Lock sheet
      const lockRes = await fetch(`/api/judgment-sheets/${currentSheet.id}/lock`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!lockRes.ok) throw new Error((await lockRes.json()).error || 'Failed to lock results');

      // 3. Publish results
      const pubRes = await fetch(`/api/judgment-sheets/${currentSheet.id}/calculate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!pubRes.ok) throw new Error((await pubRes.json()).error || 'Failed to publish results');

      const data = await pubRes.json();
      setMessage({ type: 'success', text: data.message });
      await loadSheet(currentSheet.id);
      await fetchData();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message || 'Failed to lock and publish' });
    } finally {
      setSavingScores(false);
      setActionLoading(null);
    }
  };

  const isJudge = user.role === UserRole.JUDGE;
  const isAdmin = user.role === UserRole.SUPER_ADMIN;
  const isResultManager = user.role === UserRole.RESULT_MANAGER;
  const canGenerate = isAdmin || user.role === UserRole.SECTOR_TEAM || isResultManager;
  const canEditScores = isAdmin || user.role === UserRole.SECTOR_TEAM || isJudge || isResultManager;

  const filteredCompetitions = selectedCategoryId
    ? competitions.filter((c: any) => c.categoryId === selectedCategoryId && c.active)
    : [];

  // Check which competitions already have sheets
  const compWithSheets = new Set(sheets.map((s: any) => s.competitionId));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" /></div>;
  }

  if (viewMode === 'print' && currentSheet) {
    return (
      <div className="print-sheet bg-white p-8 max-w-[210mm] mx-auto text-black" id="judgment-sheet-print">
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
          <h2 className="text-lg font-normal text-slate-600 mt-1">Judgement Sheet</h2>
        </div>

        {/* Details Row */}
        <div className="flex justify-between items-start mb-6 text-[15px]">
          <div className="flex-1 font-bold">Category: {currentSheet.categoryName}</div>
          <div className="flex-1 text-center font-bold px-2 whitespace-pre-wrap">Program: {currentSheet.competitionName}</div>
          <div className="flex-1 text-right font-bold">Individual: {currentSheet.participationType === 'individual' ? 'Yes' : 'No'}</div>
        </div>

        {/* Table */}
        <table className="w-full text-[15px] border-collapse border border-black table-fixed">
          <thead>
            <tr>
              <th className="border border-black px-4 py-3 text-center font-bold w-24 align-middle" rowSpan={2}>Code Letter</th>
              <th className="border border-black px-4 py-2 text-center font-bold align-middle" colSpan={5}>Mark</th>
              <th className="border border-black px-4 py-3 text-center font-bold w-24 align-middle" rowSpan={2}>Average</th>
              <th className="border border-black px-4 py-3 text-center font-bold w-48 align-middle" rowSpan={2}>Comments</th>
            </tr>
            <tr>
              <th className="border border-black h-4 w-10"></th>
              <th className="border border-black h-4 w-10"></th>
              <th className="border border-black h-4 w-10"></th>
              <th className="border border-black h-4 w-10"></th>
              <th className="border border-black h-4 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {currentScores.map((s: any) => (
              <tr key={s.id}>
                <td className="border border-black px-3 py-6 text-center font-bold">{s.codeLetter}</td>

                {[...Array(5)].map((_, i) => {
                  const jm = s.judgeScores.find((x: any) => x.judgeNumber === i + 1);
                  return (
                    <td key={`v${i}`} className="border border-black px-1 py-6 text-center">
                      {(printType === 'filled' && s.status === JudgeScoreStatus.PARTICIPATED && jm) ? jm.mark : ''}
                    </td>
                  );
                })}

                <td className="border border-black px-3 py-6 text-center">
                  {(printType === 'filled' && s.status === JudgeScoreStatus.PARTICIPATED) ? (s.averageMark !== undefined ? s.averageMark : '') : ''}
                </td>

                <td className="border border-black px-3 py-6 text-left">
                  {(printType === 'filled') ? (s.remarks || '') : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex flex-col items-start mt-16 text-[15px] font-bold">
          <div className="mb-8">Judge Name</div>
          <div>Signature</div>
        </div>

        <div className="mt-16 text-[11px] text-black flex justify-between">
          <div>Copyright © 2026-2027 {eventSettings?.campusName || eventSettings?.sectorName || 'Campus'}. All rights reserved. Developed by Zenith Software.</div>
          <div></div>
        </div>

        <div className="mt-6 print:hidden no-print">
          <button onClick={() => setViewMode('enter')} className="px-4 py-2 bg-slate-600 text-white rounded-lg text-sm mr-2">← Back to Editor</button>
          <button onClick={() => window.print()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm">🖨 Print {printType === 'blank' ? 'Blank' : 'Filled'} Sheet</button>
        </div>
      </div>
    );
  }

  if (viewMode === 'print-winners') {
    return (
      <div className="bg-white min-h-screen p-4 sm:p-8 max-w-[210mm] mx-auto text-black font-sans">
        {/* Print Controls (Hidden when printing) */}
        <div className="mb-6 flex justify-between items-center print:hidden no-print border-b pb-4">
          <button
            onClick={() => setViewMode('dashboard')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
          >
            ← Back to Judgment Sheets
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print Master Winners Sheet
            </button>
          </div>
        </div>

        {/* Master Print Document */}
        <div id="master-winners-print">
          {/* Header */}
          <div className="border-b-2 border-black pb-4 mb-4 text-center">
            <h1 className="text-xl font-black uppercase tracking-wider">
              {eventSettings?.festivalName || 'RENDEZVOUS 26'}
            </h1>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mt-0.5">
              {eventSettings?.campusName || eventSettings?.sectorName || 'Imam Rabbani Life Festival'}
            </p>
            <div className="mt-2 inline-block bg-black text-white text-[11px] font-bold px-3 py-0.5 uppercase tracking-widest rounded">
              Official Stage Announcement Winners Sheet
            </div>
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              Printed: {new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • Total Competitions: {winnersData.length}
            </p>
          </div>

          {/* Table of Winners */}
          <div className="space-y-4">
            {winnersData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-mono text-xs">
                No evaluated or locked competitions found with 1st, 2nd, or 3rd place winners.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 font-mono text-[10px] uppercase font-bold text-slate-700">
                    <th className="p-2 border-r border-slate-300 w-10 text-center">#</th>
                    <th className="p-2 border-r border-slate-300 w-44">Competition</th>
                    <th className="p-2 border-r border-slate-300">1st Place 🥇</th>
                    <th className="p-2 border-r border-slate-300">2nd Place 🥈</th>
                    <th className="p-2">3rd Place 🥉</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {winnersData.map((item: any, idx: number) => {
                    const r1 = item.winners.filter((w: any) => w.rank === 1);
                    const r2 = item.winners.filter((w: any) => w.rank === 2);
                    const r3 = item.winners.filter((w: any) => w.rank === 3);

                    const renderWinnerCell = (winners: any[]) => {
                      if (!winners || winners.length === 0) {
                        return <span className="text-slate-300 font-mono text-[10px]">—</span>;
                      }
                      return (
                        <div className="space-y-1">
                          {winners.map((w: any, wIdx: number) => (
                            <div key={wIdx} className="leading-tight">
                              <div className="font-bold text-slate-900 text-xs">
                                {w.name} {w.chestNumber && w.chestNumber !== '—' && <span className="font-mono text-slate-500 text-[10px]">({w.chestNumber})</span>}
                              </div>
                              <div className="text-[10px] text-slate-600 font-medium">
                                <span className="font-semibold text-slate-800">{w.unitName}</span> • <span className="font-mono">{w.mark} mks</span> {w.grade && w.grade !== '—' && <span className="font-bold">({w.grade})</span>} {w.points != null && <span className="text-slate-500">[{w.points} pts]</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    };

                    return (
                      <tr key={item.competitionId} className="break-inside-avoid hover:bg-slate-50/50">
                        <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-500 text-[10px]">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200 align-top">
                          <div className="font-bold text-slate-900 text-xs">{item.competitionName}</div>
                          <div className="text-[9px] font-mono text-slate-500 uppercase mt-0.5">
                            {item.categoryName} • {(item.stageType || 'on_stage').replace('_', ' ')}
                          </div>
                          <div className="mt-0.5">
                            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                              item.isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {item.isPublished ? 'Announced' : 'Locked'}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 border-r border-slate-200 align-top bg-amber-50/20">
                          {renderWinnerCell(r1)}
                        </td>
                        <td className="p-2 border-r border-slate-200 align-top bg-slate-50/30">
                          {renderWinnerCell(r2)}
                        </td>
                        <td className="p-2 align-top bg-orange-50/20">
                          {renderWinnerCell(r3)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer for Announcers */}
          <div className="mt-8 pt-4 border-t border-slate-300 text-[10px] text-slate-500 flex justify-between items-center font-mono">
            <div>Verified by Festival Controller / Scoring Committee</div>
            <div>Stage Announcer Signature: __________________</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Scale className="h-7 w-7 text-indigo-500" />
            Judgment Sheets
          </h1>
          <p className="text-sm text-slate-500 mt-1">Anonymous evaluation and scoring</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewMode !== 'dashboard' && (
            <button onClick={() => setViewMode('dashboard')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition">
              ← Back to Dashboard
            </button>
          )}
          {!isJudge && viewMode === 'dashboard' && (
            <>
              <button
                onClick={fetchChampionsPreview}
                disabled={championsLoading}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-sm shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                title="View Internal Live House Points & Champions Preview"
              >
                <Trophy className="h-4 w-4 text-slate-950" />
                <span>{championsLoading ? 'Loading...' : 'Preview Champions'}</span>
              </button>

              <button
                onClick={openWinnersPrint}
                disabled={winnersLoading}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-sm shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
                title="Print 1st, 2nd, and 3rd rank winners across all locked competitions"
              >
                <Printer className="h-4 w-4 text-slate-200" />
                <span>{winnersLoading ? 'Loading...' : 'Print Winners'}</span>
              </button>
            </>
          )}
          {canGenerate && viewMode === 'dashboard' && (
            <button onClick={() => setViewMode('generate')} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition cursor-pointer">
              Generate New Sheet
            </button>
          )}
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
          {!isJudge && stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg"><FileText className="h-5 w-5 text-indigo-600" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stats.totalSheets}</p>
                    <p className="text-xs text-slate-500">Total Sheets</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stats.inProgress}</p>
                    <p className="text-xs text-slate-500">In Progress</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg"><CheckCircle className="h-5 w-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stats.completed}</p>
                    <p className="text-xs text-slate-500">Completed</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg"><Lock className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stats.locked}</p>
                    <p className="text-xs text-slate-500">Locked / Resulted</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sheets List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">Active Judgment Sheets</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Competition</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Category</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Judges</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Entries</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Status</th>
                    <th className="text-left px-4 py-2 font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sheets.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-slate-400">No judgment sheets found</td></tr>
                  ) : (
                    sheets.map((s: any) => (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-medium text-slate-800">{s.competitionName}</td>
                        <td className="px-4 py-3 text-slate-600">{s.categoryName}</td>
                        <td className="px-4 py-3">{s.numJudges}</td>
                        <td className="px-4 py-3">{s.scoresCount}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${s.publishedToResults ? 'bg-purple-100 text-purple-700' : STATUS_COLORS[s.status]}`}>
                            {s.publishedToResults ? 'Published' : STATUS_LABELS[s.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => loadSheet(s.id)}
                            className="text-indigo-600 hover:text-indigo-700 font-medium text-xs flex items-center gap-1"
                          >
                            Open Sheet →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {viewMode === 'generate' && canGenerate && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm max-w-2xl">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-indigo-500" /> Generate New Judgment Sheet
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={selectedCategoryId}
                onChange={e => { setSelectedCategoryId(e.target.value); setSelectedCompetitionId(''); }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Competition</label>
              <select
                value={selectedCompetitionId}
                onChange={e => setSelectedCompetitionId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                disabled={!selectedCategoryId}
              >
                <option value="">Select Competition</option>
                {filteredCompetitions.map((c: any) => (
                  <option key={c.id} value={c.id} disabled={compWithSheets.has(c.id)}>
                    {c.name} {compWithSheets.has(c.id) ? '(Sheet already exists)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-indigo-50 rounded-lg text-sm text-indigo-800 border border-indigo-100">
              <strong>Prerequisite:</strong> Green Room codes must be generated for this competition before creating a Judgment Sheet.
            </div>

            <div className="pt-2">
              <button
                onClick={handleGenerateSheet}
                disabled={generating || !selectedCompetitionId}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {generating ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                Create Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'enter' && currentSheet && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{currentSheet.competitionName}</h2>
              <p className="text-sm text-slate-500">{currentSheet.categoryName} • Max Marks: {currentSheet.maxMarks}</p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${currentSheet.publishedToResults ? 'bg-purple-100 text-purple-700' : STATUS_COLORS[currentSheet.status]}`}>
                {currentSheet.publishedToResults ? 'Published' : STATUS_LABELS[currentSheet.status]}
              </span>

              {!isJudge && (
                <div className="relative group inline-block">
                  <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium flex items-center gap-1 transition">
                    <Printer className="h-4 w-4" /> Print Form <ChevronDown className="h-3 w-3" />
                  </button>
                  <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 flex flex-col overflow-hidden">
                    <button onClick={() => { setPrintType('blank'); setViewMode('print'); }} className="px-4 py-2 text-left text-sm hover:bg-slate-50 transition">Print Blank Sheet</button>
                    <button onClick={() => { setPrintType('filled'); setViewMode('print'); }} className="px-4 py-2 text-left text-sm hover:bg-slate-50 transition border-t border-slate-100">Print Filled Sheet</button>
                  </div>
                </div>
              )}

              {isJudge ? (
                <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 shadow-sm">
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Evaluating as:</span>
                  <span className="px-2.5 py-1 bg-indigo-600 text-white rounded font-mono font-bold text-xs flex items-center gap-1.5 shadow-inner">
                    <Lock className="w-3 h-3 text-indigo-200" />
                    Judge {activeJudgeNumber} (Auto-Assigned & Locked)
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 font-mono">Judge Slots:</span>
                  {[...Array(currentSheet.numJudges || 2)].map((_, i) => {
                    const slotNum = i + 1;
                    const claimedInfo = currentSheet.claimedJudges?.[slotNum];
                    return (
                      <button
                        key={`judge_slot_${slotNum}`}
                        onClick={() => setActiveJudgeNumber(slotNum)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 font-mono ${
                          activeJudgeNumber === slotNum
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-700 hover:bg-slate-200/80 bg-white border border-slate-200/60'
                        }`}
                        title={claimedInfo ? `Judge ${slotNum} is assigned to user: ${claimedInfo.username}` : `Judge ${slotNum} is unclaimed`}
                      >
                        <span>Judge {slotNum}</span>
                        {claimedInfo ? (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            activeJudgeNumber === slotNum ? 'bg-emerald-500/30 text-white border-emerald-300/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            @{claimedInfo.username}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400 font-normal italic">(Unassigned)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {canEditScores && currentSheet.status !== JudgmentSheetStatus.LOCKED && (
                <button
                  onClick={handleSaveScores}
                  disabled={!!actionLoading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-1 transition min-h-[44px]"
                >
                  {actionLoading === 'saving' ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" /> Save Draft
                    </>
                  )}
                </button>
              )}

              {canGenerate && currentSheet.status !== JudgmentSheetStatus.LOCKED && (
                <>
                  <button
                    onClick={handleLockResults}
                    disabled={!!actionLoading}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-1 transition shadow-sm min-h-[44px]"
                  >
                    {actionLoading === 'locking' ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Locking...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" /> Lock
                      </>
                    )}
                  </button>
                  <button
                    onClick={handlePublishResults}
                    disabled={!!actionLoading}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-1 transition shadow-sm min-h-[44px]"
                  >
                    {actionLoading === 'publishing' ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Publishing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" /> Publish Result
                      </>
                    )}
                  </button>
                </>
              )}

              {canGenerate && (currentSheet.status === JudgmentSheetStatus.LOCKED || currentSheet.publishedToResults) && (
                <>
                  <button
                    onClick={handleUnlockSheet}
                    disabled={!!actionLoading}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-1 transition min-h-[44px] cursor-pointer shadow-sm"
                  >
                    {actionLoading === 'unlocking' ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Unlocking...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" /> Unlock Sheet
                      </>
                    )}
                  </button>
                  <button
                    onClick={handlePublishResults}
                    disabled={!!actionLoading}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-1 transition min-h-[44px] cursor-pointer shadow-sm"
                  >
                    {actionLoading === 'publishing' ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" /> Publishing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4" /> Publish Result
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {(currentSheet.status === JudgmentSheetStatus.LOCKED || currentSheet.publishedToResults) && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-lg text-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-600" />
                <span>This sheet is locked/published. Scores can no longer be edited unless unlocked.</span>
              </div>
              {canGenerate && (
                <button
                  onClick={handleUnlockSheet}
                  disabled={!!actionLoading}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm shrink-0"
                >
                  {actionLoading === 'unlocking' ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Unlocking...
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" /> Unlock Sheet Now
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {!isJudge && currentSheet.status !== JudgmentSheetStatus.LOCKED && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs flex items-center gap-2 font-medium">
              <span>⚡ <strong>Admin Review:</strong> Multiple judges enter marks in their portal. Below shows each judge's mark and the calculated <strong>Average Score</strong>. Once verified, click <strong>Lock Results</strong> and <strong>Publish to Results</strong>.</span>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-center px-3 py-3 font-semibold text-slate-600 w-16">Code</th>
                    {!isJudge && (
                      <>
                        <th className="text-left px-3 py-3 font-semibold text-slate-600 w-24">Chest #</th>
                        <th className="text-left px-3 py-3 font-semibold text-slate-600 min-w-[150px]">Participant</th>
                      </>
                    )}
                    <th className="text-center px-3 py-3 font-semibold text-slate-600 w-28">Status</th>

                    {isJudge ? (
                      <>
                        <th className="text-center px-2 py-3 font-semibold text-slate-600 w-20">Crit 1 <span className="text-[9px] text-slate-400 font-normal block">(Max 25)</span></th>
                        <th className="text-center px-2 py-3 font-semibold text-slate-600 w-20">Crit 2 <span className="text-[9px] text-slate-400 font-normal block">(Max 25)</span></th>
                        <th className="text-center px-2 py-3 font-semibold text-slate-600 w-20">Crit 3 <span className="text-[9px] text-slate-400 font-normal block">(Max 25)</span></th>
                        <th className="text-center px-2 py-3 font-semibold text-slate-600 w-20">Crit 4 <span className="text-[9px] text-slate-400 font-normal block">(Max 25)</span></th>
                        <th className="text-center px-3 py-3 font-semibold text-indigo-900 bg-indigo-50/50 w-28">Total Mark <span className="text-[9px] text-indigo-600 font-normal block">(Max 100)</span></th>
                      </>
                    ) : (
                      <>
                        {[...Array(currentSheet.numJudges || 2)].map((_, i) => {
                          const slotNum = i + 1;
                          const claimedObj = currentSheet.claimedJudges?.[slotNum];
                          return (
                            <th key={`h${i}`} className="text-center px-3 py-2 font-semibold text-slate-600 w-28">
                              <span className="block">Judge {slotNum}</span>
                              {claimedObj ? (
                                <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block font-bold mt-0.5">
                                  @{claimedObj.username}
                                </span>
                              ) : (
                                <span className="text-[9px] font-mono text-slate-400 font-normal italic block mt-0.5">(Unassigned)</span>
                              )}
                            </th>
                          );
                        })}
                        <th className="text-center px-3 py-3 font-semibold text-slate-600 w-24">Avg Mark</th>
                      </>
                    )}

                    {!isJudge && (
                      <>
                        <th className="text-center px-2 py-3 font-semibold text-slate-600 w-20">Grade</th>
                        <th className="text-center px-2 py-3 font-semibold text-slate-600 w-24">Points</th>
                        <th className="text-center px-3 py-3 font-semibold text-slate-600 w-16">Rank</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {currentScores.map((s: any, sIdx: number) => {
                    const isParticipated = s.status === JudgeScoreStatus.PARTICIPATED || s.status === 'participated';
                    const isLocked = currentSheet.status === JudgmentSheetStatus.LOCKED;
                    const isGroupCompetition = String(currentSheet?.participationType).toLowerCase() === 'group' || (currentSheet as any)?.isGroup === true;

                    // Judge slot entry (dynamic based on activeJudgeNumber selection)
                    const judgeSlotNum = activeJudgeNumber;
                    const activeJudgeEntry = s.judgeScores.find((x: any) => x.judgeNumber === judgeSlotNum);

                    const nonZeroMarks = (s.judgeScores || []).filter((j: any) => typeof j.mark === 'number' && !Number.isNaN(j.mark) && j.mark > 0);
                    const sumMarks = (s.judgeScores || []).reduce((sum: number, jm: any) => sum + (typeof jm.mark === 'number' && !Number.isNaN(jm.mark) ? jm.mark : 0), 0);
                    const activeJudgesCount = nonZeroMarks.length > 0 ? nonZeroMarks.length : 1;
                    const calculatedAvg = Math.round((sumMarks / activeJudgesCount) * 100) / 100;
                    const displayAvg = (s.averageMark && s.averageMark > 0) ? s.averageMark : (sumMarks > 0 ? calculatedAvg : (s.averageMark ?? 0));

                    const displayGrade = isParticipated && displayAvg > 0 ? computeGrade(displayAvg, isGroupCompetition) : (s.grade || '');
                    const displayPoints = isParticipated && displayAvg > 0 ? computePoints(displayAvg, isGroupCompetition, eventSettings, s.rank) : (s.points ?? 0);

                    return (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                        <td className="px-3 py-2 text-center">
                          <span className="font-mono font-bold text-lg text-purple-700 bg-purple-50 px-2 py-1 rounded">{s.codeLetter}</span>
                        </td>

                        {!isJudge && (
                          <>
                            <td className="px-3 py-2 font-mono text-emerald-700">{s.chestNumber}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium text-slate-800 truncate max-w-[200px]">{s.participantName}</div>
                              <div className="text-xs text-slate-500 truncate max-w-[200px]">{s.unitName}</div>
                            </td>
                          </>
                        )}

                        <td className="px-3 py-2 text-center">
                          <select
                            value={s.status}
                            onChange={(e) => handleStatusChange(s.id, e.target.value)}
                            disabled={isLocked || !canEditScores}
                            className={`text-xs px-2 py-1 rounded border min-h-[44px] ${!isParticipated ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white border-slate-300'}`}
                          >
                            <option value={JudgeScoreStatus.PARTICIPATED}>Present</option>
                            <option value={JudgeScoreStatus.ABSENT}>Absent</option>
                            <option value={JudgeScoreStatus.DISQUALIFIED}>Disqualified</option>
                          </select>
                        </td>

                        {isJudge ? (
                          <>
                            <td className="px-1 py-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="25"
                                value={activeJudgeEntry?.c1 ?? ''}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleCriteriaChange(s.id, judgeSlotNum, 'c1', e.target.value)}
                                disabled={isLocked || !canEditScores || !isParticipated}
                                placeholder="0-25"
                                className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono font-medium text-xs focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 min-h-[44px]"
                              />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="25"
                                value={activeJudgeEntry?.c2 ?? ''}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleCriteriaChange(s.id, judgeSlotNum, 'c2', e.target.value)}
                                disabled={isLocked || !canEditScores || !isParticipated}
                                placeholder="0-25"
                                className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono font-medium text-xs focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 min-h-[44px]"
                              />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="25"
                                value={activeJudgeEntry?.c3 ?? ''}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleCriteriaChange(s.id, judgeSlotNum, 'c3', e.target.value)}
                                disabled={isLocked || !canEditScores || !isParticipated}
                                placeholder="0-25"
                                className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono font-medium text-xs focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 min-h-[44px]"
                              />
                            </td>
                            <td className="px-1 py-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="25"
                                value={activeJudgeEntry?.c4 ?? ''}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleCriteriaChange(s.id, judgeSlotNum, 'c4', e.target.value)}
                                disabled={isLocked || !canEditScores || !isParticipated}
                                placeholder="0-25"
                                className="w-14 px-1.5 py-1 text-center border border-slate-300 rounded font-mono font-medium text-xs focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 min-h-[44px]"
                              />
                            </td>
                            <td className="px-2 py-2 text-center bg-indigo-50/30">
                              <input
                                id={`input-judge-${judgeSlotNum}-score-${sIdx}`}
                                type="number"
                                min="0"
                                max={currentSheet.maxMarks}
                                value={activeJudgeEntry?.mark === 0 ? '' : (activeJudgeEntry?.mark ?? '')}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleScoreChange(s.id, judgeSlotNum, e.target.value)}
                                disabled={isLocked || !canEditScores || !isParticipated}
                                placeholder="0-100"
                                className="w-20 px-2 py-2 text-center border-2 border-indigo-300 focus:border-indigo-600 bg-white rounded-xl font-mono font-bold text-base focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 shadow-inner min-h-[44px]"
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            {[...Array(currentSheet.numJudges)].map((_, i) => {
                              const jm = s.judgeScores.find((x: any) => x.judgeNumber === i + 1);
                              return (
                                <td key={`j${i}`} className="px-2 py-2 text-center">
                                  <input
                                    id={`input-judge-${i + 1}-score-${sIdx}`}
                                    type="number"
                                    min="0"
                                    max={currentSheet.maxMarks}
                                    value={jm?.mark === 0 ? '' : (jm?.mark ?? '')}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleScoreChange(s.id, i + 1, e.target.value)}
                                    disabled={isLocked || !canEditScores || !isParticipated}
                                    className="w-16 px-2 py-1.5 text-center border border-slate-300 rounded font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 min-h-[44px]"
                                  />
                                </td>
                              );
                            })}
                            <td className="px-3 py-2 text-center">
                              <div className="font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                                {s.status === JudgeScoreStatus.ABSENT || s.status === 'absent' ? (
                                  <span className="text-xs font-bold text-rose-600">Absent</span>
                                ) : s.status === JudgeScoreStatus.DISQUALIFIED || s.status === 'disqualified' ? (
                                  <span className="text-xs font-bold text-rose-600">Disqualified</span>
                                ) : !isParticipated ? (
                                  '—'
                                ) : (
                                  displayAvg
                                )}
                              </div>
                            </td>
                          </>
                        )}

                        {!isJudge && (
                          <>
                            <td className="px-2 py-2 text-center">
                              {isParticipated && displayAvg > 0 && displayGrade ? (
                                <span className={`inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-md border text-xs font-mono font-bold shadow-xs ${
                                  displayGrade === 'A+' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                                  displayGrade === 'A' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                                  displayGrade === 'B' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                  displayGrade === 'C' ? 'bg-purple-50 text-purple-700 border-purple-300' :
                                  'bg-slate-50 text-slate-600 border-slate-200'
                                }`}>
                                  {displayGrade}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-mono text-xs">—</span>
                              )}
                            </td>

                            <td className="px-2 py-2 text-center">
                              {isParticipated && displayAvg > 0 && displayPoints > 0 ? (
                                <span className="font-mono font-bold text-xs text-indigo-900 bg-indigo-50/80 border border-indigo-200/80 px-2 py-0.5 rounded-md shadow-xs">
                                  {displayPoints} pts
                                </span>
                              ) : (
                                <span className="font-mono text-xs text-slate-400">0 pts</span>
                              )}
                            </td>

                            <td className="px-3 py-2 text-center">
                              <div className={`font-bold text-lg ${s.rank === 1 ? 'text-amber-500' : s.rank === 2 ? 'text-slate-400' : s.rank === 3 ? 'text-amber-700' : 'text-slate-600'}`}>
                                {s.rank || '-'}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- PREVIEW CHAMPIONS MODAL --- */}
      {showChampionsModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 font-sans no-print">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 space-y-4 max-h-[92vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 rounded-xl">
                  <Trophy className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-slate-800 text-base flex items-center gap-2">
                    <span>Preview Champions</span>
                    <span className="text-[10px] font-mono bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-full font-bold uppercase">
                      Internal Tally
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Includes all locked & published results (strictly confidential & not visible to public)
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowChampionsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            {championsLoading ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <RefreshCw className="h-8 w-8 text-amber-500 animate-spin mb-3" />
                <span className="text-slate-500 text-xs font-mono">Calculating live champion standings...</span>
              </div>
            ) : championsData.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-mono text-xs">
                No standings data available yet.
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1st Place Champion Spotlight */}
                {championsData[0] && (
                  <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-slate-950 p-4 rounded-2xl shadow-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-950 text-amber-400 flex items-center justify-center font-extrabold text-xl shadow-inner">
                        👑 1
                      </div>
                      <div>
                        <span className="text-[10px] uppercase tracking-widest font-mono font-bold text-amber-950 block">Current Leading Champion</span>
                        <h2 className="text-xl font-black uppercase tracking-wide">{championsData[0].unitName}</h2>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black">{championsData[0].overallPoints}</span>
                      <span className="text-[10px] font-mono font-bold block uppercase tracking-wider text-amber-950">Total Points</span>
                    </div>
                  </div>
                )}

                {/* Full Standings Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 font-mono text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-12">Rank</th>
                        <th className="py-2.5 px-3 text-left">House / Unit</th>
                        <th className="py-2.5 px-3 text-center">Indiv Pts</th>
                        <th className="py-2.5 px-3 text-center">Group Pts</th>
                        <th className="py-2.5 px-3 text-right">Total Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {championsData.map((st: any) => {
                        const isTop = st.rank === 1;
                        return (
                          <tr key={st.unitId} className={`hover:bg-slate-50/60 ${isTop ? 'bg-amber-50/30 font-bold' : ''}`}>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full font-bold text-xs ${
                                st.rank === 1 ? 'bg-amber-400 text-slate-950 shadow-sm' :
                                st.rank === 2 ? 'bg-slate-200 text-slate-800' :
                                st.rank === 3 ? 'bg-orange-200 text-orange-950' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {st.rank}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                              {st.unitName}
                              <span className="text-[10px] text-slate-400 font-mono ml-2">({st.completedResultsCount} events)</span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                              {st.individualPoints || 0}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono text-slate-600 whitespace-nowrap">
                              {st.groupPoints || 0}
                            </td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-sm text-emerald-700 whitespace-nowrap">
                              {st.overallPoints}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 bg-slate-50 border rounded-xl text-[11px] text-slate-500 flex justify-between items-center">
                  <span>💡 Note: Includes all locked & published results. Public site remains strictly showing announced results only.</span>
                  <button
                    onClick={() => { setShowChampionsModal(false); openWinnersPrint(); }}
                    className="font-bold text-indigo-600 hover:text-indigo-800 underline ml-2 cursor-pointer"
                  >
                    View Winner List →
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowChampionsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
