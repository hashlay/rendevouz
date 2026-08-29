import React, { useState, useEffect, useRef } from 'react';
import {
  Award, Trophy, Image as ImageIcon, Download, Upload,
  Sparkles, RefreshCw, Palette, Layers, CheckCircle2, ChevronDown, Save, X, Plus, Trash2, Move, GripVertical
} from 'lucide-react';
import { User, Category, Unit, Participant, Competition, Result, Team, UserRole } from '../types';

interface PosterSettingsViewProps {
  user: User;
  token: string;
  eventSettings?: any;
  onSettingsUpdated?: () => void;
}

// Default config for a single theme
function getDefaultThemeConfig(): any {
  return {
    titleColor: '#fbbf24', // Legacy title color fallback
    winnerColor: '#ffffff',
    unitColor: '#34d399',
    titleSize: 36, // Legacy title size fallback
    resultLabelText: 'RESULT',
    resultLabelX: 470,
    resultLabelY: 180,
    resultLabelSize: 28,
    resultLabelColor: '#ffffff',
    resultNumX: 600,
    resultNumY: 180,
    resultNumSize: 28,
    resultNumColor: '#ffffff',

    // Category (independent element)
    categorySize: 32,
    categoryColor: 'rgba(255, 255, 255, 0.7)',
    categoryX: 540,
    categoryY: 260,
    categoryFont: 'sans-serif',

    // Competition (independent element)
    titleX: 540,
    titleY: 110,
    campusNameX: 540,
    campusNameY: 70,
    festNameX: 540,
    festNameY: 120,
    categoryX: 540,
    categoryY: 260,
    compNameX: 540,
    compNameY: 330,
    compNameFont: 'sans-serif',

    // Campus Name (independent element)
    campusNameX: 540,
    campusNameY: 70,
    campusNameSize: 28,
    campusNameColor: '#ffffff',
    campusNameFont: 'sans-serif',
    showCampusName: true,

    // Fest Name (independent element)
    festNameX: 540,
    festNameY: 120,
    festNameSize: 36,
    festNameColor: '#fbbf24',
    festNameFont: 'sans-serif',
    showFestName: true,

    winnerSize: 44,
    unitSize: 30,
    rankSize: 38,
    titleX: 540, // Legacy title position fallback
    titleY: 110, // Legacy title position fallback

    // Per-rank positions
    rank1BadgeX: 140,
    rank1BadgeY: 460,
    rank1NameX: 260,
    rank1NameY: 448,
    rank1UnitX: 260,
    rank1UnitY: 483,

    rank2BadgeX: 140,
    rank2BadgeY: 640,
    rank2NameX: 260,
    rank2NameY: 628,
    rank2UnitX: 260,
    rank2UnitY: 663,

    rank3BadgeX: 140,
    rank3BadgeY: 820,
    rank3NameX: 260,
    rank3NameY: 808,
    rank3UnitX: 260,
    rank3UnitY: 843,

    // Per-element Font Families
    titleFont: 'sans-serif', // Legacy title font fallback
    resultLabelFont: 'sans-serif',
    resultNumFont: 'sans-serif',
    winnerFont: 'sans-serif',
    unitFont: 'monospace',
    rankFont: 'sans-serif',

    fontFamily: 'sans-serif', // Legacy global font family fallback
    uppercaseNames: false,
    rankBadgeShape: 'pill' as 'pill' | 'circle' | 'rectangle' | 'none',
    rank1Color: '#fbbf24',
    rank2Color: '#e2e8f0',
    rank3Color: '#d97706',
    rankTextColor: '#000000',
    rank1Text: 'Rank 1',
    rank2Text: 'Rank 2',
    rank3Text: 'Rank 3',
    showFooter: true,
    showFooterBg: false,
    footerLine1: '',
    footerLine2: '',

    // Block Letters (Uppercase) options
    campusNameUppercase: true,
    festNameUppercase: true,
    resultLabelUppercase: true,
    resultNumUppercase: false,
    categoryUppercase: true,
    compNameUppercase: false,
    winnerUppercase: false,
    unitUppercase: true,
  };
}

