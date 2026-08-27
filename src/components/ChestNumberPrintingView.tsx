import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, Download, Search, RefreshCw, Palette, Settings, 
  Layers, Upload, Move, Save, CheckCircle2, LayoutGrid, Eye,
  Hash, QrCode, User as UserIcon, Shield, Sparkles, Filter, Edit3, X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { User } from '../types';

interface ChestNumberPrintingViewProps {
  user: User;
  token: string;
  eventSettings?: any;
  onSettingsUpdated?: () => void;
}

export default function ChestNumberPrintingView({ 
  user, token, eventSettings, onSettingsUpdated 
}: ChestNumberPrintingViewProps) {
  const [chestNumbers, setChestNumbers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters & Selection
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gridPerSheet, setGridPerSheet] = useState<number>(6); // 4, 6, 8, 9, 12 per A4 sheet

  // Individual Chest Number Customization Modal State
  const [editingCn, setEditingCn] = useState<any | null>(null);
  const [individualConfig, setIndividualConfig] = useState<any>(null);

  // Template Layout Config
  const defaultConfig = {
    cardBgColor: '#ffffff',
    cardBorderColor: '#e2e8f0',
    headerBgColor: '#065f46',
    headerTextColor: '#ffffff',
    accentColor: '#f59e0b',
    bgImageUrl: eventSettings?.chestNumberTemplateUrl || '',
    showBgImage: false,
    
    // Element Toggles
    showName: true,
    showCategory: true,
    showUnit: true,
    showQr: true,
    enableCategoryColors: true,
    
    // Chest Number Position & Styling
    chestSize: 42, // px
    chestColor: '#0f172a',
    chestWeight: '800',
    
    // Participant Name Position & Styling
    nameSize: 18,
    nameColor: '#1e293b',
    nameWeight: '700',
    nameMaxLines: 2, // Auto 2-line wrap
    
    // Category Name Position & Styling
    catSize: 14,
    catColor: '#ffffff',

    // Unit/Team Name Position & Styling
    unitSize: 12,
    unitColor: '#64748b',

    // QR Code Position & Styling
    qrSize: 52, // px

    // Category Color Mapping
    categoryColors: {
      Senior: '#d97706',
      Junior: '#2563eb',
      'Sub-Junior': '#7c3aed',
      General: '#059669'
    } as Record<string, string>
  };

  const [config, setConfig] = useState<any>(() => {
    return { ...defaultConfig, ...(eventSettings?.chestNumberConfig || {}) };
  });

  const [activeTab, setActiveTab] = useState<'print' | 'editor'>('print');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [cnRes, catRes, unitRes] = await Promise.all([
        fetch('/api/chest-numbers', { credentials: 'include' }),
        fetch('/api/categories', { credentials: 'include' }),
        fetch('/api/units', { credentials: 'include' })
      ]);
      if (cnRes.ok) {
        const data = await cnRes.json();
        setChestNumbers(data);
        // Select all by default
        setSelectedIds(data.map((item: any) => item.id));
      }
      if (catRes.ok) setCategories(await catRes.json());
      if (unitRes.ok) setUnits(await unitRes.json());
    } catch (e) {
      console.error('Error fetching chest numbers data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getCardConfig = (cn: any) => {
    const override = eventSettings?.chestNumberOverrides?.[cn.id] || eventSettings?.chestNumberOverrides?.[cn.chestNumber];
    return { ...config, ...(override || {}) };
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chestNumberConfig: config,
          chestNumberTemplateUrl: config.bgImageUrl
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Chest number layout template saved successfully!' });
        if (onSettingsUpdated) onSettingsUpdated();
      } else {
        setMessage({ type: 'error', text: 'Failed to save layout configuration.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Error connecting to server.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIndividualOverride = async () => {
    if (!editingCn || !individualConfig) return;
    setSaving(true);
    try {
      const updatedOverrides = {
        ...(eventSettings?.chestNumberOverrides || {}),
        [editingCn.id]: individualConfig,
        [editingCn.chestNumber]: individualConfig
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chestNumberOverrides: updatedOverrides })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: `Saved custom card layout specifically for Chest Number ${editingCn.chestNumber} (${editingCn.participantName})!` });
        setEditingCn(null);
        if (onSettingsUpdated) onSettingsUpdated();
      } else {
        setMessage({ type: 'error', text: 'Failed to save individual card layout.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save card override.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(cn => cn.id));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filtered = chestNumbers.filter(cn => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      const matchName = cn.participantName?.toLowerCase().includes(s);
      const matchNum = cn.chestNumber?.toString().includes(s);
      const matchUnit = cn.unitName?.toLowerCase().includes(s);
      if (!matchName && !matchNum && !matchUnit) return false;
    }
    if (selectedCategory && cn.categoryId !== selectedCategory && cn.categoryName !== selectedCategory) return false;
    if (selectedUnit && cn.unitId !== selectedUnit && cn.unitName !== selectedUnit) return false;
    return true;
  }).sort((a, b) => a.chestNumber - b.chestNumber);

  const selectedChestNumbers = filtered.filter(cn => selectedIds.includes(cn.id));

  // Determine host URL for QR code scan
  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0 w-full overflow-x-hidden font-sans">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Printer className="h-7 w-7 text-amber-500" />
            Chest Number Printing Studio
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Customize printable chest number badges, template positions, QR codes, and multi-up A4 print grids
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-200 p-1 rounded-xl flex text-xs font-semibold">
            <button
              onClick={() => setActiveTab('print')}
              className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'print' ? 'bg-white text-emerald-800 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Printer className="h-3.5 w-3.5 inline mr-1" />
              Print & Grid Layout
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg transition ${activeTab === 'editor' ? 'bg-white text-emerald-800 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Palette className="h-3.5 w-3.5 inline mr-1" />
              Default Template Studio
            </button>
          </div>

          <button
            onClick={handlePrint}
            disabled={selectedChestNumbers.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition disabled:opacity-50 shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print A4 Sheets ({selectedChestNumbers.length})
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-3.5 rounded-xl text-sm font-semibold print:hidden ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* TAB 1: PRINT & GRID SELECTION */}
      {activeTab === 'print' && (
        <div className="space-y-6 print:space-y-0">
          {/* Controls & Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 print:hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Categories</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {/* Unit Filter */}
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="">All Units / Teams</option>
                {units.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              {/* Cards Per A4 Sheet Selector */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600 whitespace-nowrap">Grid/Page:</label>
                <select
                  value={gridPerSheet}
                  onChange={(e) => setGridPerSheet(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-amber-50 border border-amber-200 font-bold text-amber-900 rounded-xl text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value={4}>4 per A4 sheet (2x2 Grid)</option>
                  <option value={6}>6 per A4 sheet (2x3 Grid)</option>
                  <option value={8}>8 per A4 sheet (2x4 Grid)</option>
                  <option value={9}>9 per A4 sheet (3x3 Grid)</option>
                  <option value={12}>12 per A4 sheet (3x4 Grid)</option>
                </select>
              </div>
            </div>

            {/* Selection & Toggle Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSelectAll}
                  className="font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                >
                  {selectedIds.length === filtered.length ? 'Deselect All' : 'Select All Filtered'}
                </button>
                <span className="text-slate-500">
                  Showing <strong>{filtered.length}</strong> participants ({selectedChestNumbers.length} selected for print)
                </span>
              </div>

              {/* Global Quick Toggles */}
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-700 flex-wrap">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showName !== false}
                    onChange={(e) => setConfig({ ...config, showName: e.target.checked })}
                    className="h-3.5 w-3.5 accent-emerald-600 rounded"
                  />
                  Name
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showCategory !== false}
                    onChange={(e) => setConfig({ ...config, showCategory: e.target.checked })}
                    className="h-3.5 w-3.5 accent-emerald-600 rounded"
                  />
                  Category
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showUnit !== false}
                    onChange={(e) => setConfig({ ...config, showUnit: e.target.checked })}
                    className="h-3.5 w-3.5 accent-emerald-600 rounded"
                  />
                  Unit
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showQr !== false}
                    onChange={(e) => setConfig({ ...config, showQr: e.target.checked })}
                    className="h-3.5 w-3.5 accent-emerald-600 rounded"
                  />
                  QR Code
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enableCategoryColors !== false}
                    onChange={(e) => setConfig({ ...config, enableCategoryColors: e.target.checked })}
                    className="h-3.5 w-3.5 accent-emerald-600 rounded"
                  />
                  Category Colors
                </label>
              </div>
            </div>
          </div>

          {/* Printable A4 Sheets Render Grid */}
          {selectedChestNumbers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 print:hidden">
              <Hash className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-700 text-base">No Chest Numbers Selected</p>
              <p className="text-xs mt-1">Select participants above or click "Select All Filtered" to prepare printable cards.</p>
            </div>
          ) : (
            <div className="chest-print-container">
              {/* Render into A4 Pages */}
              {Array.from({ length: Math.ceil(selectedChestNumbers.length / gridPerSheet) }).map((_, pageIdx) => {
                const pageItems = selectedChestNumbers.slice(pageIdx * gridPerSheet, (pageIdx + 1) * gridPerSheet);
                
                let gridClass = 'grid-cols-2 grid-rows-3'; // 6 default
                if (gridPerSheet === 4) gridClass = 'grid-cols-2 grid-rows-2';
                if (gridPerSheet === 8) gridClass = 'grid-cols-2 grid-rows-4';
                if (gridPerSheet === 9) gridClass = 'grid-cols-3 grid-rows-3';
                if (gridPerSheet === 12) gridClass = 'grid-cols-3 grid-rows-4';

                return (
                  <div 
                    key={pageIdx} 
                    className={`a4-page bg-white p-6 mb-8 border border-slate-300 rounded-2xl shadow-lg grid ${gridClass} gap-4 print:p-4 print:m-0 print:border-none print:shadow-none print:w-full print:h-screen print:page-break-after`}
                    style={{
                      minHeight: '297mm',
                      width: '210mm',
                      margin: '0 auto 2rem auto',
                      boxSizing: 'border-box'
                    }}
                  >
                    {pageItems.map((cn) => {
                      const cardConf = getCardConfig(cn);
                      const catColor = (cardConf.enableCategoryColors !== false && cardConf.categoryColors[cn.categoryName]) || cardConf.headerBgColor || '#065f46';
                      const qrUrl = `${originUrl}/?chestNo=${cn.chestNumber}`;
                      const hasOverride = !!(eventSettings?.chestNumberOverrides?.[cn.id] || eventSettings?.chestNumberOverrides?.[cn.chestNumber]);

                      return (
                        <div
                          key={cn.id}
                          className="chest-card relative overflow-hidden rounded-xl border border-slate-300 bg-white flex flex-col justify-between shadow-sm print:shadow-none print:border-slate-400 group"
                          style={{
                            backgroundColor: cardConf.cardBgColor,
                            borderColor: cardConf.cardBorderColor,
                            backgroundImage: cardConf.showBgImage && cardConf.bgImageUrl ? `url(${cardConf.bgImageUrl})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            minHeight: gridPerSheet >= 9 ? '180px' : '230px'
                          }}
                        >
                          {/* Quick Edit Position Action (Hidden on print) */}
                          <button
                            onClick={() => {
                              setEditingCn(cn);
                              setIndividualConfig(cardConf);
                            }}
                            className="absolute top-2 right-2 z-10 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition print:hidden shadow-md flex items-center gap-1 text-[10px] font-bold"
                            title="Edit Custom Layout for this Chest Number"
                          >
                            <Edit3 className="h-3 w-3" />
                            {hasOverride ? 'Customized' : 'Customize'}
                          </button>

                          {/* Card Header (Category Name & Badge) */}
                          {cardConf.showCategory !== false && (
                            <div 
                              className="px-3 py-1.5 text-white flex justify-between items-center font-bold tracking-wider uppercase"
                              style={{ backgroundColor: catColor, fontSize: `${cardConf.catSize}px` }}
                            >
                              <span>{cn.categoryName}</span>
                              <span className="opacity-80 text-[10px] font-mono">CHEST BADGE</span>
                            </div>
                          )}

                          {/* Card Content Area */}
                          <div className="p-4 flex-1 flex flex-col justify-center items-center text-center relative">
                            {/* Giant Chest Number */}
                            <div
                              className="font-extrabold tracking-tighter leading-none"
                              style={{
                                color: cardConf.chestColor,
                                fontSize: gridPerSheet >= 9 ? `${cardConf.chestSize * 0.8}px` : `${cardConf.chestSize}px`,
                                fontWeight: cardConf.chestWeight
                              }}
                            >
                              {cn.chestNumber}
                            </div>

                            {/* Participant Name (Auto 2-line wrap & center align for long names) */}
                            {cardConf.showName !== false && (
                              <div
                                className="font-bold text-center leading-tight mt-2 px-2 w-full truncate-2-lines"
                                style={{
                                  color: cardConf.nameColor,
                                  fontSize: gridPerSheet >= 9 ? `${cardConf.nameSize * 0.85}px` : `${cardConf.nameSize}px`,
                                  fontWeight: cardConf.nameWeight,
                                  display: '-webkit-box',
                                  WebkitLineClamp: cardConf.nameMaxLines,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                                title={cn.participantName}
                              >
                                {cn.participantName}
                              </div>
                            )}

                            {/* Unit / Team Name */}
                            {cardConf.showUnit !== false && (
                              <div
                                className="text-slate-500 font-semibold mt-1 tracking-wide uppercase"
                                style={{
                                  color: cardConf.unitColor,
                                  fontSize: `${cardConf.unitSize}px`
                                }}
                              >
                                {cn.unitName}
                              </div>
                            )}

                            {/* Embedded QR Code (Scans directly to Participant Portal) */}
                            {cardConf.showQr !== false && (
                              <div className="absolute right-2 bottom-2 bg-white p-1 rounded-lg border border-slate-200 shadow-sm print:shadow-none">
                                <QRCodeSVG 
                                  value={qrUrl} 
                                  size={gridPerSheet >= 9 ? Math.max(36, cardConf.qrSize * 0.75) : cardConf.qrSize} 
                                  level="M"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEFAULT TEMPLATE STUDIO */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
          {/* Left Panel: Settings Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Palette className="h-5 w-5 text-emerald-600" />
              Template Colors & Background
            </h2>

            {/* Colors */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Header Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.headerBgColor}
                    onChange={(e) => setConfig({ ...config, headerBgColor: e.target.value })}
                    className="h-8 w-12 rounded cursor-pointer border border-slate-300"
                  />
                  <input
                    type="text"
                    value={config.headerBgColor}
                    onChange={(e) => setConfig({ ...config, headerBgColor: e.target.value })}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Chest Number Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.chestColor}
                    onChange={(e) => setConfig({ ...config, chestColor: e.target.value })}
                    className="h-8 w-12 rounded cursor-pointer border border-slate-300"
                  />
                  <input
                    type="text"
                    value={config.chestColor}
                    onChange={(e) => setConfig({ ...config, chestColor: e.target.value })}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Participant Name Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={config.nameColor}
                    onChange={(e) => setConfig({ ...config, nameColor: e.target.value })}
                    className="h-8 w-12 rounded cursor-pointer border border-slate-300"
                  />
                  <input
                    type="text"
                    value={config.nameColor}
                    onChange={(e) => setConfig({ ...config, nameColor: e.target.value })}
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Custom Template Background URL</label>
                <input
                  type="text"
                  placeholder="https://example.com/template-bg.jpg"
                  value={config.bgImageUrl}
                  onChange={(e) => setConfig({ ...config, bgImageUrl: e.target.value, showBgImage: true })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 pt-2">
              <Layers className="h-5 w-5 text-emerald-600" />
              Font Sizes & Layout Toggles
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Chest Number Font Size</span>
                  <span>{config.chestSize}px</span>
                </div>
                <input
                  type="range"
                  min="24"
                  max="72"
                  value={config.chestSize}
                  onChange={(e) => setConfig({ ...config, chestSize: Number(e.target.value) })}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Participant Name Font Size</span>
                  <span>{config.nameSize}px</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={config.nameSize}
                  onChange={(e) => setConfig({ ...config, nameSize: Number(e.target.value) })}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>QR Code Size</span>
                  <span>{config.qrSize}px</span>
                </div>
                <input
                  type="range"
                  min="36"
                  max="80"
                  value={config.qrSize}
                  onChange={(e) => setConfig({ ...config, qrSize: Number(e.target.value) })}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.showName !== false}
                    onChange={(e) => setConfig({ ...config, showName: e.target.checked })}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  Show Participant Name
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.showCategory !== false}
                    onChange={(e) => setConfig({ ...config, showCategory: e.target.checked })}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  Show Category Header Badge
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.showUnit !== false}
                    onChange={(e) => setConfig({ ...config, showUnit: e.target.checked })}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  Show Unit / Team Name
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={config.showQr !== false}
                    onChange={(e) => setConfig({ ...config, showQr: e.target.checked })}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  Show Embedded QR Code
                </label>
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Template Configuration
            </button>
          </div>

          {/* Right Panel: Live Single Card Interactive Preview */}
          <div className="lg:col-span-2 bg-slate-100 border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center space-y-4 min-h-[400px]">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">
              LIVE TEMPLATE CARD PREVIEW
            </span>

            {/* Mock Card Preview */}
            <div
              className="w-full max-w-sm h-64 rounded-2xl border-2 border-slate-300 bg-white shadow-xl overflow-hidden relative flex flex-col justify-between"
              style={{
                backgroundColor: config.cardBgColor,
                borderColor: config.cardBorderColor,
                backgroundImage: config.showBgImage && config.bgImageUrl ? `url(${config.bgImageUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {/* Header */}
              {config.showCategory !== false && (
                <div 
                  className="px-4 py-2 text-white flex justify-between items-center font-extrabold tracking-wider uppercase text-xs"
                  style={{ backgroundColor: config.headerBgColor }}
                >
                  <span>SENIOR CATEGORY</span>
                  <span className="opacity-80 text-[10px] font-mono">CHEST BADGE</span>
                </div>
              )}

              {/* Body */}
              <div className="p-6 flex-1 flex flex-col items-center justify-center text-center relative">
                <div
                  className="font-extrabold tracking-tighter leading-none"
                  style={{
                    color: config.chestColor,
                    fontSize: `${config.chestSize}px`,
                    fontWeight: config.chestWeight
                  }}
                >
                  1042
                </div>

                {config.showName !== false && (
                  <div
                    className="font-bold text-center leading-tight mt-3 px-2 w-full"
                    style={{
                      color: config.nameColor,
                      fontSize: `${config.nameSize}px`,
                      fontWeight: config.nameWeight,
                      display: '-webkit-box',
                      WebkitLineClamp: config.nameMaxLines,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    MUHAMMED RASHID AHMAD
                  </div>
                )}

                {config.showUnit !== false && (
                  <div
                    className="text-slate-500 font-semibold mt-1.5 tracking-wide uppercase text-xs"
                    style={{ color: config.unitColor }}
                  >
                    NINTHIKAL UNIT
                  </div>
                )}

                {config.showQr !== false && (
                  <div className="absolute right-3 bottom-3 bg-white p-1 rounded-lg border border-slate-200 shadow-md">
                    <QRCodeSVG 
                      value={`${originUrl}/?chestNo=1042`} 
                      size={config.qrSize} 
                      level="M"
                    />
                  </div>
                )}
              </div>
            </div>

            <p className="text-slate-400 text-xs text-center font-mono">
              Scanned QR code URL: <code className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">{originUrl}/?chestNo=1042</code>
            </p>
          </div>
        </div>
      )}

      {/* INDIVIDUAL CHEST NUMBER CUSTOMIZATION MODAL */}
      {editingCn && individualConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-5 border border-slate-100 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Customize Chest Card #{editingCn.chestNumber}
                </h3>
                <p className="text-xs text-slate-500">{editingCn.participantName} ({editingCn.categoryName})</p>
              </div>
              <button
                onClick={() => setEditingCn(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Participant Name Size</span>
                  <span>{individualConfig.nameSize}px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="32"
                  value={individualConfig.nameSize}
                  onChange={(e) => setIndividualConfig({ ...individualConfig, nameSize: Number(e.target.value) })}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Chest Number Size</span>
                  <span>{individualConfig.chestSize}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="72"
                  value={individualConfig.chestSize}
                  onChange={(e) => setIndividualConfig({ ...individualConfig, chestSize: Number(e.target.value) })}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div className="space-y-2 pt-2 border-t">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={individualConfig.showName !== false}
                    onChange={(e) => setIndividualConfig({ ...individualConfig, showName: e.target.checked })}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  Show Participant Name on Card
                </label>

                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={individualConfig.showQr !== false}
                    onChange={(e) => setIndividualConfig({ ...individualConfig, showQr: e.target.checked })}
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  Show QR Code on Card
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t">
              <button
                onClick={handleSaveIndividualOverride}
                disabled={saving}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save for THIS Chest Number Only
              </button>
              <button
                onClick={() => setEditingCn(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Print Mode */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .chest-print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .a4-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0.5cm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            height: 100vh !important;
          }
        }
      `}</style>
    </div>
  );
}
