import React, { useState, useEffect, useRef } from 'react';
import {
  Award, Trophy, Image as ImageIcon, Download, Upload, Search, Filter, X,
  Sparkles, RefreshCw, Palette, Layers, CheckCircle2, ChevronDown, Save
} from 'lucide-react';
import { User, Category, Unit, Participant, Competition, Result, Team, UserRole } from '../types';

const getBgHash = (bg: string) => {
  if (!bg || typeof bg !== 'string') return '';
  return bg.length > 200 ? `hash_${bg.length}_${bg.slice(-30)}` : bg;
};

interface PosterGeneratorViewProps {
  user: User;
  token: string;
  eventSettings?: any;
  onSettingsUpdated?: () => void;
}

const FONT_OPTIONS = [
  { label: 'Inter (Clean Sans)', value: 'Inter, sans-serif' },
  { label: 'Montserrat (Modern Bold)', value: 'Montserrat, sans-serif' },
  { label: 'Outfit (Sleek Geometric)', value: 'Outfit, sans-serif' },
  { label: 'Roboto (Standard)', value: 'Roboto, sans-serif' },
  { label: 'Poppins (Friendly)', value: 'Poppins, sans-serif' },
  { label: 'Playfair Display (Luxury Serif)', value: 'Playfair Display, serif' },
  { label: 'Cinzel (Classical Elegant)', value: 'Cinzel, serif' },
  { label: 'Oswald (Tall Block)', value: 'Oswald, sans-serif' },
  { label: 'Courier New (Monospace)', value: 'Courier New, monospace' },
  { label: 'Georgia (Editorial Serif)', value: 'Georgia, serif' },
  { label: 'Great Vibes (Script Signature)', value: 'Great Vibes, cursive' }
];