// Migrate old flat config to per-theme
function migrateOldConfig(templateConfig: any): any {
  if (templateConfig.themeConfigs) {
    // Add defaults to existing themeConfigs
    const customThemes = templateConfig.customThemes || [];
    const themeRules = templateConfig.themeRules || [];
    const themeConfigs: any = {};
    customThemes.forEach((_: any, idx: number) => {
      const themeConf = templateConfig.themeConfigs?.[idx] || {};
      themeConfigs[idx] = {
        ...getDefaultThemeConfig(),
        ...themeConf
      };

      // Map legacy title to campusName and festName coords if missing
      if (themeConfigs[idx].titleX !== undefined && themeConfigs[idx].campusNameX === undefined) {
        themeConfigs[idx].campusNameX = themeConfigs[idx].titleX;
        themeConfigs[idx].festNameX = themeConfigs[idx].titleX;
      }
      if (themeConfigs[idx].titleY !== undefined && themeConfigs[idx].campusNameY === undefined) {
        themeConfigs[idx].campusNameY = Math.max(themeConfigs[idx].titleY - 30, 30);
        themeConfigs[idx].festNameY = themeConfigs[idx].titleY + 20;
      }
    });
    return { customThemes, themeRules, themeConfigs };
  }

  // Old flat config -> wrap as theme 0 config
  const oldConf = { ...templateConfig };
  const customThemes = oldConf.customThemes || [];
  const themeRules = oldConf.themeRules || [];
  delete oldConf.customThemes;
  delete oldConf.themeRules;

  // Migration for old badgeX/badgeY
  if (oldConf.badgeX !== undefined) {
    oldConf.resultLabelX = oldConf.resultLabelX ?? (oldConf.badgeX - 60);
    oldConf.resultLabelY = oldConf.resultLabelY ?? oldConf.badgeY;
    oldConf.resultLabelSize = oldConf.resultLabelSize ?? (oldConf.badgeSize ?? 28);
    oldConf.resultNumX = oldConf.resultNumX ?? (oldConf.badgeX + 60);
    oldConf.resultNumY = oldConf.resultNumY ?? oldConf.badgeY;
    oldConf.resultNumSize = oldConf.resultNumSize ?? (oldConf.badgeSize ?? 28);
  }

  // Build per-rank positions from old winnersStartX/Y
  const wsx = oldConf.winnersStartX ?? 140;
  const wsy = oldConf.winnersStartY ?? 460;
  oldConf.rank1BadgeX = oldConf.rank1BadgeX ?? wsx;
  oldConf.rank1BadgeY = oldConf.rank1BadgeY ?? wsy;
  oldConf.rank1NameX = oldConf.rank1NameX ?? (wsx + 120);
  oldConf.rank1NameY = oldConf.rank1NameY ?? (wsy - 12);
  oldConf.rank1UnitX = oldConf.rank1UnitX ?? (wsx + 120);
  oldConf.rank1UnitY = oldConf.rank1UnitY ?? (wsy + 23);
  oldConf.rank2BadgeX = oldConf.rank2BadgeX ?? wsx;
  oldConf.rank2BadgeY = oldConf.rank2BadgeY ?? (wsy + 180);
  oldConf.rank2NameX = oldConf.rank2NameX ?? (wsx + 120);
  oldConf.rank2NameY = oldConf.rank2NameY ?? (wsy + 168);
  oldConf.rank2UnitX = oldConf.rank2UnitX ?? (wsx + 120);
  oldConf.rank2UnitY = oldConf.rank2UnitY ?? (wsy + 203);
  oldConf.rank3BadgeX = oldConf.rank3BadgeX ?? wsx;
  oldConf.rank3BadgeY = oldConf.rank3BadgeY ?? (wsy + 360);
  oldConf.rank3NameX = oldConf.rank3NameX ?? (wsx + 120);
  oldConf.rank3NameY = oldConf.rank3NameY ?? (wsy + 348);
  oldConf.rank3UnitX = oldConf.rank3UnitX ?? (wsx + 120);
  oldConf.rank3UnitY = oldConf.rank3UnitY ?? (wsy + 383);
  oldConf.rank1Text = oldConf.rank1Text ?? ((oldConf.rankPrefix ?? 'Rank ') + '1');
  oldConf.rank2Text = oldConf.rank2Text ?? ((oldConf.rankPrefix ?? 'Rank ') + '2');
  oldConf.rank3Text = oldConf.rank3Text ?? ((oldConf.rankPrefix ?? 'Rank ') + '3');

  // Apply old config to all existing themes
  const themeConfigs: any = {};
  customThemes.forEach((_: any, idx: number) => {
    themeConfigs[idx] = { ...getDefaultThemeConfig(), ...oldConf };

    // Map legacy title coordinates to campusName and festName coordinates
    if (themeConfigs[idx].titleX !== undefined && themeConfigs[idx].campusNameX === undefined) {
      themeConfigs[idx].campusNameX = themeConfigs[idx].titleX;
      themeConfigs[idx].festNameX = themeConfigs[idx].titleX;
    }
    if (themeConfigs[idx].titleY !== undefined && themeConfigs[idx].campusNameY === undefined) {
      themeConfigs[idx].campusNameY = Math.max(themeConfigs[idx].titleY - 30, 30);
      themeConfigs[idx].festNameY = themeConfigs[idx].titleY + 20;
    }
  });

  return { customThemes, themeRules, themeConfigs };
}

