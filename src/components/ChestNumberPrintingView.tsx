import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, Download, Search, RefreshCw, Palette, Settings, 
  Layers, Upload, Move, Save, CheckCircle2, LayoutGrid, Eye,
  Hash, QrCode, User as UserIcon, Shield, Sparkles, Filter, Edit3, X, Image as ImageIcon
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

  // Template Mode: 'default' | 'category' | 'unit'
  const [templateMode, setTemplateMode] = useState<'default' | 'category' | 'unit'>('default');
  const [categoryBgImages, setCategoryBgImages] = useState<Record<string, string>>(() => {
    return eventSettings?.chestNumberCategoryBgs || {};
  });
  const [unitBgImages, setUnitBgImages] = useState<Record<string, string>>(() => {
    return eventSettings?.chestNumberUnitBgs || {};
  });

  // Default Template Layout Config
  const defaultConfig = {
    cardBgColor: '#ffffff',
    cardBorderColor: '#cbd5e1',
    headerBgColor: '#065f46',
    headerTextColor: '#ffffff',
    accentColor: '#f59e0b',
    bgImageUrl: eventSettings?.chestNumberTemplateUrl || '',
    showBgImage: true,
    publicPortalUrl: eventSettings?.publicPortalUrl || '',
    
    // Element Toggles
    showName: true,
    showCategory: true,
    showUnit: true,
    showQr: true,
    enableCategoryColors: true,
    
    // Chest Number Position & Styling
    chestX: 400, // px on 800x520 canvas
    chestY: 210,
    chestSize: 84, // px
    chestColor: '#0f172a',
    chestWeight: '800',
    
    // Participant Name Position & Styling
    nameX: 400,
    nameY: 340,
    nameSize: 36,
    nameColor: '#1e293b',
    nameWeight: '700',
    nameMaxLines: 2,
    
    // Category Name Position & Styling
    catX: 400,
    catY: 45,
    catSize: 24,
    catColor: '#ffffff',

    // Unit/Team Name Position & Styling
    unitX: 400,
    unitY: 450,
    unitSize: 26,
    unitColor: '#64748b',

    // QR Code Position & Styling
    qrX: 660,
    qrY: 380,
    qrSize: 100, // px

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

  // Determine Background Image URL based on mode
  const getCardBgImage = (cn: any, cardConf: any) => {
    if (templateMode === 'category' && cn?.categoryName && categoryBgImages[cn.categoryName]) {
      return categoryBgImages[cn.categoryName];
    }
    if (templateMode === 'unit' && cn?.unitName && unitBgImages[cn.unitName]) {
      return unitBgImages[cn.unitName];
    }
    return cardConf.showBgImage ? cardConf.bgImageUrl : '';
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
          chestNumberTemplateUrl: config.bgImageUrl,
          chestNumberTemplateMode: templateMode,
          chestNumberCategoryBgs: categoryBgImages,
          chestNumberUnitBgs: unitBgImages,
          publicPortalUrl: config.publicPortalUrl
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Chest number template & background configuration saved successfully!' });
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
  const originUrl = config.publicPortalUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  // Canvas Drag & Drop State for Individual Editor & Studio Editor
  const canvasRefModal = useRef<HTMLCanvasElement>(null);
  const canvasRefStudio = useRef<HTMLCanvasElement>(null);
  type DragElement = 'chest' | 'name' | 'cat' | 'unit' | 'qr' | null;
  const [draggingModal, setDraggingModal] = useState<DragElement>(null);
  const [draggingStudio, setDraggingStudio] = useState<DragElement>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const lastMousePos = useRef<{ x: number, y: number } | null>(null);

  // Helper: Draw Card to Canvas
  const drawCardCanvas = (
    canvas: HTMLCanvasElement, 
    cardConf: any, 
    cnData: any, 
    draggingElem: DragElement,
    onHitRegions?: (regions: { id: string, x: number, y: number, w: number, h: number }[]) => void
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 800;
    const H = 520;
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = cardConf.cardBgColor || '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Draw background image if available
    const bgUrl = getCardBgImage(cnData, cardConf);
    if (bgUrl) {
      const img = new Image();
      img.src = bgUrl;
      if (img.complete) {
        ctx.drawImage(img, 0, 0, W, H);
      }
    }

    const hitRegions: { id: string, x: number, y: number, w: number, h: number }[] = [];
    const addRegion = (id: string, x: number, y: number, w: number, h: number) => {
      hitRegions.push({ id, x: x - 15, y: y - 15, w: w + 30, h: h + 30 });
      if (hoveredElement === id || draggingElem === id) {
        ctx.save();
        ctx.strokeStyle = draggingElem === id ? '#0284c7' : 'rgba(2, 132, 199, 0.6)';
        ctx.lineWidth = draggingElem === id ? 4 : 2;
        ctx.setLineDash(draggingElem === id ? [] : [6, 4]);
        ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
        ctx.restore();
      }
    };

    // Category Badge
    if (cardConf.showCategory !== false) {
      const catColor = (cardConf.enableCategoryColors !== false && cardConf.categoryColors[cnData.categoryName]) || cardConf.headerBgColor || '#065f46';
      ctx.fillStyle = catColor;
      ctx.fillRect(0, 0, W, 80);

      ctx.fillStyle = cardConf.catColor || '#ffffff';
      ctx.font = `800 ${cardConf.catSize || 24}px sans-serif`;
      ctx.textAlign = 'center';
      const catText = (cnData.categoryName || 'SENIOR CATEGORY').toUpperCase();
      const catMetrics = ctx.measureText(catText);
      const catX = cardConf.catX ?? 400;
      const catY = cardConf.catY ?? 45;
      ctx.fillText(catText, catX, catY);
      addRegion('cat', catX - catMetrics.width / 2, catY - (cardConf.catSize || 24), catMetrics.width, (cardConf.catSize || 24));
    }

    // Chest Number
    ctx.fillStyle = cardConf.chestColor || '#0f172a';
    ctx.font = `${cardConf.chestWeight || '800'} ${cardConf.chestSize || 84}px sans-serif`;
    ctx.textAlign = 'center';
    const chestText = cnData.chestNumber?.toString() || '1042';
    const chestMetrics = ctx.measureText(chestText);
    const chestX = cardConf.chestX ?? 400;
    const chestY = cardConf.chestY ?? 210;
    ctx.fillText(chestText, chestX, chestY);
    addRegion('chest', chestX - chestMetrics.width / 2, chestY - (cardConf.chestSize || 84), chestMetrics.width, (cardConf.chestSize || 84));

    // Participant Name
    if (cardConf.showName !== false) {
      ctx.fillStyle = cardConf.nameColor || '#1e293b';
      ctx.font = `${cardConf.nameWeight || '700'} ${cardConf.nameSize || 36}px sans-serif`;
      ctx.textAlign = 'center';
      const nameText = (cnData.participantName || 'MUHAMMED RASHID AHMAD').toUpperCase();
      const nameMetrics = ctx.measureText(nameText);
      const nameX = cardConf.nameX ?? 400;
      const nameY = cardConf.nameY ?? 340;
      ctx.fillText(nameText, nameX, nameY);
      addRegion('name', nameX - nameMetrics.width / 2, nameY - (cardConf.nameSize || 36), nameMetrics.width, (cardConf.nameSize || 36));
    }

    // Unit Name
    if (cardConf.showUnit !== false) {
      ctx.fillStyle = cardConf.unitColor || '#64748b';
      ctx.font = `700 ${cardConf.unitSize || 26}px sans-serif`;
      ctx.textAlign = 'center';
      const unitText = (cnData.unitName || 'NINTHIKAL UNIT').toUpperCase();
      const unitMetrics = ctx.measureText(unitText);
      const unitX = cardConf.unitX ?? 400;
      const unitY = cardConf.unitY ?? 450;
      ctx.fillText(unitText, unitX, unitY);
      addRegion('unit', unitX - unitMetrics.width / 2, unitY - (cardConf.unitSize || 26), unitMetrics.width, (cardConf.unitSize || 26));
    }

    // QR Code Box Placeholder / Icon
    if (cardConf.showQr !== false) {
      const qSize = cardConf.qrSize || 100;
      const qX = cardConf.qrX ?? 660;
      const qY = cardConf.qrY ?? 380;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qX, qY, qSize, qSize);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(qX, qY, qSize, qSize);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('QR CODE', qX + qSize / 2, qY + qSize / 2 + 4);
      addRegion('qr', qX, qY, qSize, qSize);
    }

    if (onHitRegions) onHitRegions(hitRegions);
  };

  const modalHitRegions = useRef<{ id: string, x: number, y: number, w: number, h: number }[]>([]);
  const studioHitRegions = useRef<{ id: string, x: number, y: number, w: number, h: number }[]>([]);

  // Render Modal Canvas
  useEffect(() => {
    if (editingCn && individualConfig && canvasRefModal.current) {
      drawCardCanvas(
        canvasRefModal.current, 
        individualConfig, 
        editingCn, 
        draggingModal,
        (regions) => { modalHitRegions.current = regions; }
      );
    }
  }, [editingCn, individualConfig, draggingModal, hoveredElement]);

  // Render Studio Canvas
  useEffect(() => {
    if (activeTab === 'editor' && canvasRefStudio.current) {
      const mockCn = chestNumbers[0] || { chestNumber: '1042', participantName: 'MUHAMMED RASHID AHMAD', categoryName: 'SENIOR', unitName: 'NINTHIKAL UNIT' };
      drawCardCanvas(
        canvasRefStudio.current, 
        config, 
        mockCn, 
        draggingStudio,
        (regions) => { studioHitRegions.current = regions; }
      );
    }
  }, [activeTab, config, draggingStudio, hoveredElement, chestNumbers, templateMode, categoryBgImages, unitBgImages]);

  // Canvas Drag Handling Helper
  const handleDragStartCanvas = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement | null,
    regions: { id: string, x: number, y: number, w: number, h: number }[],
    setDragging: (elem: DragElement) => void
  ) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    } else {
      return;
    }

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    let hitElem: DragElement = null;
    for (const r of regions) {
      if (canvasX >= r.x && canvasX <= r.x + r.w && canvasY >= r.y && canvasY <= r.y + r.h) {
        hitElem = r.id as DragElement;
        break;
      }
    }

    if (hitElem) {
      setDragging(hitElem);
      lastMousePos.current = { x: clientX, y: clientY };
    }
  };

  const handlePointerMoveCanvas = (
    e: MouseEvent | TouchEvent | PointerEvent,
    canvas: HTMLCanvasElement | null,
    draggingElem: DragElement,
    updateConfigFn: (keyX: string, keyY: string, dx: number, dy: number) => void
  ) => {
    if (!draggingElem || !lastMousePos.current || !canvas) return;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && (e as TouchEvent).touches && (e as TouchEvent).touches.length > 0) {
      clientX = (e as TouchEvent).touches[0].clientX;
      clientY = (e as TouchEvent).touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    } else {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const dx = (clientX - lastMousePos.current.x) * scaleX;
    const dy = (clientY - lastMousePos.current.y) * scaleY;

    lastMousePos.current = { x: clientX, y: clientY };

    const keyMap: Record<string, { x: string, y: string }> = {
      chest: { x: 'chestX', y: 'chestY' },
      name: { x: 'nameX', y: 'nameY' },
      cat: { x: 'catX', y: 'catY' },
      unit: { x: 'unitX', y: 'unitY' },
      qr: { x: 'qrX', y: 'qrY' }
    };

    const target = keyMap[draggingElem];
    if (target) {
      updateConfigFn(target.x, target.y, dx, dy);
    }
  };

  // Window listeners for dragging
  useEffect(() => {
    if (!draggingModal && !draggingStudio) return;

    const handleMove = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (draggingModal && canvasRefModal.current) {
        handlePointerMoveCanvas(e, canvasRefModal.current, draggingModal, (keyX, keyY, dx, dy) => {
          setIndividualConfig((prev: any) => ({
            ...prev,
            [keyX]: Math.round((prev[keyX] ?? 400) + dx),
            [keyY]: Math.round((prev[keyY] ?? 200) + dy)
          }));
        });
      } else if (draggingStudio && canvasRefStudio.current) {
        handlePointerMoveCanvas(e, canvasRefStudio.current, draggingStudio, (keyX, keyY, dx, dy) => {
          setConfig((prev: any) => ({
            ...prev,
            [keyX]: Math.round((prev[keyX] ?? 400) + dx),
            [keyY]: Math.round((prev[keyY] ?? 200) + dy)
          }));
        });
      }
    };

    const handleUp = () => {
      setDraggingModal(null);
      setDraggingStudio(null);
      lastMousePos.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [draggingModal, draggingStudio]);

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
              Template Studio
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
                      const bgImg = getCardBgImage(cn, cardConf);
                      const qrUrl = `${originUrl}/?chestNo=${cn.chestNumber}`;
                      const hasOverride = !!(eventSettings?.chestNumberOverrides?.[cn.id] || eventSettings?.chestNumberOverrides?.[cn.chestNumber]);

                      return (
                        <div
                          key={cn.id}
                          className="chest-card relative overflow-hidden rounded-xl border border-slate-300 bg-white flex flex-col justify-between shadow-sm print:shadow-none print:border-slate-400 group"
                          style={{
                            backgroundColor: cardConf.cardBgColor,
                            borderColor: cardConf.cardBorderColor,
                            backgroundImage: bgImg ? `url(${bgImg})` : undefined,
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
                            className="absolute top-2 right-2 z-10 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition print:hidden shadow-md flex items-center gap-1 text-[10px] font-bold cursor-pointer"
                            title="Edit Custom Layout for this Chest Number"
                          >
                            <Edit3 className="h-3 w-3" />
                            {hasOverride ? 'Customized' : 'Customize'}
                          </button>

                          {/* Card Header (Category Name & Badge) */}
                          {cardConf.showCategory !== false && (
                            <div 
                              className="px-3 py-1.5 text-white flex justify-center items-center font-bold tracking-wider uppercase"
                              style={{ backgroundColor: catColor, fontSize: `${cardConf.catSize || 14}px` }}
                            >
                              <span>{cn.categoryName}</span>
                            </div>
                          )}

                          {/* Card Content Area */}
                          <div className="p-4 flex-1 flex flex-col justify-center items-center text-center relative">
                            {/* Giant Chest Number */}
                            <div
                              className="font-extrabold tracking-tighter leading-none"
                              style={{
                                color: cardConf.chestColor,
                                fontSize: gridPerSheet >= 9 ? `${(cardConf.chestSize || 42) * 0.8}px` : `${cardConf.chestSize || 42}px`,
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
                                  fontSize: gridPerSheet >= 9 ? `${(cardConf.nameSize || 18) * 0.85}px` : `${cardConf.nameSize || 18}px`,
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
                                  fontSize: `${cardConf.unitSize || 12}px`
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
                                  size={gridPerSheet >= 9 ? Math.max(36, (cardConf.qrSize || 52) * 0.75) : (cardConf.qrSize || 52)} 
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

      {/* TAB 2: TEMPLATE STUDIO & BACKGROUND UPLOADER */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
          {/* Left Panel: Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Upload className="h-5 w-5 text-emerald-600" />
              Template Mode & Direct Device File Upload
            </h2>

            {/* Template Mode Selection */}
            <div className="space-y-3 text-xs">
              <label className="block font-bold text-slate-700">Select Template Mode</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateMode('default')}
                  className={`py-2 px-2 rounded-xl border text-center font-bold transition cursor-pointer ${templateMode === 'default' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                  Default Single
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateMode('category')}
                  className={`py-2 px-2 rounded-xl border text-center font-bold transition cursor-pointer ${templateMode === 'category' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                  Category-Wise
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateMode('unit')}
                  className={`py-2 px-2 rounded-xl border text-center font-bold transition cursor-pointer ${templateMode === 'unit' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                  Team / Unit-Wise
                </button>
              </div>

              {/* Mode 1: Single Default Upload */}
              {templateMode === 'default' && (
                <div className="pt-2 space-y-2">
                  <label className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-300 transition cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <span>Upload Template Background Image from Device</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const res = ev.target?.result as string;
                            setConfig({ ...config, bgImageUrl: res, showBgImage: true });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                  {config.bgImageUrl && (
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <span className="text-[11px] font-mono truncate max-w-[200px]">Template Uploaded</span>
                      <button
                        onClick={() => setConfig({ ...config, bgImageUrl: '', showBgImage: false })}
                        className="text-red-600 hover:underline font-bold text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 2: Category-wise Uploads */}
              {templateMode === 'category' && (
                <div className="pt-2 space-y-2.5">
                  <span className="font-bold text-slate-700 block">Category Background Templates:</span>
                  {categories.map((cat: any) => (
                    <div key={cat.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800">{cat.name}</span>
                      <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer transition text-[11px]">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const res = ev.target?.result as string;
                                setCategoryBgImages(prev => ({ ...prev, [cat.name]: res }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* Mode 3: Team / Unit-wise Uploads */}
              {templateMode === 'unit' && (
                <div className="pt-2 space-y-2.5">
                  <span className="font-bold text-slate-700 block">Unit / Team Background Templates:</span>
                  {units.map((unit: any) => (
                    <div key={unit.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <span className="font-bold text-slate-800">{unit.name}</span>
                      <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer transition text-[11px]">
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const res = ev.target?.result as string;
                                setUnitBgImages(prev => ({ ...prev, [unit.name]: res }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3 pt-2">
              <Palette className="h-5 w-5 text-emerald-600" />
              Colors & Layout Positions
            </h2>

            <div className="space-y-4 text-xs">
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

              <div className="space-y-3 pt-2 border-t">
                <div>
                  <div className="flex justify-between font-bold text-slate-700 mb-1">
                    <span>Chest Number Position (X, Y)</span>
                    <span>{config.chestX}, {config.chestY}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="range"
                      min="50"
                      max="750"
                      value={config.chestX}
                      onChange={(e) => setConfig({ ...config, chestX: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                    <input
                      type="range"
                      min="50"
                      max="480"
                      value={config.chestY}
                      onChange={(e) => setConfig({ ...config, chestY: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold text-slate-700 mb-1">
                    <span>Participant Name Position (X, Y)</span>
                    <span>{config.nameX}, {config.nameY}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="range"
                      min="50"
                      max="750"
                      value={config.nameX}
                      onChange={(e) => setConfig({ ...config, nameX: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                    <input
                      type="range"
                      min="50"
                      max="480"
                      value={config.nameY}
                      onChange={(e) => setConfig({ ...config, nameY: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold text-slate-700 mb-1">
                    <span>Category Position (X, Y)</span>
                    <span>{config.catX}, {config.catY}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="range"
                      min="50"
                      max="750"
                      value={config.catX}
                      onChange={(e) => setConfig({ ...config, catX: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                    <input
                      type="range"
                      min="10"
                      max="480"
                      value={config.catY}
                      onChange={(e) => setConfig({ ...config, catY: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold text-slate-700 mb-1">
                    <span>Unit/Team Position (X, Y)</span>
                    <span>{config.unitX}, {config.unitY}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="range"
                      min="50"
                      max="750"
                      value={config.unitX}
                      onChange={(e) => setConfig({ ...config, unitX: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                    <input
                      type="range"
                      min="50"
                      max="480"
                      value={config.unitY}
                      onChange={(e) => setConfig({ ...config, unitY: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-bold text-slate-700 mb-1">
                    <span>QR Code Position (X, Y)</span>
                    <span>{config.qrX}, {config.qrY}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="range"
                      min="50"
                      max="750"
                      value={config.qrX}
                      onChange={(e) => setConfig({ ...config, qrX: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                    <input
                      type="range"
                      min="50"
                      max="480"
                      value={config.qrY}
                      onChange={(e) => setConfig({ ...config, qrY: Number(e.target.value) })}
                      className="w-full accent-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <label className="block font-bold text-slate-700 mb-1">Public Portal Base URL (for QR Scans)</label>
                <input
                  type="text"
                  value={config.publicPortalUrl}
                  onChange={(e) => setConfig({ ...config, publicPortalUrl: e.target.value })}
                  placeholder="https://rendevouz-three.vercel.app"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">If blank, it will point to this admin app.</p>
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

          {/* Right Panel: Interactive Canvas Drag & Drop Preview */}
          <div className="lg:col-span-2 bg-slate-100 border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4 min-h-[450px]">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono bg-white px-3 py-1 rounded-full border border-slate-200">
              Interactive Canvas Drag & Drop Preview (Desktop & Mobile Touch)
            </span>

            <div className="relative shadow-2xl border-2 border-slate-300 rounded-2xl overflow-hidden bg-white max-w-full flex items-center justify-center">
              <canvas
                ref={canvasRefStudio}
                className="w-auto h-auto max-h-[60vh] max-w-full object-contain cursor-move touch-none select-none"
                onPointerDown={(e) => handleDragStartCanvas(e, canvasRefStudio.current, studioHitRegions.current, setDraggingStudio)}
                onTouchStart={(e) => handleDragStartCanvas(e, canvasRefStudio.current, studioHitRegions.current, setDraggingStudio)}
                onMouseDown={(e) => handleDragStartCanvas(e, canvasRefStudio.current, studioHitRegions.current, setDraggingStudio)}
              />
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL CHEST NUMBER CUSTOMIZATION MODAL (MATCHING SCREENSHOT 1 / POSTER MODAL STYLE) */}
      {editingCn && individualConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:hidden font-sans">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row max-h-[92vh]">
            
            {/* Left: Interactive Drag-and-Drop Canvas Preview */}
            <div className="w-full md:flex-1 bg-slate-100 p-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 shrink-0 min-h-0 relative">
              <div className="mb-2 text-[10px] text-slate-500 font-mono flex items-center gap-1.5 shrink-0 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Touch / Drag elements directly on canvas preview (Mouse or Finger)
              </div>
              <div className="relative shadow-lg border-2 border-slate-300 rounded-2xl overflow-hidden bg-white max-w-full flex items-center justify-center shrink-0">
                <canvas
                  ref={canvasRefModal}
                  className="w-auto h-auto max-h-[35vh] sm:max-h-[45vh] md:max-h-[75vh] max-w-full object-contain cursor-move touch-none select-none"
                  onPointerDown={(e) => handleDragStartCanvas(e, canvasRefModal.current, modalHitRegions.current, setDraggingModal)}
                  onTouchStart={(e) => handleDragStartCanvas(e, canvasRefModal.current, modalHitRegions.current, setDraggingModal)}
                  onMouseDown={(e) => handleDragStartCanvas(e, canvasRefModal.current, modalHitRegions.current, setDraggingModal)}
                />
              </div>
            </div>

            {/* Right: Controls & Sliders Panel */}
            <div className="w-full md:w-80 lg:w-96 bg-white p-5 overflow-y-auto flex flex-col max-h-[50vh] md:max-h-full justify-between">
              <div>
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      Customize Chest Card #{editingCn.chestNumber}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono font-bold uppercase mt-0.5">
                      {editingCn.participantName} ({editingCn.categoryName})
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingCn(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Participant Name Controls */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <span className="font-bold text-slate-800 block">Participant Name Position & Size</span>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Name X Position</span>
                        <span>{individualConfig.nameX ?? 400}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="750"
                        value={individualConfig.nameX ?? 400}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, nameX: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Name Y Position</span>
                        <span>{individualConfig.nameY ?? 340}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="480"
                        value={individualConfig.nameY ?? 340}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, nameY: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Name Font Size</span>
                        <span>{individualConfig.nameSize ?? 36}px</span>
                      </div>
                      <input
                        type="range"
                        min="12"
                        max="60"
                        value={individualConfig.nameSize ?? 36}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, nameSize: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Chest Number Controls */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <span className="font-bold text-slate-800 block">Chest Number Position & Size</span>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Chest Number X</span>
                        <span>{individualConfig.chestX ?? 400}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="750"
                        value={individualConfig.chestX ?? 400}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, chestX: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Chest Number Y</span>
                        <span>{individualConfig.chestY ?? 210}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="480"
                        value={individualConfig.chestY ?? 210}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, chestY: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Chest Number Size</span>
                        <span>{individualConfig.chestSize ?? 84}px</span>
                      </div>
                      <input
                        type="range"
                        min="24"
                        max="120"
                        value={individualConfig.chestSize ?? 84}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, chestSize: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Category Controls */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <span className="font-bold text-slate-800 block">Category Position & Size</span>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Category X</span>
                        <span>{individualConfig.catX ?? 400}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="750"
                        value={individualConfig.catX ?? 400}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, catX: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Category Y</span>
                        <span>{individualConfig.catY ?? 45}</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="480"
                        value={individualConfig.catY ?? 45}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, catY: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Category Size</span>
                        <span>{individualConfig.catSize ?? 24}px</span>
                      </div>
                      <input
                        type="range"
                        min="12"
                        max="72"
                        value={individualConfig.catSize ?? 24}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, catSize: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Unit Controls */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <span className="font-bold text-slate-800 block">Unit/Team Position & Size</span>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Unit X</span>
                        <span>{individualConfig.unitX ?? 400}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="750"
                        value={individualConfig.unitX ?? 400}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, unitX: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Unit Y</span>
                        <span>{individualConfig.unitY ?? 450}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="480"
                        value={individualConfig.unitY ?? 450}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, unitY: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>Unit Size</span>
                        <span>{individualConfig.unitSize ?? 26}px</span>
                      </div>
                      <input
                        type="range"
                        min="12"
                        max="72"
                        value={individualConfig.unitSize ?? 26}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, unitSize: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  </div>

                  {/* QR Code Controls */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <span className="font-bold text-slate-800 block">QR Code Position & Size</span>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>QR Code X</span>
                        <span>{individualConfig.qrX ?? 660}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="750"
                        value={individualConfig.qrX ?? 660}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, qrX: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>QR Code Y</span>
                        <span>{individualConfig.qrY ?? 380}</span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="480"
                        value={individualConfig.qrY ?? 380}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, qrY: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-slate-600 mb-1">
                        <span>QR Code Size</span>
                        <span>{individualConfig.qrSize ?? 100}px</span>
                      </div>
                      <input
                        type="range"
                        min="36"
                        max="160"
                        value={individualConfig.qrSize ?? 100}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, qrSize: Number(e.target.value) })}
                        className="w-full accent-emerald-600"
                      />
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 font-semibold">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={individualConfig.showName !== false}
                        onChange={(e) => setIndividualConfig({ ...individualConfig, showName: e.target.checked })}
                        className="h-4 w-4 rounded accent-emerald-600"
                      />
                      Show Participant Name on Card
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
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
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={handleSaveIndividualOverride}
                  disabled={saving}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save for THIS Chest Number Only
                </button>
                <button
                  onClick={() => setEditingCn(null)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition"
                >
                  Cancel & Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Print Mode */}
      <style>{`
        @media print {
          .chest-print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .a4-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 auto !important;
            padding: 0.5cm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            height: 297mm !important;
            max-height: 297mm !important;
            overflow: hidden !important;
          }
        }
      `}</style>
    </div>
  );
}