// Default config for a single theme (must match PosterSettingsView)
function getDefaultThemeConfig(): any {
  return {
    titleColor: '#fbbf24',
    winnerColor: '#ffffff',
    unitColor: '#34d399',
    titleSize: 36,
    resultLabelText: 'RESULT',
    resultLabelX: 470,
    resultLabelY: 180,
    resultLabelSize: 28,
    resultLabelColor: '#ffffff',
    resultNumX: 600,
    resultNumY: 180,
    resultNumSize: 28,
    resultNumColor: '#ffffff',
    categorySize: 32,
    compNameSize: 52,
    winnerSize: 44,
    unitSize: 30,
    rankSize: 38,
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
    fontFamily: 'sans-serif',
    uppercaseNames: false,
    rankBadgeShape: 'pill',
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

// Migrate old flat config to per-theme (same logic as PosterSettingsView)
function migrateOldConfig(templateConfig: any, defaultThemes: string[]): any {
  if (templateConfig.themeConfigs) {
    return templateConfig;
  }
  const oldConf = { ...templateConfig };
  const customThemes = oldConf.customThemes || defaultThemes;
  const themeRules = oldConf.themeRules || [];
  delete oldConf.customThemes;
  delete oldConf.themeRules;

  if (oldConf.badgeX !== undefined) {
    oldConf.resultLabelX = oldConf.resultLabelX ?? (oldConf.badgeX - 60);
    oldConf.resultLabelY = oldConf.resultLabelY ?? oldConf.badgeY;
    oldConf.resultLabelSize = oldConf.resultLabelSize ?? (oldConf.badgeSize ?? 28);
    oldConf.resultNumX = oldConf.resultNumX ?? (oldConf.badgeX + 60);
    oldConf.resultNumY = oldConf.resultNumY ?? oldConf.badgeY;
    oldConf.resultNumSize = oldConf.resultNumSize ?? (oldConf.badgeSize ?? 28);
  }

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

  const themeConfigs: any = {};
  customThemes.forEach((_: any, idx: number) => {
    themeConfigs[idx] = { ...getDefaultThemeConfig(), ...oldConf };
  });

  return { customThemes, themeRules, themeConfigs };
}

export default function PostersView({ user, token, eventSettings, onSettingsUpdated }: PosterGeneratorViewProps) {
  const entityLabel = eventSettings?.entityMode === 'house' ? 'House' : eventSettings?.entityMode === 'team' ? 'Team' : 'Unit';
  const festivalName = eventSettings?.festivalName || 'Sahityotsav';
  const campusName = eventSettings?.campusName || eventSettings?.sectorName || 'Campus';

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Result[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Selection states
  const [selectedCompId, setSelectedCompId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const defaultThemes = [
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgwIiBoZWlnaHQ9IjEzNTAiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZzEiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDIwNjE3Ii8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiMwZjE3MmEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxZTFiNGIiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTA4MCIgaGVpZ2h0PSIxMzUwIiBmaWxsPSJ1cmwoI2cxKSIvPjwvc3ZnPg==',
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgwIiBoZWlnaHQ9IjEzNTAiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZzIiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDIyYzIyIi8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiMwNjRlM2IiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMwNjVmNDYiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTA4MCIgaGVpZ2h0PSIxMzUwIiBmaWxsPSJ1cmwoI2cyKSIvPjwvc3ZnPg==',
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgwIiBoZWlnaHQ9IjEzNTAiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZzMiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjNDUwYTBhIi8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiM4ODEzMzciLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiM5ZjEyMzkiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTA4MCIgaGVpZ2h0PSIxMzUwIiBmaWxsPSJ1cmwoI2czKSIvPjwvc3ZnPg==',
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDgwIiBoZWlnaHQ9IjEzNTAiPjxkZWZzPjxsaW5lYXJHcmFkaWVudCBpZD0iZzQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjMDkwOTBiIi8+PHN0b3Agb2Zmc2V0PSI1MCUiIHN0b3AtY29sb3I9IiMxODE4MWIiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMyNzI3MmEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTA4MCIgaGVpZ2h0PSIxMzUwIiBmaWxsPSJ1cmwoI2c0KSIvPjwvc3ZnPg=='
  ];

  const rawTemplateConfig = eventSettings?.posterTemplateConfig || {};
  const migratedConfig = migrateOldConfig({
    ...rawTemplateConfig,
    customThemes: rawTemplateConfig.customThemes || defaultThemes
  }, defaultThemes);

  const customThemes: string[] = migratedConfig.customThemes || defaultThemes;
  const themeRules: any[] = migratedConfig.themeRules || [];
  const themeConfigs: any = migratedConfig.themeConfigs || {};

  const [localThemeConfigs, setLocalThemeConfigs] = useState<any>({});
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      setLocalThemeConfigs(themeConfigs || {});
    }
  }, [isModalOpen, themeConfigs]);

  const getThemeConfig = (idx: number) => {
    const aComp = competitions.find(c => c.id === selectedCompId);
    const compOverride = (eventSettings?.posterOverrides && aComp?.name && eventSettings.posterOverrides[aComp.name]) ||
                         (eventSettings?.posterOverrides && selectedCompId && eventSettings.posterOverrides[selectedCompId]);
    const isOverrideValid = compOverride && (compOverride._savedThemeIndex === undefined || compOverride._savedThemeIndex === idx);
    const baseTheme = { ...getDefaultThemeConfig(), ...(themeConfigs[idx] || {}) };
    const savedLocal = localThemeConfigs[idx] || {};
    return { ...baseTheme, ...(isOverrideValid ? compOverride : {}), ...savedLocal };
  };

  const updateLocalConf = (key: string, value: any) => {
    const compIdx = getAnnouncementIndex(selectedCompId);
    const aComp = competitions.find(c => c.id === selectedCompId);
    const aCat = aComp ? categories.find(cat => cat.id === aComp.categoryId) : null;
    const themeIdx = getThemeIndexForResult(compIdx, aCat?.name, aCat?.id);
    setLocalThemeConfigs((prev: any) => ({
      ...prev,
      [themeIdx]: {
        ...(prev[themeIdx] || {}),
        [key]: value
      }
    }));
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const config = {
        customThemes,
        themeRules,
        themeConfigs: localThemeConfigs
      };
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ posterTemplateConfig: config })
      });
      if (!res.ok) throw new Error('Failed to save');
      alert('Poster default template layout saved successfully!');
    } catch (e) {
      alert('Failed to save poster layout');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveThisPosterOnly = async () => {
    if (!selectedCompId) return;
    setSavingTemplate(true);
    try {
      const aComp = competitions.find(c => c.id === selectedCompId);
      const aCat = aComp ? categories.find(cat => cat.id === aComp.categoryId) : null;
      const compIdx = getAnnouncementIndex(selectedCompId);
      const themeIdx = getThemeIndexForResult(compIdx, aCat?.name, aCat?.id);
      
      const individualConfig = {
        ...localThemeConfigs[themeIdx],
        _savedThemeIndex: themeIdx,
        _savedBgImageUrl: getBgHash(customThemes[themeIdx] || customThemes[0])
      };

      const updatedOverrides = {
        ...(eventSettings?.posterOverrides || {}),
        [selectedCompId]: individualConfig,
        [aComp?.name || '']: individualConfig
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ posterOverrides: updatedOverrides })
      });
      if (!res.ok) throw new Error('Failed to save');
      alert(`Saved custom layout positions & text overrides specifically for poster "${aComp?.name}"!`);
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (e) {
      alert('Failed to save poster override');
    } finally {
      setSavingTemplate(false);
    }
  };


  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drag Target logic inside PosterGeneratorView
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

  const hitRegions = useRef<{ id: string, x: number, y: number, w: number, h: number }[]>([]);

  // Helper to extract canvas X, Y coordinates from Mouse, Touch, or Pointer event
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const canvasAspect = canvas.width / canvas.height;
    const rectAspect = rect.width / rect.height;

    let actualWidth = rect.width;
    let actualHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (rectAspect > canvasAspect) {
      actualWidth = rect.height * canvasAspect;
      offsetX = (rect.width - actualWidth) / 2;
    } else {
      actualHeight = rect.width / canvasAspect;
      offsetY = (rect.height - actualHeight) / 2;
    }

    const scaleX = canvas.width / actualWidth;
    const scaleY = canvas.height / actualHeight;

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
      canvasX: (clientX - rect.left - offsetX) * scaleX,
      canvasY: (clientY - rect.top - offsetY) * scaleY,
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
      const canvasAspect = canvas.width / canvas.height;
      const rectAspect = rect.width / rect.height;

      let actualWidth = rect.width;
      let actualHeight = rect.height;

      if (rectAspect > canvasAspect) {
        actualWidth = rect.height * canvasAspect;
      } else {
        actualHeight = rect.width / canvasAspect;
      }

      const scaleX = canvas.width / actualWidth;
      const scaleY = canvas.height / actualHeight;

      const deltaClientX = clientX - lastMousePos.current.x;
      const deltaClientY = clientY - lastMousePos.current.y;

      const dx = deltaClientX * scaleX;
      const dy = deltaClientY * scaleY;

      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        const compIdx = getAnnouncementIndex(selectedCompId);
        const aComp = competitions.find(c => c.id === selectedCompId);
        const aCat = aComp ? categories.find(cat => cat.id === aComp.categoryId) : null;
        const themeIdx = getThemeIndexForResult(compIdx, aCat?.name, aCat?.id);
        const c = getThemeConfig(themeIdx);

        const posMap = dragPosMap[dragging];
        if (posMap) {
          updateLocalConf(posMap.xKey, Math.round((c[posMap.xKey] || 0) + dx));
          updateLocalConf(posMap.yKey, Math.round((c[posMap.yKey] || 0) + dy));
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
  }, [dragging, selectedCompId, customThemes, themeRules, themeConfigs, localThemeConfigs]);

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

  const RangeControl = ({ label, value, onChange, min, max }: { label: string, value: number, onChange: (v: number) => void, min: number, max: number }) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
        <span>{label}</span>
        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 5))}
            className="w-4 h-4 flex items-center justify-center bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-extrabold rounded active:scale-95 transition-colors"
            title="Step left (-5)"
          >
            -
          </button>
          <span className="w-8 text-center font-bold">{value}</span>
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + 5))}
            className="w-4 h-4 flex items-center justify-center bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-extrabold rounded active:scale-95 transition-colors"
            title="Step right (+5)"
          >
            +
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onInput={e => onChange(Number((e.target as HTMLInputElement).value))}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
      />
    </div>
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRes, catRes, unitRes, compRes, partRes, teamRes] = await Promise.all([
        fetch('/api/results', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/categories'),
        fetch('/api/units'),
        fetch('/api/competitions'),
        fetch('/api/participants', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/teams', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [resData, catData, unitData, compData, partData, teamData] = await Promise.all([
        resRes.json(), catRes.json(), unitRes.json(), compRes.json(), partRes.json(), teamRes.json()
      ]);

      setResults(resData);
      setCategories(catData);
      setUnits(unitData);
      setCompetitions(compData);
      setParticipants(partData);
      setTeams(teamData);

    } catch (e) {
      console.error("Failed to load poster data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sort competitions by announcement order (earliest result updatedAt first)
  const availableComps = competitions.filter(c => {
    return results.some(r => r.competitionId === c.id && r.rank);
  }).sort((a, b) => {
    const datesA = results.filter(r => r.competitionId === a.id && r.rank).map(r => r.updatedAt ? new Date(r.updatedAt).getTime() : 0).filter(t => !isNaN(t) && t > 0);
    const datesB = results.filter(r => r.competitionId === b.id && r.rank).map(r => r.updatedAt ? new Date(r.updatedAt).getTime() : 0).filter(t => !isNaN(t) && t > 0);
    const latestResultA = datesA.length > 0 ? Math.max(...datesA) : 0;
    const latestResultB = datesB.length > 0 ? Math.max(...datesB) : 0;
    return latestResultA - latestResultB; // Earlier announced first = Result #001
  });

  // Get the announcement index for a competition (1-based)
  const getAnnouncementIndex = (compId: string): number => {
    return availableComps.findIndex(c => c.id === compId) + 1;
  };

  // Determine which theme index to use for a given result number or category
  const getThemeIndexForResult = (resultNum: number, categoryName?: string, categoryId?: string): number => {
    const rule = themeRules.find((r: any) => {
      if (r.type === 'category' || r.categoryId || r.categoryName) {
        if (categoryId && r.categoryId && r.categoryId === categoryId) return true;
        if (categoryName && (r.categoryName || r.category)) {
          const rCat = (r.categoryName || r.category).toString().trim().toLowerCase();
          if (rCat === categoryName.trim().toLowerCase()) return true;
        }
        return false;
      }
      return resultNum >= r.startResult && resultNum <= r.endResult;
    });
    if (rule && rule.themeIndex !== undefined && rule.themeIndex < customThemes.length) {
      return rule.themeIndex;
    }
    // Legacy: check themeUrl
    if (rule && rule.themeUrl) {
      const idx = customThemes.indexOf(rule.themeUrl);
      if (idx >= 0) return idx;
    }
    return 0; // fallback to first theme
  };

  const activeComp = competitions.find(c => c.id === selectedCompId);
  const activeCategory = activeComp ? categories.find(cat => cat.id === activeComp.categoryId) : null;
  const compResults = results
    .filter(r => r.competitionId === selectedCompId && r.rank && r.rank <= 3)
    .sort((a, b) => (a.rank || 0) - (b.rank || 0));

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeComp) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const compIdx = getAnnouncementIndex(selectedCompId);
    const themeIdx = getThemeIndexForResult(compIdx, activeCategory?.name, activeCategory?.id);
    const backgroundSource = customThemes[themeIdx] || customThemes[0];

    if (backgroundSource) {
      const img = new Image();
      img.onload = () => {
        const W = img.naturalWidth || img.width || 1080;
        const H = img.naturalHeight || img.height || 1350;
        canvas.width = W;
        canvas.height = H;
        ctx.drawImage(img, 0, 0, W, H);
        drawPosterOverlay(ctx, W, H, compIdx, themeIdx);
      };
      img.src = backgroundSource;
    } else {
      const W = 1080;
      const H = 1350;
      canvas.width = W;
      canvas.height = H;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      drawPosterOverlay(ctx, W, H, compIdx, themeIdx);
    }
  };

  const drawPosterOverlay = (ctx: CanvasRenderingContext2D, W: number, H: number, compIdx: number, themeIdx: number) => {
    if (!activeComp) return;
    const c = getThemeConfig(themeIdx);

    const regions: { id: string, x: number, y: number, w: number, h: number }[] = [];
    const addRegion = (id: string, x: number, y: number, w: number, h: number) => {
      const touchPadding = 25;
      regions.push({ 
        id, 
        x: x - touchPadding, 
        y: y - touchPadding, 
        w: Math.max(w + touchPadding * 2, 60), 
        h: Math.max(h + touchPadding * 2, 60) 
      });
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

    // Formatted result number: 1 -> 01, 9 -> 09, 10 -> 10, 105 -> 105 (without #)
    const formattedNum = compIdx < 10 ? compIdx.toString().padStart(2, '0') : compIdx.toString();

    // Result Label Word (e.g. "RESULT")
    ctx.textAlign = 'left';
    ctx.font = `800 ${c.resultLabelSize || 28}px ${c.resultLabelFont || c.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = c.resultLabelColor || '#ffffff';
    const rawLbl = c.resultLabelText || 'RESULT';
    const rLblText = c.resultLabelUppercase !== false ? rawLbl.toUpperCase() : rawLbl;
    const rLblMetrics = ctx.measureText(rLblText);
    const rx = c.resultLabelX ?? 470;
    const ry = c.resultLabelY ?? 180;
    ctx.fillText(rLblText, rx, ry);
    addRegion('resultLabel', rx - 10, ry - (c.resultLabelSize || 28) - 5, rLblMetrics.width + 20, (c.resultLabelSize || 28) + 20);

    // Result Number (e.g. "01", "10", "105")
    ctx.textAlign = 'left';
    ctx.font = `800 ${c.resultNumSize || 28}px ${c.resultNumFont || c.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = c.resultNumColor || '#ffffff';
    const rNumX = c.resultNumX ?? 600;
    const rNumY = c.resultNumY ?? 180;
    ctx.fillText(formattedNum, rNumX, rNumY);
    const rNumMetrics = ctx.measureText(formattedNum);
    addRegion('resultNum', rNumX - 10, rNumY - (c.resultNumSize || 28) - 5, rNumMetrics.width + 20, (c.resultNumSize || 28) + 20);

    // Category
    ctx.textAlign = 'left';
    ctx.font = `800 ${c.categorySize ?? 32}px ${c.categoryFont || c.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = c.categoryColor || 'rgba(255, 255, 255, 0.7)';
    const rawCat = activeCategory?.name || 'GENERAL';
    const catText = c.categoryUppercase !== false ? rawCat.toUpperCase() : rawCat;
    const catMetrics = ctx.measureText(catText);
    const catX = c.categoryX ?? 540;
    const catY = c.categoryY ?? 260;
    ctx.fillText(catText, catX, catY);
    addRegion('category', catX - 10, catY - (c.categorySize ?? 32) - 5, catMetrics.width + 20, (c.categorySize ?? 32) + 20);

    // Competition Name
    const compFont = `900 ${c.compNameSize ?? 52}px ${c.compNameFont || c.fontFamily || 'sans-serif'}`;
    const rawComp = c.compNameOverride || activeComp.name;
    const compText = c.compNameUppercase ? rawComp.toUpperCase() : rawComp;
    const compX = c.compNameX ?? 540;
    const compY = c.compNameY ?? 330;

    const compLines = compText.split('\n').filter(Boolean);
    const compLineGap = (c.compNameSize ?? 52) * 1.15;
    ctx.textAlign = 'left';
    ctx.font = compFont;
    ctx.fillStyle = c.compNameColor || '#ffffff';

    let maxCompW = 0;
    compLines.forEach((line, i) => {
      ctx.fillText(line, compX, compY + i * compLineGap);
      const w = ctx.measureText(line).width;
      if (w > maxCompW) maxCompW = w;
    });
    addRegion('compName', compX - 10, compY - (c.compNameSize ?? 52) - 5, maxCompW + 20, (compLines.length * compLineGap) + 15);

    // Draw each rank with per-rank positions
    [1, 2, 3].forEach((rank) => {
      const res = compResults.find(r => r.rank === rank);
      const hasNameOverride = !!c[`rank${rank}NameOverride`];
      const hasUnitOverride = !!c[`rank${rank}UnitOverride`];

      // Skip drawing this rank if no database result and no manual text overrides exist
      if (!res && !hasNameOverride && !hasUnitOverride) return;

      let winnerName = 'Participant Name';
      let winnerUnit = 'Unit Name';

      if (res) {
        if (res.participantId) {
          const p = participants.find(part => part.id === res.participantId);
          if (p) {
            const rawName = p.fullName;
            winnerName = (c.winnerUppercase || c.uppercaseNames) ? rawName.toUpperCase() : rawName;
            const u = units.find(unit => unit.id === p.unitId);
            winnerUnit = u ? u.name : '';
          }
        } else if (res.teamId) {
          const t = teams.find(team => team.id === res.teamId);
          if (t) {
            const rawName = t.teamName || 'Group Team';
            winnerName = (c.winnerUppercase || c.uppercaseNames) ? rawName.toUpperCase() : rawName;
            const u = units.find(unit => unit.id === t.unitId);
            winnerUnit = u ? u.name : '';
          }
        }
      }

      if (hasNameOverride) {
        const rawOverride = c[`rank${rank}NameOverride`];
        winnerName = (c.winnerUppercase || c.uppercaseNames) ? rawOverride.toUpperCase() : rawOverride;
      }

      if (hasUnitOverride) {
        winnerUnit = c[`rank${rank}UnitOverride`];
      }

      const bx = c[`rank${rank}BadgeX`] ?? 140;
      const by = c[`rank${rank}BadgeY`] ?? (460 + (rank - 1) * 180);
      const nx = c[`rank${rank}NameX`] ?? 260;
      const ny = c[`rank${rank}NameY`] ?? (448 + (rank - 1) * 180);
      const ux = c[`rank${rank}UnitX`] ?? 260;
      const uy = c[`rank${rank}UnitY`] ?? (483 + (rank - 1) * 180);

      const rColor = rank === 1 ? c.rank1Color : rank === 2 ? c.rank2Color : c.rank3Color;
      const rankText = rank === 1 ? c.rank1Text : rank === 2 ? c.rank2Text : c.rank3Text;

      // Rank badge
      ctx.font = `900 ${c.rankSize}px ${c.rankFont || c.fontFamily || 'sans-serif'}`;
      const textWidth = ctx.measureText(rankText).width;

      if (c.rankBadgeShape !== 'none') {
        ctx.fillStyle = rColor;
        ctx.beginPath();
        if (c.rankBadgeShape === 'pill') {
          ctx.roundRect(bx - (textWidth / 2) - 20, by - 37, textWidth + 40, 50, 25);
        } else if (c.rankBadgeShape === 'circle') {
          ctx.arc(bx, by - 12, 40, 0, 2 * Math.PI);
        } else {
          ctx.rect(bx - (textWidth / 2) - 20, by - 37, textWidth + 40, 50);
        }
        ctx.fill();
      }

      ctx.fillStyle = c.rankTextColor || '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(rankText, bx, by);
      addRegion(`rank${rank}Badge`, bx - textWidth / 2 - 25, by - 42, textWidth + 50, 60);

      // Winner name (Supports 2-line text with \n)
      ctx.textAlign = 'left';
      ctx.font = `800 ${c.winnerSize}px ${c.winnerFont || c.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = c.winnerColor;

      const nameLines = winnerName.split('\n').filter(Boolean);
      const nameGap = (c.winnerSize ?? 44) * 1.15;
      let maxNameW = 0;
      nameLines.forEach((line, i) => {
        ctx.fillText(line, nx, ny + i * nameGap);
        const w = ctx.measureText(line).width;
        if (w > maxNameW) maxNameW = w;
      });
      addRegion(`rank${rank}Name`, nx - 5, ny - (c.winnerSize ?? 44) - 5, maxNameW + 10, (nameLines.length * nameGap) + 10);

      // Unit name (Supports 2-line text with \n)
      ctx.font = `700 ${c.unitSize}px ${c.unitFont || 'monospace'}`;
      ctx.fillStyle = c.unitColor;
      const unitText = c.unitUppercase !== false ? winnerUnit.toUpperCase() : winnerUnit;
      const unitLines = unitText.split('\n').filter(Boolean);
      const unitGap = (c.unitSize ?? 30) * 1.15;
      const calcUx = nx; 
      const calcUy = ny + (nameLines.length * nameGap) + 5;
      let maxUnitW = 0;
      unitLines.forEach((line, i) => {
        ctx.fillText(line, ux ?? calcUx, (uy ?? calcUy) + i * unitGap);
        const w = ctx.measureText(line).width;
        if (w > maxUnitW) maxUnitW = w;
      });
      addRegion(`rank${rank}Unit`, (ux ?? calcUx) - 5, (uy ?? calcUy) - (c.unitSize ?? 30) - 5, maxUnitW + 10, (unitLines.length * unitGap) + 10);
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
      ctx.font = `800 28px ${c.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = c.titleColor || '#fbbf24';
      ctx.fillText(line1, W / 2, H - 100);

      ctx.font = '600 20px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(line2, W / 2, H - 55);
    }

    hitRegions.current = regions;
  };

  useEffect(() => {
    if (!loading && selectedCompId) {
      renderCanvas();
    }
  }, [
    selectedCompId, isModalOpen, customThemes, themeRules, themeConfigs,
    localThemeConfigs, hoveredElement, dragging, loading
  ]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !activeComp) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
    const link = document.createElement('a');
    link.download = `Poster_${activeComp.name.replace(/\s+/g, '_')}_Result.jpg`;
    link.href = dataUrl;
    link.click();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <RefreshCw className="h-10 w-10 text-emerald-600 animate-spin mb-4" />
        <span className="text-slate-500 font-mono text-xs">Loading poster generator engine...</span>
      </div>
    );
  }

  const filteredCategories = categories.filter(cat =>
    selectedCategoryId ? cat.id === selectedCategoryId : true
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans min-w-0 w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 tracking-tight">
            Social Media Posters
          </h1>
          <p className="text-sm text-slate-500 mt-1">Generate and download result announcement posters for competitions</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 hover:bg-slate-50 rounded-full transition-colors group"
          title="Refresh Data"
        >
          <RefreshCw className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search competition name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
          />
        </div>
        <div className="md:w-64 relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all appearance-none"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-8">
        {filteredCategories.map(category => {
          const catComps = availableComps.filter(c => c.categoryId === category.id);
          const filteredComps = catComps.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (filteredComps.length === 0) return null;

          return (
            <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-2 h-6 bg-emerald-500 rounded-full" />
                  {category.name}
                </h2>
              </div>

              <div className="divide-y divide-slate-100">
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredComps.map(comp => {
                    const announcementIdx = getAnnouncementIndex(comp.id);
                    return (
                      <div key={comp.id} className="bg-slate-50 rounded-xl p-5 border border-slate-100 flex flex-col justify-between hover:border-emerald-200 transition-colors group">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-bold text-slate-800 text-sm">{comp.name}</h3>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                              Result {announcementIdx < 10 ? announcementIdx.toString().padStart(2, '0') : announcementIdx}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">Result Published</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCompId(comp.id);
                            setIsModalOpen(true);
                          }}
                          className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm shadow-emerald-600/20"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Generate Poster
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {availableComps.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-slate-100">
            <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">No Posters Available</h3>
            <p className="text-slate-500 text-sm mt-1">Results must be entered and announced first.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 font-sans ">
          <div className="bg-white rounded-3xl shadow-lg w-full max-w-5xl overflow-hidden flex flex-col md:flex-row max-h-[92vh]">
            
            {/* Left: Preview Canvas Area (Certificate Generator style) */}
            <div className="w-full md:flex-1 bg-slate-100 p-3 sm:p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 shrink-0 min-h-0 relative">
              <div className="mb-1.5 text-[10px] text-slate-500 font-mono flex items-center gap-1.5 shrink-0 bg-white/80 px-2.5 py-0.5 rounded-full shadow-2xs border border-slate-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Touch / Drag elements directly on canvas preview
              </div>
              <div className="relative shadow-sm border border-slate-200 rounded-xl overflow-hidden bg-white max-w-full flex items-center justify-center shrink-0">
                <canvas
                  ref={canvasRef}
                  className="w-auto h-auto max-h-[35vh] sm:max-h-[45vh] md:max-h-[75vh] max-w-full object-contain cursor-move touch-none select-none"
                  onPointerDown={handleDragStart}
                  onTouchStart={handleDragStart}
                  onMouseDown={handleDragStart}
                  onMouseMove={handleHoverMove}
                />
              </div>
            </div>

            {/* Right: Controls Sidebar (Certificate Generator style) */}
            {(() => {
              const compIdx = getAnnouncementIndex(selectedCompId);
              const themeIdx = getThemeIndexForResult(compIdx, activeCategory?.name, activeCategory?.id);
              const c = getThemeConfig(themeIdx);
              return (
                <div className="w-full md:w-80 lg:w-96 bg-white p-4 sm:p-6 overflow-y-auto flex flex-col max-h-[50vh] md:max-h-full justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-4 border-b pb-3">
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-500" />
                          Customize Poster
                        </h3>
                        <p className="text-[10px] text-slate-400 font-mono font-bold uppercase mt-0.5">
                          {activeComp ? `Result ${compIdx < 10 ? compIdx.toString().padStart(2, '0') : compIdx}` : 'Template Config'}
                        </p>
                      </div>
                      <button 
                        onClick={() => setIsModalOpen(false)} 
                        className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5">Manual Text Overrides</h4>
                        <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 space-y-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">Competition Display Name (Enter key for 2 lines)</label>
                            <textarea
                              rows={2}
                              value={c.compNameOverride ?? activeComp?.name ?? ''}
                              onChange={(e) => updateLocalConf('compNameOverride', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                              placeholder="Type competition name... Press Enter for 2 lines"
                            />
                          </div>

                          {[1, 2, 3].map(rank => {
                            const rankRes = compResults.find(r => r.rank === rank);
                            const defaultWinnerName = rankRes ? (rankRes.participantName || '') : '';
                            const defaultUnitName = rankRes ? (rankRes.unitName || '') : '';
                            return (
                              <div key={rank} className="pt-2 border-t border-emerald-200/50 space-y-2">
                                <span className="text-[10px] font-extrabold text-emerald-900 block">Rank {rank} Winner Text</span>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Winner Name (Enter key for 2 lines)</label>
                                  <textarea
                                    rows={2}
                                    value={c[`rank${rank}NameOverride`] !== undefined ? c[`rank${rank}NameOverride`] : defaultWinnerName}
                                    onChange={(e) => updateLocalConf(`rank${rank}NameOverride`, e.target.value)}
                                    className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                                    placeholder={`Rank ${rank} winner name... Press Enter for 2 lines`}
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Unit Name (Enter key for 2 lines)</label>
                                  <textarea
                                    rows={2}
                                    value={c[`rank${rank}UnitOverride`] !== undefined ? c[`rank${rank}UnitOverride`] : defaultUnitName}
                                    onChange={(e) => updateLocalConf(`rank${rank}UnitOverride`, e.target.value)}
                                    className="w-full px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                                    placeholder={`Rank ${rank} unit name... Press Enter for 2 lines`}
                                  />
                                </div>
                              </div>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Reset poster layout and overrides to theme defaults?')) {
                                const def = getDefaultThemeConfig();
                                setLocalThemeConfigs(prev => ({
                                  ...prev,
                                  [0]: def
                                }));
                              }
                            }}
                            className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-300 transition mt-2"
                          >
                            Reset to Theme Defaults
                          </button>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5">Typography & Font Styles</h4>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Competition Name Font</label>
                            <select
                              value={c.compNameFont || c.fontFamily || 'Inter, sans-serif'}
                              onChange={e => updateLocalConf('compNameFont', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                            >
                              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Winner Names Font</label>
                            <select
                              value={c.winnerFont || c.fontFamily || 'Inter, sans-serif'}
                              onChange={e => updateLocalConf('winnerFont', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                            >
                              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unit / Team Names Font</label>
                            <select
                              value={c.unitFont || c.fontFamily || 'Inter, sans-serif'}
                              onChange={e => updateLocalConf('unitFont', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                            >
                              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category Font</label>
                            <select
                              value={c.categoryFont || c.fontFamily || 'Inter, sans-serif'}
                              onChange={e => updateLocalConf('categoryFont', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                            >
                              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Header Campus Font</label>
                            <select
                              value={c.campusNameFont || c.fontFamily || 'Inter, sans-serif'}
                              onChange={e => updateLocalConf('campusNameFont', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                            >
                              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5">Header Position</h4>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                          <RangeControl label="Campus X" value={c.campusNameX ?? 540} onChange={v => updateLocalConf('campusNameX', v)} min={0} max={1080} />
                          <RangeControl label="Campus Y" value={c.campusNameY ?? 70} onChange={v => updateLocalConf('campusNameY', v)} min={30} max={400} />
                          <RangeControl label="Fest X" value={c.festNameX ?? 540} onChange={v => updateLocalConf('festNameX', v)} min={0} max={1080} />
                          <RangeControl label="Fest Y" value={c.festNameY ?? 120} onChange={v => updateLocalConf('festNameY', v)} min={30} max={400} />
                          <RangeControl label="Result Label X" value={c.resultLabelX ?? 470} onChange={v => updateLocalConf('resultLabelX', v)} min={0} max={1080} />
                          <RangeControl label="Result Label Y" value={c.resultLabelY ?? 180} onChange={v => updateLocalConf('resultLabelY', v)} min={30} max={500} />
                          <RangeControl label="Result Number X" value={c.resultNumX ?? 600} onChange={v => updateLocalConf('resultNumX', v)} min={0} max={1080} />
                          <RangeControl label="Result Number Y" value={c.resultNumY ?? 180} onChange={v => updateLocalConf('resultNumY', v)} min={30} max={500} />
                          <RangeControl label="Category X" value={c.categoryX ?? 540} onChange={v => updateLocalConf('categoryX', v)} min={0} max={1080} />
                          <RangeControl label="Category Y" value={c.categoryY ?? 260} onChange={v => updateLocalConf('categoryY', v)} min={50} max={600} />
                          <RangeControl label="Competition X" value={c.compNameX ?? 540} onChange={v => updateLocalConf('compNameX', v)} min={0} max={1080} />
                          <RangeControl label="Competition Y" value={c.compNameY ?? 330} onChange={v => updateLocalConf('compNameY', v)} min={50} max={700} />
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2.5">Block Letters</h4>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={c.campusNameUppercase !== false} onChange={e => updateLocalConf('campusNameUppercase', e.target.checked)} className="accent-emerald-600" />
                            <span className="text-xs font-bold text-slate-700">Campus Name</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={c.festNameUppercase !== false} onChange={e => updateLocalConf('festNameUppercase', e.target.checked)} className="accent-emerald-600" />
                            <span className="text-xs font-bold text-slate-700">Fest Name</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={c.resultLabelUppercase !== false} onChange={e => updateLocalConf('resultLabelUppercase', e.target.checked)} className="accent-emerald-600" />
                            <span className="text-xs font-bold text-slate-700">Result Label</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={!!c.resultNumUppercase} onChange={e => updateLocalConf('resultNumUppercase', e.target.checked)} className="accent-emerald-600" />
                            <span className="text-xs font-bold text-slate-700">Result Number</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={c.categoryUppercase !== false} onChange={e => updateLocalConf('categoryUppercase', e.target.checked)} className="accent-emerald-600" />
                            <span className="text-xs font-bold text-slate-700">Category Name</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={!!c.compNameUppercase} onChange={e => updateLocalConf('compNameUppercase', e.target.checked)} className="accent-emerald-600" />
                            <span className="text-xs font-bold text-slate-700">Competition Name</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={!!c.winnerUppercase} onChange={e => updateLocalConf('winnerUppercase', e.target.checked)} className="accent-emerald-600" />
                            <span className="text-xs font-bold text-slate-700">Winner Names</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={c.unitUppercase !== false} onChange={e => updateLocalConf('unitUppercase', e.target.checked)} className="accent-emerald-600" />
                            <span className="text-xs font-bold text-slate-700">Unit Names</span>
                          </label>
                        </div>
                      </div>

                      {[1, 2, 3].map(rank => (
                        <div key={rank} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                          <span className="text-[9px] font-bold text-slate-500 uppercase block">Rank {rank} Placements</span>
                          <RangeControl label="Badge X" value={c[`rank${rank}BadgeX`] ?? 140} onChange={v => updateLocalConf(`rank${rank}BadgeX`, v)} min={0} max={1080} />
                          <RangeControl label="Badge Y" value={c[`rank${rank}BadgeY`] ?? (460 + (rank - 1) * 180)} onChange={v => updateLocalConf(`rank${rank}BadgeY`, v)} min={100} max={1200} />
                          <RangeControl label="Name X" value={c[`rank${rank}NameX`] ?? 260} onChange={v => updateLocalConf(`rank${rank}NameX`, v)} min={0} max={1080} />
                          <RangeControl label="Name Y" value={c[`rank${rank}NameY`] ?? (448 + (rank - 1) * 180)} onChange={v => updateLocalConf(`rank${rank}NameY`, v)} min={100} max={1200} />
                          <RangeControl label="Unit X" value={c[`rank${rank}UnitX`] ?? 260} onChange={v => updateLocalConf(`rank${rank}UnitX`, v)} min={0} max={1080} />
                          <RangeControl label="Unit Y" value={c[`rank${rank}UnitY`] ?? (483 + (rank - 1) * 180)} onChange={v => updateLocalConf(`rank${rank}UnitY`, v)} min={100} max={1200} />
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 space-y-2 pt-4 border-t border-slate-100">
                      <button
                        onClick={handleDownload}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Download JPG (HD)
                      </button>

                      {(user.role === UserRole.SUPER_ADMIN || user.role === UserRole.SECTOR_TEAM) && (
                        <>
                          <button
                            onClick={handleSaveThisPosterOnly}
                            disabled={savingTemplate}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shadow-sm"
                          >
                            <Save className="w-4 h-4" />
                            {savingTemplate ? 'Saving...' : 'Save for THIS Poster Only'}
                          </button>
                          <button
                            onClick={handleSaveTemplate}
                            disabled={savingTemplate}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" />
                            {savingTemplate ? 'Saving...' : 'Save as Default Template (All)'}
                          </button>
                        </>
                      )}


                      <button
                        onClick={() => setIsModalOpen(false)}
                        className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                      >
                        Cancel & Go Back
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