export default function PosterSettingsView({ user, token, eventSettings, onSettingsUpdated }: PosterSettingsViewProps) {
  const festivalName = eventSettings?.festivalName || 'Sahityotsav';
  const campusName = eventSettings?.campusName || eventSettings?.sectorName || 'Campus';

  const defaultThemes = [
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgwIiBoZWlnaHQ9IjEzNTAiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZzEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDIwNjE3Ii8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiMwZjE3MmEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxZTFiNGIiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTA4MCIgaGVpZ2h0PSIxMzUwIiBmaWxsPSJ1cmwoI2cxKSIvPjwvc3ZnPg==',
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgwIiBoZWlnaHQ9IjEzNTAiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZzIiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDIyYzIyIi8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiMwNjRlM2IiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwNjVmNDYiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTA4MCIgaGVpZ2h0PSIxMzUwIiBmaWxsPSJ1cmwoI2cyKSIvPjwvc3ZnPg==',
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgwIiBoZWlnaHQ9IjEzNTAiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZzMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjNDUwYTBhIi8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiM4ODEzMzciLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM5ZjEyMzkiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTA4MCIgaGVpZ2h0PSIxMzUwIiBmaWxsPSJ1cmwoI2czKSIvPjwvc3ZnPg==',
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgwIiBoZWlnaHQ9IjEzNTAiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZzQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDkwOTBiIi8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiMxODE4MWIiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMyNzI3MmEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTA4MCIgaGVpZ2h0PSIxMzUwIiBmaWxsPSJ1cmwoI2c0KSIvPjwvc3ZnPg=='
  ];

  // Migrate from old config if needed
  const rawTemplateConfig = eventSettings?.posterTemplateConfig || {};
  const migratedConfig = migrateOldConfig({
    ...rawTemplateConfig,
    customThemes: rawTemplateConfig.customThemes || defaultThemes
  });

  const [customThemes, setCustomThemes] = useState<string[]>(migratedConfig.customThemes || defaultThemes);
  const [themeRules, setThemeRules] = useState<any[]>(migratedConfig.themeRules || []);
  const [themeConfigs, setThemeConfigs] = useState<any>(migratedConfig.themeConfigs || {});
  const [selectedThemeIndex, setSelectedThemeIndex] = useState<number>(0);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch(err => console.error('Failed to load categories in PosterSettingsView:', err));
  }, []);

  // Get current theme's config (with defaults)
  const getThemeConfig = (idx: number) => {
    return { ...getDefaultThemeConfig(), ...(themeConfigs[idx] || {}) };
  };

  const conf = getThemeConfig(selectedThemeIndex);

  // Update a single property for the current theme
  const updateConf = (key: string, value: any) => {
    setThemeConfigs((prev: any) => ({
      ...prev,
      [selectedThemeIndex]: {
        ...getDefaultThemeConfig(),
        ...(prev[selectedThemeIndex] || {}),
        [key]: value
      }
    }));
  };

  const [savingTemplate, setSavingTemplate] = useState(false);

  const saveTemplate = async () => {
    if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.SECTOR_TEAM) {
      alert('Only administrators can save poster templates.');
      return;
    }
    setSavingTemplate(true);
    try {
      const config = {
        customThemes,
        themeRules,
        themeConfigs
      };
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ posterTemplateConfig: config })
      });
      if (!res.ok) throw new Error('Failed to save');
      alert('Poster template layout saved successfully!');
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (e) {
      alert('Failed to save poster layout');
    }
    setSavingTemplate(false);
  };

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  type DragTarget =
    | 'title' | 'resultLabel' | 'resultNum' | 'category' | 'compName'
    | 'rank1Badge' | 'rank1Name' | 'rank1Unit'
    | 'rank2Badge' | 'rank2Name' | 'rank2Unit'
    | 'rank3Badge' | 'rank3Name' | 'rank3Unit'
    | 'campusName' | 'festName'
    | null;
  const [dragging, setDragging] = useState<DragTarget>(null);
  const lastMousePos = useRef<{ x: number, y: number } | null>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Drag position maps
  const dragPosMap: Record<string, { xKey: string, yKey: string }> = {
    title: { xKey: 'titleX', yKey: 'titleY' },
    campusName: { xKey: 'campusNameX', yKey: 'campusNameY' },
    festName: { xKey: 'festNameX', yKey: 'festNameY' },
    resultLabel: { xKey: 'resultLabelX', yKey: 'resultLabelY' },
    resultNum: { xKey: 'resultNumX', yKey: 'resultNumY' },
    category: { xKey: 'categoryX', yKey: 'categoryY' },
    compName: { xKey: 'compNameX', yKey: 'compNameY' },
    rank1Badge: { xKey: 'rank1BadgeX', yKey: 'rank1BadgeY' },
    rank1Name: { xKey: 'rank1NameX', yKey: 'rank1NameY' },
    rank1Unit: { xKey: 'rank1UnitX', yKey: 'rank1UnitY' },
    rank2Badge: { xKey: 'rank2BadgeX', yKey: 'rank2BadgeY' },
    rank2Name: { xKey: 'rank2NameX', yKey: 'rank2NameY' },
    rank2Unit: { xKey: 'rank2UnitX', yKey: 'rank2UnitY' },
    rank3Badge: { xKey: 'rank3BadgeX', yKey: 'rank3BadgeY' },
    rank3Name: { xKey: 'rank3NameX', yKey: 'rank3NameY' },
    rank3Unit: { xKey: 'rank3UnitX', yKey: 'rank3UnitY' },
  };

  // Hit test regions for drag
  const hitRegions = useRef<{ id: string, x: number, y: number, w: number, h: number }[]>([]);

  // Helper to extract canvas X, Y coordinates from Mouse, Touch, or Pointer event
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('changedTouches' in e && (e as any).changedTouches && (e as any).changedTouches.length > 0) {
      clientX = (e as any).changedTouches[0].clientX;
      clientY = (e as any).changedTouches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    } else {
      return null;
    }

    return {
      canvasX: (clientX - rect.left) * scaleX,
      canvasY: (clientY - rect.top) * scaleY,
      clientX,
      clientY
    };
  };

  const handleDragStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const { canvasX, canvasY, clientX, clientY } = coords;

    if (e.cancelable) {
      try { e.preventDefault(); } catch (_) {}
    }

    // Find the most specific (smallest) hit region
    let bestHit: string | null = null;
    let bestArea = Infinity;
    for (const region of hitRegions.current) {
      if (canvasX >= region.x && canvasX <= region.x + region.w &&
        canvasY >= region.y && canvasY <= region.y + region.h) {
        const area = region.w * region.h;
        if (area < bestArea) {
          bestArea = area;
          bestHit = region.id;
        }
      }
    }

    if (bestHit) {
      setDragging(bestHit as DragTarget);
      lastMousePos.current = { x: clientX, y: clientY };
    }
  };

  useEffect(() => {
    if (!dragging) return;

    const handleWindowMove = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (!lastMousePos.current || !canvasRef.current) return;

      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      } else {
        return;
      }

      if (e.cancelable) {
        try { e.preventDefault(); } catch (_) {}
      }

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const deltaClientX = clientX - lastMousePos.current.x;
      const deltaClientY = clientY - lastMousePos.current.y;

      const dx = deltaClientX * scaleX;
      const dy = deltaClientY * scaleY;

      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        const posMap = dragPosMap[dragging];
        if (posMap) {
          updateConf(posMap.xKey, Math.round(conf[posMap.xKey] + dx));
          updateConf(posMap.yKey, Math.round(conf[posMap.yKey] + dy));
        }
        lastMousePos.current = { x: clientX, y: clientY };
      }
    };

    const handleWindowEnd = () => {
      setDragging(null);
      lastMousePos.current = null;
    };

    window.addEventListener('pointermove', handleWindowMove, { passive: false });
    window.addEventListener('mousemove', handleWindowMove, { passive: false });
    window.addEventListener('touchmove', handleWindowMove, { passive: false });

    window.addEventListener('pointerup', handleWindowEnd);
    window.addEventListener('mouseup', handleWindowEnd);
    window.addEventListener('touchend', handleWindowEnd);

    return () => {
      window.removeEventListener('pointermove', handleWindowMove);
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('touchmove', handleWindowMove);

      window.removeEventListener('pointerup', handleWindowEnd);
      window.removeEventListener('mouseup', handleWindowEnd);
      window.removeEventListener('touchend', handleWindowEnd);
    };
  }, [dragging, conf]);

  const handleHoverMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragging) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const { canvasX, canvasY } = coords;

    let hovered: string | null = null;
    for (const region of hitRegions.current) {
      if (canvasX >= region.x && canvasX <= region.x + region.w &&
        canvasY >= region.y && canvasY <= region.y + region.h) {
        hovered = region.id;
      }
    }
    setHoveredElement(hovered);
  };

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgRef.current;
    if (img) {
      const W = img.naturalWidth || img.width || 1080;
      const H = img.naturalHeight || img.height || 1350;
      canvas.width = W;
      canvas.height = H;
      ctx.drawImage(img, 0, 0, W, H);
      drawOverlay(ctx, W, H);
    } else {
      const W = 1080;
      const H = 1350;
      canvas.width = W;
      canvas.height = H;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      drawOverlay(ctx, W, H);
    }
  };

  const drawOverlay = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    const regions: { id: string, x: number, y: number, w: number, h: number }[] = [];
    const c = conf;

    // Helper to add region with generous touch padding for mobile finger ease
    const addRegion = (id: string, x: number, y: number, w: number, h: number) => {
      const touchPadding = 25;
      regions.push({ 
        id, 
        x: x - touchPadding, 
        y: y - touchPadding, 
        w: Math.max(w + touchPadding * 2, 60), 
        h: Math.max(h + touchPadding * 2, 60) 
      });

      // Draw visual highlight border around tight bounds
      if (hoveredElement === id || dragging === id) {
        ctx.save();
        ctx.strokeStyle = dragging === id ? '#22d3ee' : 'rgba(34, 211, 238, 0.5)';
        ctx.lineWidth = dragging === id ? 4 : 2;
        ctx.setLineDash(dragging === id ? [] : [8, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
      }
    };

    // Campus Name
    if (c.showCampusName !== false) {
      ctx.textAlign = 'left';
      ctx.font = `900 ${c.campusNameSize ?? 28}px ${c.campusNameFont || c.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = c.campusNameColor || c.titleColor || '#ffffff';
      const campusText = c.campusNameUppercase !== false ? campusName.toUpperCase() : campusName;
      const campusMetrics = ctx.measureText(campusText);
      const cx = c.campusNameX ?? c.titleX ?? 540;
      const cy = c.campusNameY ?? (c.titleY ? Math.max(c.titleY - 30, 30) : 70);
      ctx.fillText(campusText, cx, cy);
      addRegion('campusName', cx - 10, cy - (c.campusNameSize ?? 28) - 5, campusMetrics.width + 20, (c.campusNameSize ?? 28) + 20);
    }

    // Fest Name
    if (c.showFestName !== false) {
      ctx.textAlign = 'left';
      ctx.font = `900 ${c.festNameSize ?? 36}px ${c.festNameFont || c.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = c.festNameColor || c.titleColor || '#fbbf24';
      const festText = c.festNameUppercase !== false ? festivalName.toUpperCase() : festivalName;
      const festMetrics = ctx.measureText(festText);
      const fx = c.festNameX ?? c.titleX ?? 540;
      const fy = c.festNameY ?? (c.titleY ? c.titleY + 20 : 120);
      ctx.fillText(festText, fx, fy);
      addRegion('festName', fx - 10, fy - (c.festNameSize ?? 36) - 5, festMetrics.width + 20, (c.festNameSize ?? 36) + 20);
    }

    // Result Label (Word: e.g. "RESULT")
    ctx.textAlign = 'left';
    ctx.font = `800 ${c.resultLabelSize || 28}px ${c.resultLabelFont || c.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = c.resultLabelColor || '#ffffff';
    const rawLbl = c.resultLabelText || 'RESULT';
    const rLblText = c.resultLabelUppercase !== false ? rawLbl.toUpperCase() : rawLbl;
    const rLblMetrics = ctx.measureText(rLblText);
    ctx.fillText(rLblText, c.resultLabelX, c.resultLabelY);
    addRegion('resultLabel', c.resultLabelX - 10, c.resultLabelY - (c.resultLabelSize || 28) - 5, rLblMetrics.width + 20, (c.resultLabelSize || 28) + 20);

    // Result Number (Number: e.g. "00")
    ctx.textAlign = 'left';
    ctx.font = `800 ${c.resultNumSize || 28}px ${c.resultNumFont || c.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = c.resultNumColor || '#ffffff';
    const rNumText = '00';
    const rNumMetrics = ctx.measureText(rNumText);
    ctx.fillText(rNumText, c.resultNumX, c.resultNumY);
    addRegion('resultNum', c.resultNumX - 10, c.resultNumY - (c.resultNumSize || 28) - 5, rNumMetrics.width + 20, (c.resultNumSize || 28) + 20);

    // Category
    ctx.textAlign = 'left';
    ctx.font = `800 ${c.categorySize ?? 32}px ${c.categoryFont || c.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = c.categoryColor || 'rgba(255, 255, 255, 0.7)';
    const rawCat = 'CATEGORY';
    const catText = c.categoryUppercase !== false ? rawCat.toUpperCase() : rawCat;
    const catMetrics = ctx.measureText(catText);
    ctx.fillText(catText, c.categoryX ?? 540, c.categoryY ?? 260);
    addRegion('category', (c.categoryX ?? 540) - 10, (c.categoryY ?? 260) - (c.categorySize ?? 32) - 5, catMetrics.width + 20, (c.categorySize ?? 32) + 20);

    // Competition Name
    ctx.textAlign = 'left';
    ctx.font = `900 ${c.compNameSize ?? 52}px ${c.compNameFont || c.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = c.compNameColor || '#ffffff';
    const rawComp = 'Competition Name';
    const compText = c.compNameUppercase ? rawComp.toUpperCase() : rawComp;
    const compMetrics = ctx.measureText(compText);
    ctx.fillText(compText, c.compNameX ?? 540, c.compNameY ?? 330);
    addRegion('compName', (c.compNameX ?? 540) - 10, (c.compNameY ?? 330) - (c.compNameSize ?? 52) - 5, compMetrics.width + 20, (c.compNameSize ?? 52) + 20);

    // Draw each rank separately
    const rankData = [
      { rank: 1, badgeXKey: 'rank1BadgeX', badgeYKey: 'rank1BadgeY', nameXKey: 'rank1NameX', nameYKey: 'rank1NameY', unitXKey: 'rank1UnitX', unitYKey: 'rank1UnitY', color: c.rank1Color, text: c.rank1Text, badgeId: 'rank1Badge', nameId: 'rank1Name', unitId: 'rank1Unit' },
      { rank: 2, badgeXKey: 'rank2BadgeX', badgeYKey: 'rank2BadgeY', nameXKey: 'rank2NameX', nameYKey: 'rank2NameY', unitXKey: 'rank2UnitX', unitYKey: 'rank2UnitY', color: c.rank2Color, text: c.rank2Text, badgeId: 'rank2Badge', nameId: 'rank2Name', unitId: 'rank2Unit' },
      { rank: 3, badgeXKey: 'rank3BadgeX', badgeYKey: 'rank3BadgeY', nameXKey: 'rank3NameX', nameYKey: 'rank3NameY', unitXKey: 'rank3UnitX', unitYKey: 'rank3UnitY', color: c.rank3Color, text: c.rank3Text, badgeId: 'rank3Badge', nameId: 'rank3Name', unitId: 'rank3Unit' },
    ];

    rankData.forEach(rd => {
      const bx = c[rd.badgeXKey];
      const by = c[rd.badgeYKey];
      const nx = c[rd.nameXKey];
      const ny = c[rd.nameYKey];
      const ux = c[rd.unitXKey];
      const uy = c[rd.unitYKey];

      // Rank badge
      const rankText = rd.text;
      ctx.font = `900 ${c.rankSize}px ${c.rankFont || c.fontFamily || 'sans-serif'}`;
      const rankTextWidth = ctx.measureText(rankText).width;

      if (c.rankBadgeShape !== 'none') {
        ctx.fillStyle = rd.color;
        ctx.beginPath();
        if (c.rankBadgeShape === 'pill') {
          ctx.roundRect(bx - (rankTextWidth / 2) - 20, by - 37, rankTextWidth + 40, 50, 25);
        } else if (c.rankBadgeShape === 'circle') {
          ctx.arc(bx, by - 12, 40, 0, 2 * Math.PI);
        } else {
          ctx.rect(bx - (rankTextWidth / 2) - 20, by - 37, rankTextWidth + 40, 50);
        }
        ctx.fill();
      }

      ctx.fillStyle = c.rankTextColor || '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(rankText, bx, by);
      addRegion(rd.badgeId, bx - (rankTextWidth / 2) - 25, by - 42, rankTextWidth + 50, 60);

      // Participant name
      ctx.textAlign = 'left';
      ctx.font = `800 ${c.winnerSize}px ${c.winnerFont || c.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = c.winnerColor;
      const nameText = 'Participant Name';
      ctx.fillText(nameText, nx, ny);
      const nameMetrics = ctx.measureText(nameText);
      addRegion(rd.nameId, nx - 5, ny - c.winnerSize - 5, nameMetrics.width + 10, c.winnerSize + 15);

      // Unit/Team name
      ctx.font = `700 ${c.unitSize}px ${c.unitFont || 'monospace'}`;
      ctx.fillStyle = c.unitColor;
      const unitText = 'UNIT NAME';
      ctx.fillText(unitText, ux, uy);
      const unitMetrics = ctx.measureText(unitText);
      addRegion(rd.unitId, ux - 5, uy - c.unitSize - 5, unitMetrics.width + 10, c.unitSize + 15);
    });

    // Footer
    if (c.showFooter !== false) {
      if (c.showFooterBg) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, H - 180, W, 180);
      }
      const line1 = c.footerLine1 || `OFFICIAL WINNERS ANNOUNCEMENT \u2022 ${festivalName.toUpperCase()}`;
      const line2 = c.footerLine2 || `Generated live by ${campusName} ${festivalName} Management Portal`;

      ctx.textAlign = 'center';
      ctx.font = `800 28px ${c.fontFamily}`;
      ctx.fillStyle = c.titleColor;
      ctx.fillText(line1, W / 2, H - 100);

      ctx.font = '600 20px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(line2, W / 2, H - 55);
    }

    hitRegions.current = regions;
  };

  useEffect(() => {
    const themeUrl = customThemes[selectedThemeIndex];
    if (themeUrl) {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setImgLoaded(prev => !prev);
      };
      img.src = themeUrl;
    } else {
      imgRef.current = null;
      setImgLoaded(prev => !prev);
    }
  }, [selectedThemeIndex, customThemes]);

  useEffect(() => {
    renderCanvas();
  }, [selectedThemeIndex, customThemes, themeConfigs, hoveredElement, dragging, imgLoaded]);

  // Sidebar sections collapse
  const [expandedSection, setExpandedSection] = useState<string>('themes');

  if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.SECTOR_TEAM) {
    return <div className="p-8 text-center">Access Denied</div>;
  }

  const SectionHeader = ({ id, title, icon: Icon }: { id: string, title: string, icon: any }) => (
    <button
      onClick={() => setExpandedSection(expandedSection === id ? '' : id)}
      className="flex items-center justify-between w-full text-xs font-extrabold text-slate-800 uppercase tracking-wider font-mono p-1"
    >
      <span className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-emerald-600" />
        {title}
      </span>
      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedSection === id ? 'rotate-180' : ''}`} />
    </button>
  );

  const RangeControl = ({ label, value, onChange, min, max }: { label: string, value: number, onChange: (v: number) => void, min: number, max: number }) => (
    <div>
      <label className="block text-[10px] font-bold text-slate-400 mb-1 flex justify-between">
        {label} <span className="text-slate-600">{value}</span>
      </label>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-emerald-600" />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 font-sans min-w-0 w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 p-6 rounded-3xl text-white shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Admin Studio
            </span>
          </div>
          <h2 className="font-display font-extrabold text-2xl mt-1 text-white">Poster Layout Studio</h2>
          <p className="text-emerald-200/80 text-xs mt-0.5">Customize per-theme styles and positions for result posters. Each theme has its own layout.</p>
        </div>
        <button
          onClick={saveTemplate}
          disabled={savingTemplate}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition disabled:opacity-50 shadow-lg shadow-emerald-900/30"
        >
          <Save className="w-4 h-4" />
          {savingTemplate ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-5 space-y-4 max-h-[85vh] overflow-y-auto pr-2 pb-20">

          {/* Themes Manager */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="themes" title={`Themes (${customThemes.length}/10)`} icon={Palette} />
            {expandedSection === 'themes' && (
              <>
                <p className="text-[10px] text-slate-500">Select a theme to edit its layout. Each theme saves its own settings independently.</p>
                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  {customThemes.map((th, idx) => (
                    <div key={idx} className="relative group">
                      <button
                        onClick={() => setSelectedThemeIndex(idx)}
                        className={`w-full p-2 rounded-2xl border text-left transition-all cursor-pointer overflow-hidden ${selectedThemeIndex === idx
                          ? 'border-emerald-600 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        <img src={th} alt={`Theme ${idx + 1}`} className="w-full h-16 object-cover rounded-xl" />
                        <div className="flex items-center justify-between mt-1.5 px-1">
                          <span className="text-[10px] font-bold text-slate-600">Theme {idx + 1}</span>
                          {themeConfigs[idx] && (
                            <span className="text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">Configured</span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setCustomThemes(prev => prev.filter((_, i) => i !== idx));
                          setThemeConfigs((prev: any) => {
                            const newConfigs = { ...prev };
                            delete newConfigs[idx];
                            // Re-index
                            const reindexed: any = {};
                            Object.keys(newConfigs).forEach(k => {
                              const ki = Number(k);
                              if (ki > idx) reindexed[ki - 1] = newConfigs[ki];
                              else reindexed[ki] = newConfigs[ki];
                            });
                            return reindexed;
                          });
                          if (selectedThemeIndex === idx) setSelectedThemeIndex(0);
                          else if (selectedThemeIndex > idx) setSelectedThemeIndex(prev => prev - 1);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {customThemes.length < 10 && (
                  <label className="flex items-center justify-center gap-2 p-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-2xl text-xs cursor-pointer border border-dashed border-slate-300 transition-colors">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>Upload Custom Theme</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const result = ev.target?.result as string;
                            setCustomThemes(prev => {
                              const newThemes = [...prev, result];
                              setSelectedThemeIndex(newThemes.length - 1);
                              return newThemes;
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
              </>
            )}
          </div>

          {/* Theme Assignment Rules */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="rules" title="Theme Assignment Rules" icon={Layers} />
            {expandedSection === 'rules' && (
              <>
                <p className="text-[10px] text-slate-500 mb-2">Map themes to result number ranges or competition categories.</p>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <button
                    onClick={() => setThemeRules([...themeRules, { id: Date.now(), type: 'resultRange', startResult: 1, endResult: 10, themeIndex: 0 }])}
                    className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Result Range Rule
                  </button>
                  <button
                    onClick={() => {
                      const firstCat = categories[0];
                      const firstCatId = firstCat ? (firstCat.id || firstCat.name || firstCat) : '';
                      const firstCatName = firstCat ? (firstCat.name || firstCat) : '';
                      setThemeRules([...themeRules, { id: Date.now(), type: 'category', categoryId: firstCatId, categoryName: firstCatName, themeIndex: 0 }]);
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Category Rule
                  </button>
                </div>
                {themeRules.map((rule, idx) => {
                  const isCategoryRule = rule.type === 'category' || (!rule.type && (rule.categoryId || rule.categoryName));
                  return (
                    <div key={rule.id || idx} className="p-3 border border-slate-200 rounded-xl bg-slate-50 relative flex flex-col gap-2.5">
                      <button
                        onClick={() => setThemeRules(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute -top-2 -right-2 bg-slate-200 hover:bg-red-500 hover:text-white text-slate-600 rounded-full p-1 transition-colors z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>

                      {/* Rule Type Selector */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Rule Type</span>
                        <select
                          value={isCategoryRule ? 'category' : 'resultRange'}
                          onChange={e => {
                            const newType = e.target.value;
                            const newRules = [...themeRules];
                            if (newType === 'category') {
                              const firstCat = categories[0];
                              newRules[idx] = {
                                ...newRules[idx],
                                type: 'category',
                                categoryId: newRules[idx].categoryId || (firstCat?.id || firstCat?.name || ''),
                                categoryName: newRules[idx].categoryName || (firstCat?.name || '')
                              };
                            } else {
                              newRules[idx] = {
                                ...newRules[idx],
                                type: 'resultRange',
                                startResult: newRules[idx].startResult || 1,
                                endResult: newRules[idx].endResult || 10
                              };
                            }
                            setThemeRules(newRules);
                          }}
                          className="text-xs font-bold px-2 py-0.5 border rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          <option value="resultRange">Result Number Range</option>
                          <option value="category">Category Wise</option>
                        </select>
                      </div>

                      {/* Rule Inputs */}
                      {isCategoryRule ? (
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>
                          <select
                            value={rule.categoryId || rule.categoryName || ''}
                            onChange={e => {
                              const val = e.target.value;
                              const matched = categories.find(c => (c.id && c.id === val) || (c.name && c.name === val) || c === val);
                              const catId = matched?.id || val;
                              const catName = matched?.name || val;
                              const newRules = [...themeRules];
                              newRules[idx] = {
                                ...newRules[idx],
                                categoryId: catId,
                                categoryName: catName
                              };
                              setThemeRules(newRules);
                            }}
                            className="w-full text-xs p-1.5 border rounded bg-white font-medium text-slate-800"
                          >
                            {categories.length === 0 && <option value="">No categories available</option>}
                            {categories.map((cat, cIdx) => {
                              const catVal = cat.id || cat.name || cat;
                              const catLabel = cat.name || cat;
                              return (
                                <option key={cat.id || cIdx} value={catVal}>
                                  {catLabel}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600">Result</span>
                          <input
                            type="number"
                            value={rule.startResult ?? 1}
                            onChange={e => { const newRules = [...themeRules]; newRules[idx].startResult = Number(e.target.value); setThemeRules(newRules); }}
                            className="w-16 px-2 py-1 text-xs border rounded bg-white text-slate-800"
                          />
                          <span className="text-xs font-bold text-slate-600">to</span>
                          <input
                            type="number"
                            value={rule.endResult ?? 10}
                            onChange={e => { const newRules = [...themeRules]; newRules[idx].endResult = Number(e.target.value); setThemeRules(newRules); }}
                            className="w-16 px-2 py-1 text-xs border rounded bg-white text-slate-800"
                          />
                        </div>
                      )}

                      {/* Theme Selector */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Assigned Theme</label>
                        <select
                          value={rule.themeIndex ?? 0}
                          onChange={e => { const newRules = [...themeRules]; newRules[idx].themeIndex = Number(e.target.value); setThemeRules(newRules); }}
                          className="w-full text-xs p-1.5 border rounded bg-white font-medium text-slate-800"
                        >
                          {customThemes.map((_, i) => <option key={i} value={i}>Theme {i + 1}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Colors */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="colors" title={`Colors \u2014 Theme ${selectedThemeIndex + 1}`} icon={Palette} />
            {expandedSection === 'colors' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Campus Name Color</label>
                  <input type="color" value={conf.campusNameColor || '#ffffff'} onChange={e => updateConf('campusNameColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Fest Name Color</label>
                  <input type="color" value={conf.festNameColor || '#fbbf24'} onChange={e => updateConf('festNameColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Category Color</label>
                  <input type="color" value={conf.categoryColor || 'rgba(255, 255, 255, 0.7)'} onChange={e => updateConf('categoryColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Competition Color</label>
                  <input type="color" value={conf.compNameColor || '#ffffff'} onChange={e => updateConf('compNameColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Result Label Color</label>
                  <input type="color" value={conf.resultLabelColor || '#ffffff'} onChange={e => updateConf('resultLabelColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Result Number Color</label>
                  <input type="color" value={conf.resultNumColor || '#ffffff'} onChange={e => updateConf('resultNumColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Winner Name Color</label>
                  <input type="color" value={conf.winnerColor} onChange={e => updateConf('winnerColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Unit Name Color</label>
                  <input type="color" value={conf.unitColor} onChange={e => updateConf('unitColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Rank Text Color</label>
                  <input type="color" value={conf.rankTextColor} onChange={e => updateConf('rankTextColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
              </div>
            )}
          </div>

          {/* Typography */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="typography" title={`Typography \u2014 Theme ${selectedThemeIndex + 1}`} icon={Layers} />
            {expandedSection === 'typography' && (
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Visibility Toggles</span>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={conf.showCampusName !== false} onChange={e => updateConf('showCampusName', e.target.checked)} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">Show Campus Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={conf.showFestName !== false} onChange={e => updateConf('showFestName', e.target.checked)} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">Show Fest Name</span>
                    </label>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Block Letters (Uppercase) Options</span>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={conf.campusNameUppercase !== false} onChange={e => updateConf('campusNameUppercase', e.target.checked)} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">Campus Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={conf.festNameUppercase !== false} onChange={e => updateConf('festNameUppercase', e.target.checked)} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">Fest Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={conf.resultLabelUppercase !== false} onChange={e => updateConf('resultLabelUppercase', e.target.checked)} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">Result Label</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!conf.resultNumUppercase} onChange={e => updateConf('resultNumUppercase', e.target.checked)} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">Result Number</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={conf.categoryUppercase !== false} onChange={e => updateConf('categoryUppercase', e.target.checked)} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">Category Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!conf.compNameUppercase} onChange={e => updateConf('compNameUppercase', e.target.checked)} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">Competition Name</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!conf.winnerUppercase} onChange={e => updateConf('winnerUppercase', e.target.checked)} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">Winner Names</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={conf.unitUppercase !== false} onChange={e => updateConf('unitUppercase', e.target.checked)} className="accent-emerald-600" />
                      <span className="text-xs font-bold text-slate-700">Unit Names</span>
                    </label>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Font Families</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Campus Font</label>
                      <select value={conf.campusNameFont || 'sans-serif'} onChange={e => updateConf('campusNameFont', e.target.value)} className="w-full text-xs p-1.5 border rounded">
                        <option value="sans-serif">Sans Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option><option value="'Inter', sans-serif">Inter</option><option value="'Roboto', sans-serif">Roboto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Fest Font</label>
                      <select value={conf.festNameFont || 'sans-serif'} onChange={e => updateConf('festNameFont', e.target.value)} className="w-full text-xs p-1.5 border rounded">
                        <option value="sans-serif">Sans Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option><option value="'Inter', sans-serif">Inter</option><option value="'Roboto', sans-serif">Roboto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Category Font</label>
                      <select value={conf.categoryFont || 'sans-serif'} onChange={e => updateConf('categoryFont', e.target.value)} className="w-full text-xs p-1.5 border rounded">
                        <option value="sans-serif">Sans Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option><option value="'Inter', sans-serif">Inter</option><option value="'Roboto', sans-serif">Roboto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Competition Font</label>
                      <select value={conf.compNameFont || 'sans-serif'} onChange={e => updateConf('compNameFont', e.target.value)} className="w-full text-xs p-1.5 border rounded">
                        <option value="sans-serif">Sans Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option><option value="'Inter', sans-serif">Inter</option><option value="'Roboto', sans-serif">Roboto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Result Label Font</label>
                      <select value={conf.resultLabelFont || 'sans-serif'} onChange={e => updateConf('resultLabelFont', e.target.value)} className="w-full text-xs p-1.5 border rounded">
                        <option value="sans-serif">Sans Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option><option value="'Inter', sans-serif">Inter</option><option value="'Roboto', sans-serif">Roboto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Result Num Font</label>
                      <select value={conf.resultNumFont || 'sans-serif'} onChange={e => updateConf('resultNumFont', e.target.value)} className="w-full text-xs p-1.5 border rounded">
                        <option value="sans-serif">Sans Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option><option value="'Inter', sans-serif">Inter</option><option value="'Roboto', sans-serif">Roboto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Winner Name Font</label>
                      <select value={conf.winnerFont || 'sans-serif'} onChange={e => updateConf('winnerFont', e.target.value)} className="w-full text-xs p-1.5 border rounded">
                        <option value="sans-serif">Sans Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option><option value="'Inter', sans-serif">Inter</option><option value="'Roboto', sans-serif">Roboto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Unit Name Font</label>
                      <select value={conf.unitFont || 'monospace'} onChange={e => updateConf('unitFont', e.target.value)} className="w-full text-xs p-1.5 border rounded">
                        <option value="sans-serif">Sans Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option><option value="'Inter', sans-serif">Inter</option><option value="'Roboto', sans-serif">Roboto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Rank Font</label>
                      <select value={conf.rankFont || 'sans-serif'} onChange={e => updateConf('rankFont', e.target.value)} className="w-full text-xs p-1.5 border rounded">
                        <option value="sans-serif">Sans Serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option><option value="'Inter', sans-serif">Inter</option><option value="'Roboto', sans-serif">Roboto</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Result Label Text Word</label>
                  <input type="text" value={conf.resultLabelText || 'RESULT'} onChange={e => updateConf('resultLabelText', e.target.value)} className="w-full px-3 py-1.5 text-sm border rounded-lg" placeholder="RESULT" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={conf.uppercaseNames} onChange={e => updateConf('uppercaseNames', e.target.checked)} className="accent-emerald-600" />
                  <span className="text-sm font-bold text-slate-700">Force Uppercase Names</span>
                </label>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl">
                  <RangeControl label="Campus Size" value={conf.campusNameSize ?? 28} onChange={v => updateConf('campusNameSize', v)} min={12} max={60} />
                  <RangeControl label="Fest Size" value={conf.festNameSize ?? 36} onChange={v => updateConf('festNameSize', v)} min={16} max={80} />
                  <RangeControl label="Result Label Size" value={conf.resultLabelSize || 28} onChange={v => updateConf('resultLabelSize', v)} min={14} max={80} />
                  <RangeControl label="Result Number Size" value={conf.resultNumSize || 28} onChange={v => updateConf('resultNumSize', v)} min={14} max={80} />
                  <RangeControl label="Category Size" value={conf.categorySize} onChange={v => updateConf('categorySize', v)} min={16} max={80} />
                  <RangeControl label="Comp Name Size" value={conf.compNameSize} onChange={v => updateConf('compNameSize', v)} min={20} max={100} />
                  <RangeControl label="Winner Name Size" value={conf.winnerSize} onChange={v => updateConf('winnerSize', v)} min={20} max={80} />
                  <RangeControl label="Unit Name Size" value={conf.unitSize} onChange={v => updateConf('unitSize', v)} min={14} max={60} />
                  <RangeControl label="Rank Badge Size" value={conf.rankSize} onChange={v => updateConf('rankSize', v)} min={16} max={80} />
                </div>
              </div>
            )}
          </div>

          {/* Rank Badges */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="ranks" title={`Rank Badges \u2014 Theme ${selectedThemeIndex + 1}`} icon={Award} />
            {expandedSection === 'ranks' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Badge Shape</label>
                  <select value={conf.rankBadgeShape} onChange={e => updateConf('rankBadgeShape', e.target.value)} className="w-full text-sm p-2 border rounded">
                    <option value="pill">Pill (Rounded)</option>
                    <option value="circle">Circle</option>
                    <option value="rectangle">Rectangle</option>
                    <option value="none">None (Hide Shape)</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <label className="block text-[10px] font-bold text-amber-700 mb-1">Rank 1 Text</label>
                    <input type="text" value={conf.rank1Text} onChange={e => updateConf('rank1Text', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-amber-300 rounded-lg bg-white" placeholder="e.g. 1, 1st, Rank 1" />
                    <div className="flex items-center gap-2 mt-2">
                      <label className="text-[10px] font-bold text-amber-600">Badge Color</label>
                      <input type="color" value={conf.rank1Color} onChange={e => updateConf('rank1Color', e.target.value)} className="w-8 h-6 rounded border" />
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">Rank 2 Text</label>
                    <input type="text" value={conf.rank2Text} onChange={e => updateConf('rank2Text', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white" placeholder="e.g. 2, 2nd, Rank 2" />
                    <div className="flex items-center gap-2 mt-2">
                      <label className="text-[10px] font-bold text-slate-500">Badge Color</label>
                      <input type="color" value={conf.rank2Color} onChange={e => updateConf('rank2Color', e.target.value)} className="w-8 h-6 rounded border" />
                    </div>
                  </div>
                  <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                    <label className="block text-[10px] font-bold text-orange-700 mb-1">Rank 3 Text</label>
                    <input type="text" value={conf.rank3Text} onChange={e => updateConf('rank3Text', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-orange-300 rounded-lg bg-white" placeholder="e.g. 3, 3rd, Rank 3" />
                    <div className="flex items-center gap-2 mt-2">
                      <label className="text-[10px] font-bold text-orange-600">Badge Color</label>
                      <input type="color" value={conf.rank3Color} onChange={e => updateConf('rank3Color', e.target.value)} className="w-8 h-6 rounded border" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Options */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="footer" title={`Footer Options \u2014 Theme ${selectedThemeIndex + 1}`} icon={Layers} />
            {expandedSection === 'footer' && (
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={conf.showFooter !== false} onChange={e => updateConf('showFooter', e.target.checked)} className="accent-emerald-600" />
                  <span className="text-sm font-bold text-slate-700">Show Footer Text</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!conf.showFooterBg} onChange={e => updateConf('showFooterBg', e.target.checked)} className="accent-emerald-600" />
                  <span className="text-sm font-bold text-slate-700">Show Dark Background Rectangle</span>
                </label>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Footer Line 1 Text</label>
                  <input type="text" value={conf.footerLine1 || ''} onChange={e => updateConf('footerLine1', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white" placeholder={`OFFICIAL WINNERS ANNOUNCEMENT • ${festivalName.toUpperCase()}`} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Footer Line 2 Text</label>
                  <input type="text" value={conf.footerLine2 || ''} onChange={e => updateConf('footerLine2', e.target.value)} className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-white" placeholder={`Generated live by ${campusName} ${festivalName} Management Portal`} />
                </div>
              </div>
            )}
          </div>

          {/* Position Fine-Tuning */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="positions" title={`Positions \u2014 Theme ${selectedThemeIndex + 1}`} icon={Move} />
            {expandedSection === 'positions' && (
              <div className="space-y-4">
                <p className="text-[10px] text-slate-500">You can also drag elements directly on the preview canvas.</p>

                <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Header Elements</span>
                  <div className="grid grid-cols-2 gap-3">
                    <RangeControl label="Campus X" value={conf.campusNameX ?? 540} onChange={v => updateConf('campusNameX', v)} min={0} max={1080} />
                    <RangeControl label="Campus Y" value={conf.campusNameY ?? 70} onChange={v => updateConf('campusNameY', v)} min={30} max={400} />
                    <RangeControl label="Fest X" value={conf.festNameX ?? 540} onChange={v => updateConf('festNameX', v)} min={0} max={1080} />
                    <RangeControl label="Fest Y" value={conf.festNameY ?? 120} onChange={v => updateConf('festNameY', v)} min={30} max={400} />
                    <RangeControl label="Result Label X" value={conf.resultLabelX ?? 470} onChange={v => updateConf('resultLabelX', v)} min={0} max={1080} />
                    <RangeControl label="Result Label Y" value={conf.resultLabelY ?? 180} onChange={v => updateConf('resultLabelY', v)} min={30} max={500} />
                    <RangeControl label="Result Number X" value={conf.resultNumX ?? 600} onChange={v => updateConf('resultNumX', v)} min={0} max={1080} />
                    <RangeControl label="Result Number Y" value={conf.resultNumY ?? 180} onChange={v => updateConf('resultNumY', v)} min={30} max={500} />
                    <RangeControl label="Category X" value={conf.categoryX} onChange={v => updateConf('categoryX', v)} min={0} max={1080} />
                    <RangeControl label="Category Y" value={conf.categoryY} onChange={v => updateConf('categoryY', v)} min={50} max={600} />
                    <RangeControl label="Comp Name X" value={conf.compNameX} onChange={v => updateConf('compNameX', v)} min={0} max={1080} />
                    <RangeControl label="Comp Name Y" value={conf.compNameY} onChange={v => updateConf('compNameY', v)} min={50} max={700} />
                  </div>
                </div>

                {[1, 2, 3].map(rank => (
                  <div key={rank} className={`p-3 rounded-xl space-y-2 ${rank === 1 ? 'bg-amber-50 border border-amber-200' : rank === 2 ? 'bg-slate-50 border border-slate-200' : 'bg-orange-50 border border-orange-200'}`}>
                    <span className={`text-[10px] font-bold uppercase ${rank === 1 ? 'text-amber-700' : rank === 2 ? 'text-slate-600' : 'text-orange-700'}`}>Rank {rank} Elements</span>
                    <div className="grid grid-cols-2 gap-3">
                      <RangeControl label="Badge X" value={conf[`rank${rank}BadgeX`]} onChange={v => updateConf(`rank${rank}BadgeX`, v)} min={0} max={1080} />
                      <RangeControl label="Badge Y" value={conf[`rank${rank}BadgeY`]} onChange={v => updateConf(`rank${rank}BadgeY`, v)} min={100} max={1200} />
                      <RangeControl label="Name X" value={conf[`rank${rank}NameX`]} onChange={v => updateConf(`rank${rank}NameX`, v)} min={0} max={1080} />
                      <RangeControl label="Name Y" value={conf[`rank${rank}NameY`]} onChange={v => updateConf(`rank${rank}NameY`, v)} min={100} max={1200} />
                      <RangeControl label="Unit X" value={conf[`rank${rank}UnitX`]} onChange={v => updateConf(`rank${rank}UnitX`, v)} min={0} max={1080} />
                      <RangeControl label="Unit Y" value={conf[`rank${rank}UnitY`]} onChange={v => updateConf(`rank${rank}UnitY`, v)} min={100} max={1200} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save button at bottom of sidebar */}
          {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SECTOR_TEAM) && (
            <button
              onClick={saveTemplate}
              disabled={savingTemplate}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {savingTemplate ? 'Saving...' : 'Save All Poster Settings'}
            </button>
          )}
        </div>

        {/* Preview Canvas */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-lg w-full flex flex-col items-center">
            <div className="flex items-center justify-between w-full pb-3 border-b border-slate-100 mb-4 px-2">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider font-mono">
                Default Template Preview \u2014 Theme {selectedThemeIndex + 1}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Drag any element to reposition</span>
            </div>

            <canvas
              ref={canvasRef}
              className="max-w-full h-auto rounded-2xl shadow-sm border border-slate-800/10 cursor-move touch-none select-none"
              style={{ maxHeight: '680px' }}
              onPointerDown={handleDragStart}
              onTouchStart={handleDragStart}
              onMouseDown={handleDragStart}
              onMouseMove={handleHoverMove}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
