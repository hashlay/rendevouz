import React, { useState, useEffect, useRef } from 'react';
import {
  Award, Trophy, Image as ImageIcon, Download, Upload,
  Sparkles, RefreshCw, Palette, Layers, CheckCircle2, ChevronDown, Save, X, Plus, Trash2, Move, GripVertical, Copy, Minus,
  RotateCw, AlignLeft, AlignCenter, AlignRight, Eye
} from 'lucide-react';
import { User, Category, Unit, Participant, Competition, Result, Team, UserRole } from '../types';
import { UNIVERSAL_FONT_OPTIONS, parseFontForCanvas } from '../utils/fontHelper';

const FONT_OPTIONS = UNIVERSAL_FONT_OPTIONS;

interface PosterSettingsViewProps {
  user: User;
  token: string;
  eventSettings?: any;
  onSettingsUpdated?: () => void;
}

/**
 * Team font colors for Posters Section:
 * - If useTeamColors is false: returns the theme's configured unitColor.
 * - If useTeamColors is true: returns custom unitColor from config or falls back to theme color.
 */
export const getPosterTeamColor = (unitOrTeamName?: string, defaultColor: string = '#34d399', config?: any): string => {
  if (!unitOrTeamName) return defaultColor;
  // If team colors are explicitly disabled, always use default/theme unitColor
  if (config && config.useTeamColors === false) {
    return defaultColor;
  }

  const raw = unitOrTeamName.toString().trim();
  const cleanStr = raw.replace(/[\u064B-\u065F\u0670\u0671]/g, '').replace(/ٱ/g, 'ا');
  const normalized = cleanStr.toLowerCase().replace(/[\s\-_]/g, '');

  // Check custom per-unit colors saved in config
  if (config?.unitColors) {
    if (config.unitColors[raw]) return config.unitColors[raw];
    if (config.unitColors[cleanStr]) return config.unitColors[cleanStr];
    for (const [k, v] of Object.entries(config.unitColors)) {
      const kNorm = k.replace(/[\u064B-\u065F\u0670\u0671]/g, '').replace(/ٱ/g, 'ا').toLowerCase().replace(/[\s\-_]/g, '');
      if (kNorm === normalized) return v as string;
    }
  }

  // Built-in palettes if useTeamColors is active
  if (config?.useTeamColors === true) {
    if (normalized.includes('mirath') || normalized.includes('mirat') || normalized.includes('nexamirath') || normalized.includes('nexamirat') || normalized === 'mir') return '#0284c7';
    if (normalized.includes('faylas') || normalized.includes('nexafaylas') || normalized === 'fay') return '#d97706';
    if (normalized.includes('sirafi') || normalized.includes('seafarer') || normalized.includes('سيرافي')) return '#0284c7';
    if (normalized.includes('tabrizi') || normalized.includes('taraz') || normalized.includes('تبريزي')) return '#d97706';
    if (normalized.includes('zanzibari') || normalized.includes('souq') || normalized.includes('زنجباري')) return '#16a34a';

    // Legacy support
    if (normalized.includes('shukr') || normalized.includes('شكر')) return '#2b2bc3';
    if (normalized.includes('sabr') || normalized.includes('صبر')) return '#1b5e20';
  }

  return defaultColor;
};

/**
 * Returns the display name for a unit/team on posters.
 * If unitLanguage is 'ar', maps English team name to Arabic using user-customized spellings.
 */
export const getPosterDisplayUnitName = (
  unitOrTeamName?: string,
  config?: any
): string => {
  if (!unitOrTeamName) return '';
  const raw = unitOrTeamName.toString().trim();
  if (config?.unitLanguage !== 'ar') {
    return config?.unitUppercase !== false ? raw.toUpperCase() : raw;
  }

  const customMap = config?.unitArabicNames || {};
  const cleanRaw = raw.replace(/[\u064B-\u065F\u0670\u0671]/g, '').replace(/ٱ/g, 'ا');
  const normalized = cleanRaw.toLowerCase().replace(/[\s\-_]/g, '');

  // Direct match in custom dictionary
  if (customMap[raw]) return customMap[raw];
  if (customMap[cleanRaw]) return customMap[cleanRaw];

  // Match Querencia teams
  if (normalized.includes('mirath') || normalized.includes('mirat') || normalized.includes('nexamirath') || normalized.includes('nexamirat') || normalized === 'mir') {
    return customMap['Nexa Mirath'] || customMap['Nexa Mirat'] || customMap['mirath'] || customMap['mirat'] || 'NEXA MIRATH';
  }
  if (normalized.includes('faylas') || normalized.includes('nexafaylas') || normalized === 'fay') {
    return customMap['Nexa Faylas'] || customMap['faylas'] || 'NEXA FAYLAS';
  }

  // Match Rendezvous Silver Edition teams
  if (normalized.includes('sirafi') || normalized.includes('seafarer') || normalized === 'sir') {
    return customMap['Sirafi Seafarers'] || customMap['sirafi'] || 'TEAM السِّيرَافِي';
  }
  if (normalized.includes('tabrizi') || normalized.includes('taraz') || normalized === 'tab') {
    return customMap['Tabrizi Taraz'] || customMap['tabrizi'] || 'TEAM التَّبْرِيزِي';
  }
  if (normalized.includes('zanzibari') || normalized.includes('souq') || normalized === 'zan') {
    return customMap['Zanzibari Souqs'] || customMap['zanzibari'] || 'TEAM الزَّنْجَبَارِي';
  }

  // Legacy Ash-Shukr / As-Sabr
  if (normalized.includes('shukr') || normalized.includes('شكر') || normalized === 'shk') {
    return customMap['Ash-Shukr'] || customMap['ash-shukr'] || 'TEAM الشُّكْر';
  }
  if (normalized.includes('sabr') || normalized.includes('صبر') || normalized === 'sbr') {
    return customMap['As-Sabr'] || customMap['as-sabr'] || 'TEAM الصَّبْر';
  }

  // Fuzzy lookup in keys
  for (const [k, v] of Object.entries(customMap)) {
    const kClean = k.replace(/[\u064B-\u065F\u0670\u0671]/g, '').replace(/ٱ/g, 'ا');
    if (kClean.toLowerCase().replace(/[\s\-_]/g, '') === normalized) {
      return v as string;
    }
  }

  return raw;
};

// Default config for a single theme
export const DEFAULT_POSTER_THEMES = [
  '/themes/theme_green_waves.jpg',
  '/themes/theme_green_cards.jpg',
  '/themes/theme_red_star.jpg',
  '/themes/theme_yellow_curve.jpg'
];

const OLD_THEME_PATTERNS = [
  'theme_brown', 'theme_blue', 'theme_yellow.jpg', 'theme_purple',
  'theme_green.jpg', 'theme_phytolore', 'theme_white_brown', 'theme_yellow_scroll'
];

export function isOldDefaultTheme(url: string): boolean {
  if (!url || typeof url !== 'string') return true;
  return OLD_THEME_PATTERNS.some(pat => url.includes(pat));
}

export function getDefaultThemeConfig(themeIdx: number = 0): any {
  // Theme 1 (Index 0) - Green Waves
  if (themeIdx === 0) {
    return {
      titleColor: '#ffffff',
      winnerColor: '#ffffff',
      unitColor: '#ffffff',
      titleSize: 36,
      resultLabelText: 'RESULT',
      resultLabelX: 183,
      resultLabelY: 284,
      resultLabelSize: 22,
      resultLabelColor: '#84C75D',
      resultLabelFont: '700 "Sora", sans-serif',
      resultLabelVertical: true,
      resultLabelLineGap: 20,
      showResultLabel: true,
      resultNumX: 135,
      resultNumY: 375,
      resultNumSize: 145,
      resultNumColor: '#84C75D',
      resultNumFont: '700 "Sora", sans-serif',
      resultNumStyle: 'fill',
      resultNumStrokeWidth: 3.5,
      categorySize: 28,
      categoryColor: '#ffffff',
      categoryX: 296,
      categoryY: 340,
      categoryFont: '600 "Sora", sans-serif',
      compNameX: 296,
      compNameY: 382,
      compNameSize: 42,
      compNameColor: '#FFAD03',
      compNameFont: '700 "Sora", sans-serif',
      compNameAlign: 'left',
      scriptText: 'mid zone',
      scriptX: 296,
      scriptY: 308,
      scriptSize: 48,
      scriptColor: '#ffffff',
      scriptFont: '"SignPainter", cursive',
      showScriptText: true,
      campusNameX: 540,
      campusNameY: 70,
      campusNameSize: 28,
      campusNameColor: '#ffffff',
      campusNameFont: '600 "Sora", sans-serif',
      showCampusName: false,
      festNameX: 540,
      festNameY: 120,
      festNameSize: 36,
      festNameColor: '#fbbf24',
      festNameFont: '700 "Sora", sans-serif',
      showFestName: false,
      winnerSize: 28,
      unitSize: 18,
      rankSize: 40,
      titleX: 540,
      titleY: 110,
      rank1BadgeX: 180,
      rank1BadgeY: 465,
      rank1NameX: 252,
      rank1NameY: 452,
      rank1UnitX: 252,
      rank1UnitY: 476,
      rank2BadgeX: 180,
      rank2BadgeY: 535,
      rank2NameX: 252,
      rank2NameY: 522,
      rank2UnitX: 252,
      rank2UnitY: 546,
      rank3BadgeX: 180,
      rank3BadgeY: 605,
      rank3NameX: 252,
      rank3NameY: 592,
      rank3UnitX: 252,
      rank3UnitY: 616,
      titleFont: '600 "Sora", sans-serif',
      winnerFont: '600 "Sora", sans-serif',
      unitFont: '400 "Sora", sans-serif',
      rankFont: '600 "Sora", sans-serif',
      fontFamily: '500 "Sora", sans-serif',
      uppercaseNames: false,
      rankBadgeShape: 'none' as 'pill' | 'circle' | 'rectangle' | 'none',
      rankBadgeShapeSize: 20,
      rank1Color: '#ffffff',
      rank2Color: '#ffffff',
      rank3Color: '#ffffff',
      rankTextColor: '#ffffff',
      rank1Text: '01.',
      rank2Text: '02.',
      rank3Text: '03.',
      showDividers: true,
      dividerColor: 'rgba(255, 255, 255, 0.35)',
      dividerStartX: 252,
      dividerEndX: 530,
      showFooter: false,
      showFooterBg: false,
      footerLine1: '',
      footerLine2: '',
      campusNameUppercase: true,
      festNameUppercase: true,
      resultLabelUppercase: true,
      resultNumUppercase: false,
      categoryUppercase: false,
      compNameUppercase: false,
      winnerUppercase: false,
      unitUppercase: false,
      useTeamColors: false,
      unitColors: {} as Record<string, string>,
      unitLanguage: 'en',
      unitArabicNames: {
        'Nexa Mirath': 'NEXA MIRATH',
        'Nexa Faylas': 'NEXA FAYLAS',
        'Sirafi Seafarers': 'TEAM السِّيرَافِي',
        'Tabrizi Taraz': 'TEAM التَّبْرِيزِي',
        'Zanzibari Souqs': 'TEAM الزَّنْجَبَARِي'
      } as Record<string, string>,
    };
  }

  // Theme 2 (Index 1) - Green 3D Block with 3 Horizontal Cards
  if (themeIdx === 1) {
    return {
      titleColor: '#ffffff',
      winnerColor: '#ffffff',
      unitColor: '#ffffff',
      titleSize: 36,
      resultLabelText: '#Result',
      resultLabelX: 470,
      resultLabelY: 275,
      resultLabelSize: 32,
      resultLabelColor: '#ffffff',
      resultLabelFont: '"SignPainter", cursive',
      resultLabelVertical: false,
      resultNumX: 555,
      resultNumY: 275,
      resultNumSize: 28,
      resultNumColor: '#ffffff',
      resultNumFont: '700 "Sora", sans-serif',
      resultNumStyle: 'fill',
      categorySize: 0,
      categoryColor: '#ffffff',
      categoryX: -9999,
      categoryY: -9999,
      categoryFont: '600 "Sora", sans-serif',
      compNameX: 540,
      compNameY: 318,
      compNameSize: 36,
      compNameColor: '#FFAD03',
      compNameFont: '700 "Sora", sans-serif',
      compNameAlign: 'center',
      scriptText: '',
      scriptX: -9999,
      scriptY: -9999,
      scriptSize: 0,
      scriptColor: '#ffffff',
      scriptFont: '"SignPainter", cursive',
      showScriptText: false,
      campusNameX: 540,
      campusNameY: 70,
      campusNameSize: 28,
      campusNameColor: '#ffffff',
      campusNameFont: '600 "Sora", sans-serif',
      showCampusName: false,
      festNameX: 540,
      festNameY: 120,
      festNameSize: 36,
      festNameColor: '#fbbf24',
      festNameFont: '700 "Sora", sans-serif',
      showFestName: false,
      winnerSize: 34,
      unitSize: 20,
      rankSize: 24,
      titleX: 540,
      titleY: 110,
      rank1BadgeX: 250,
      rank1BadgeY: 360,
      rank1NameX: 250,
      rank1NameY: 430,
      rank1UnitX: 250,
      rank1UnitY: 495,
      rank2BadgeX: 540,
      rank2BadgeY: 360,
      rank2NameX: 540,
      rank2NameY: 430,
      rank2UnitX: 540,
      rank2UnitY: 495,
      rank3BadgeX: 830,
      rank3BadgeY: 360,
      rank3NameX: 830,
      rank3NameY: 430,
      rank3UnitX: 830,
      rank3UnitY: 495,
      titleFont: '600 "Sora", sans-serif',
      winnerFont: '700 "Sora", sans-serif',
      unitFont: '400 "Sora", sans-serif',
      rankFont: '600 "Sora", sans-serif',
      fontFamily: '500 "Sora", sans-serif',
      uppercaseNames: false,
      rankBadgeShape: 'circle' as 'pill' | 'circle' | 'rectangle' | 'none',
      rankBadgeShapeSize: 24,
      rank1Color: 'rgba(255, 255, 255, 0.2)',
      rank2Color: 'rgba(255, 255, 255, 0.2)',
      rank3Color: 'rgba(255, 255, 255, 0.2)',
      rankTextColor: '#ffffff',
      rank1Text: '01',
      rank2Text: '02',
      rank3Text: '03',
      winnerAlign: 'center',
      unitAlign: 'center',
      winnerWrap: true,
      showDividers: false,
      showFooter: false,
      showFooterBg: false,
      footerLine1: '',
      footerLine2: '',
      campusNameUppercase: true,
      festNameUppercase: true,
      resultLabelUppercase: false,
      resultNumUppercase: false,
      categoryUppercase: false,
      compNameUppercase: false,
      winnerUppercase: false,
      unitUppercase: false,
      useTeamColors: false,
      unitColors: {} as Record<string, string>,
      unitLanguage: 'en',
      contentRotation: 0,
      unitArabicNames: {
        'Nexa Mirath': 'NEXA MIRATH',
        'Nexa Faylas': 'NEXA FAYLAS',
        'Sirafi Seafarers': 'TEAM السِّيرَافِي',
        'Tabrizi Taraz': 'TEAM التَّبْرِيزِي',
        'Zanzibari Souqs': 'TEAM الزَّنْجَبَارِي'
      } as Record<string, string>,
    };
  }

  // Theme 3 (Index 2) - Red 3D Star
  if (themeIdx === 2) {
    const base = getDefaultThemeConfig(0);
    return {
      ...base,
      resultLabelColor: '#C4020B',
      resultNumColor: '#C4020B',
    };
  }

  // Theme 4 (Index 3) - Yellow/Orange Curve Dome
  if (themeIdx === 3) {
    return {
      titleColor: '#111827',
      winnerColor: '#111827',
      unitColor: '#111827',
      titleSize: 36,
      resultLabelText: 'RESULT',
      resultLabelX: 420,
      resultLabelY: 260,
      resultLabelSize: 16,
      resultLabelColor: '#B01B1B',
      resultLabelFont: '800 "Sora", sans-serif',
      resultLabelVertical: true,
      resultLabelLineGap: 18,
      resultNumX: 350,
      resultNumY: 365,
      resultNumSize: 130,
      resultNumColor: '#B01B1B',
      resultNumFont: '700 "Bebas Neue", "Sora", sans-serif',
      resultNumStyle: 'fill',
      categorySize: 26,
      categoryColor: '#B01B1B',
      categoryX: 525,
      categoryY: 325,
      categoryFont: '700 "Sora", sans-serif',
      compNameX: 510,
      compNameY: 375,
      compNameSize: 46,
      compNameColor: '#B01B1B',
      compNameFont: '800 "Sora", sans-serif',
      compNameAlign: 'left',
      scriptText: 'mid zone',
      scriptX: 525,
      scriptY: 285,
      scriptSize: 42,
      scriptColor: '#111827',
      scriptFont: '"SignPainter", cursive',
      showScriptText: true,
      scriptAlign: 'left',
      campusNameX: 540,
      campusNameY: 70,
      campusNameSize: 28,
      campusNameColor: '#111827',
      campusNameFont: '600 "Sora", sans-serif',
      showCampusName: false,
      festNameX: 540,
      festNameY: 120,
      festNameSize: 36,
      festNameColor: '#B01B1B',
      festNameFont: '700 "Sora", sans-serif',
      showFestName: false,
      winnerSize: 34,
      unitSize: 22,
      rankSize: 32,
      titleX: 540,
      titleY: 110,
      rank1BadgeX: 320,
      rank1BadgeY: 460,
      rank1NameX: 450,
      rank1NameY: 448,
      rank1UnitX: 450,
      rank1UnitY: 478,
      rank2BadgeX: 320,
      rank2BadgeY: 535,
      rank2NameX: 450,
      rank2NameY: 523,
      rank2UnitX: 450,
      rank2UnitY: 553,
      rank3BadgeX: 320,
      rank3BadgeY: 610,
      rank3NameX: 450,
      rank3NameY: 598,
      rank3UnitX: 450,
      rank3UnitY: 628,
      titleFont: '600 "Sora", sans-serif',
      winnerFont: '700 "Sora", sans-serif',
      unitFont: '400 "Sora", sans-serif',
      rankFont: '700 "Sora", sans-serif',
      fontFamily: '500 "Sora", sans-serif',
      uppercaseNames: false,
      rankBadgeShape: 'none' as 'pill' | 'circle' | 'rectangle' | 'none',
      rankBadgeShapeSize: 20,
      rank1Color: '#111827',
      rank2Color: '#111827',
      rank3Color: '#111827',
      rankTextColor: '#111827',
      rank1Text: '01.',
      rank2Text: '02.',
      rank3Text: '03.',
      winnerAlign: 'left',
      unitAlign: 'left',
      winnerWrap: false,
      showDividers: true,
      dividerStartX: 450,
      dividerLength: 350,
      dividerColor: 'rgba(0, 0, 0, 0.45)',
      dividerWidth: 1.5,
      dividerYOffset: 8,
      showFooter: false,
      showFooterBg: false,
      footerLine1: '',
      footerLine2: '',
      campusNameUppercase: true,
      festNameUppercase: true,
      resultLabelUppercase: true,
      resultNumUppercase: false,
      categoryUppercase: false,
      compNameUppercase: false,
      winnerUppercase: false,
      unitUppercase: false,
      useTeamColors: false,
      unitColors: {} as Record<string, string>,
      unitLanguage: 'en',
      contentRotation: -7.5,
      rotationOriginX: 540,
      rotationOriginY: 520,
      unitArabicNames: {
        'Nexa Mirath': 'NEXA MIRATH',
        'Nexa Faylas': 'NEXA FAYLAS',
        'Sirafi Seafarers': 'TEAM السِّيرَافِي',
        'Tabrizi Taraz': 'TEAM التَّبْرِيزِي',
        'Zanzibari Souqs': 'TEAM الزَّنْجَبَارِي'
      } as Record<string, string>,
    };
  }

  return getDefaultThemeConfig(themeIdx % 4);
}

// Migrate old flat config to per-theme (same logic as PosterSettingsView)
function migrateOldConfig(templateConfig: any, defaultThemes?: string[]): any {
  const dThemes = defaultThemes || DEFAULT_POSTER_THEMES;
  let customThemes = Array.isArray(templateConfig.customThemes) && templateConfig.customThemes.length > 0
    ? templateConfig.customThemes
    : dThemes;

  if (customThemes.some(isOldDefaultTheme) || customThemes.length < dThemes.length || customThemes.length > 4) {
    customThemes = dThemes.map((dt, idx) => {
      const existing = customThemes[idx];
      return existing && !isOldDefaultTheme(existing) ? existing : dt;
    });
  }

  if (templateConfig.themeConfigs) {
    return {
      ...templateConfig,
      customThemes
    };
  }

  const oldConf = { ...templateConfig };
  const themeRules = oldConf.themeRules || [];
  delete oldConf.customThemes;
  delete oldConf.themeRules;

  const themeConfigs: any = {};
  customThemes.forEach((_: any, idx: number) => {
    themeConfigs[idx] = { ...getDefaultThemeConfig(idx), ...oldConf };
  });

  return { customThemes, themeRules, themeConfigs };
}

const defaultThemes = DEFAULT_POSTER_THEMES;

interface RangeControlProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
}

const RangeControl = React.memo(({ label, value, onChange, min, max, step = 1 }: RangeControlProps) => {
  const currentVal = value ?? 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
        <span>{label}</span>
        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, currentVal - 5))}
            className="w-4 h-4 flex items-center justify-center bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-extrabold rounded active:scale-95 transition-colors"
            title="Step left (-5)"
          >
            -
          </button>
          <input
            type="number"
            value={currentVal}
            onChange={(e) => {
              const val = e.target.value === '' ? 0 : Number(e.target.value);
              onChange(isNaN(val) ? 0 : val);
            }}
            className="w-14 px-1 py-0.5 text-center font-bold text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded"
          />
          <button
            type="button"
            onClick={() => onChange(Math.min(max, currentVal + 5))}
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
        step={step}
        value={currentVal}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
      />
    </div>
  );
});

export const PosterSettingsView: React.FC<PosterSettingsViewProps> = ({
  user,
  token,
  eventSettings,
  onSettingsUpdated
}) => {
  // Helper to ensure valid themes & configs
  const normalizeThemesAndConfigs = (themesIn: any, configsIn: any) => {
    const existing = Array.isArray(themesIn) ? themesIn : [];
    let themes = existing.length > 0 ? existing : defaultThemes;
    if (themes.some(isOldDefaultTheme) || themes.length < defaultThemes.length || themes.length > 4) {
      themes = defaultThemes.map((dt, idx) => {
        const ext = themes[idx];
        return ext && !isOldDefaultTheme(ext) ? ext : dt;
      });
    }
    const configs = { ...(configsIn || {}) };
    themes.forEach((_, i) => {
      if (!configs[i]) configs[i] = getDefaultThemeConfig(i);
    });
    return { themes, configs };
  };

  // Migrate from old config if needed
  const rawTemplateConfig = eventSettings?.posterTemplateConfig || {};
  const migratedConfig = migrateOldConfig({
    ...rawTemplateConfig,
    customThemes: rawTemplateConfig.customThemes || defaultThemes
  });

  const { themes: initialThemes, configs: initialConfigs } = normalizeThemesAndConfigs(migratedConfig.customThemes, migratedConfig.themeConfigs);

  const [customThemes, setCustomThemes] = useState<string[]>(initialThemes);
  const [themeRules, setThemeRules] = useState<any[]>(migratedConfig.themeRules || []);
  const [themeConfigs, setThemeConfigs] = useState<any>(initialConfigs);
  const [selectedThemeIndex, setSelectedThemeIndex] = useState<number>(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [sampleResultNum, setSampleResultNum] = useState<string>('01');

  const isInitialSyncRef = useRef(true);

  // Sync state when eventSettings arrives initially if not yet fetched
  useEffect(() => {
    if (isInitialSyncRef.current && eventSettings?.posterTemplateConfig) {
      const cfg = eventSettings.posterTemplateConfig;
      const { themes, configs } = normalizeThemesAndConfigs(cfg.customThemes, cfg.themeConfigs);
      setCustomThemes(themes);
      setThemeConfigs(configs);
      if (Array.isArray(cfg.themeRules)) {
        setThemeRules(cfg.themeRules);
      }
    }
  }, [eventSettings?.posterTemplateConfig]);

  useEffect(() => {
    fetch('/api/settings?t=' + Date.now(), { cache: 'no-store' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.posterTemplateConfig) {
          const cfg = data.posterTemplateConfig;
          const { themes, configs } = normalizeThemesAndConfigs(cfg.customThemes, cfg.themeConfigs);
          setCustomThemes(themes);
          setThemeConfigs(configs);
          if (Array.isArray(cfg.themeRules)) {
            setThemeRules(cfg.themeRules);
          }
          isInitialSyncRef.current = false;
        }
      })
      .catch(err => console.error('Failed to load settings in PosterSettingsView:', err));

    fetch('/api/categories')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch(err => console.error('Failed to load categories in PosterSettingsView:', err));

    fetch('/api/units')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setUnits(data);
        }
      })
      .catch(err => console.error('Failed to load units in PosterSettingsView:', err));
  }, []);

  const activeUnits: Unit[] = units.length > 0 ? units : [
    { id: 'unit_nexa_mirath', name: 'Nexa Mirath', code: 'MIR', active: true },
    { id: 'unit_nexa_faylas', name: 'Nexa Faylas', code: 'FAY', active: true }
  ];

  // Get current theme's config (with defaults)
  const getThemeConfig = (idx: number) => {
    const defaultConf = getDefaultThemeConfig(idx);
    const userConf = themeConfigs[idx] || {};
    return { ...defaultConf, ...userConf };
  };

  const conf = getThemeConfig(selectedThemeIndex);
  const confRef = useRef<any>(conf);
  confRef.current = conf;

  // Update a single property for the current theme
  const updateConf = (key: string, value: any) => {
    setThemeConfigs((prev: any) => ({
      ...prev,
      [selectedThemeIndex]: {
        ...(prev[selectedThemeIndex] || {}),
        [key]: value
      }
    }));
  };

  const updateConfMultiple = (updates: Record<string, any>) => {
    setThemeConfigs((prev: any) => ({
      ...prev,
      [selectedThemeIndex]: {
        ...(prev[selectedThemeIndex] || {}),
        ...updates
      }
    }));
  };

  // Copy / Duplicate theme layout settings
  const [sourceThemeToCopy, setSourceThemeToCopy] = useState<number>(0);

  useEffect(() => {
    if (sourceThemeToCopy === selectedThemeIndex) {
      const otherIdx = customThemes.findIndex((_, i) => i !== selectedThemeIndex);
      if (otherIdx !== -1) setSourceThemeToCopy(otherIdx);
    }
  }, [selectedThemeIndex, customThemes]);

  const handleCopyThemeSettings = (sourceIdx: number, targetIdx: number) => {
    if (sourceIdx === targetIdx) return;
    const sourceConf = getThemeConfig(sourceIdx);
    setThemeConfigs((prev: any) => ({
      ...prev,
      [targetIdx]: {
        ...JSON.parse(JSON.stringify(sourceConf))
      }
    }));
    alert(`✓ Successfully copied all layout positions, fonts & colors from Theme ${sourceIdx + 1} into Theme ${targetIdx + 1}!\nYou can now edit any specific colors or text.`);
  };

  const handleDuplicateTheme = (sourceIdx: number) => {
    if (customThemes.length >= 10) {
      alert('Maximum of 10 themes reached.');
      return;
    }
    const sourceThemeImg = customThemes[sourceIdx];
    const sourceConf = getThemeConfig(sourceIdx);
    const newIdx = customThemes.length;

    setCustomThemes(prev => [...prev, sourceThemeImg]);
    setThemeConfigs((prev: any) => ({
      ...prev,
      [newIdx]: {
        ...JSON.parse(JSON.stringify(sourceConf))
      }
    }));
    setSelectedThemeIndex(newIdx);
    alert(`✓ Duplicated Theme ${sourceIdx + 1} as Theme ${newIdx + 1} with all its layout settings!`);
  };

  const [replacingThemeIdx, setReplacingThemeIdx] = useState<number | null>(null);

  const handleReplaceThemeImage = async (themeIdx: number, file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      alert('Image size exceeds 15MB. Please upload a smaller image.');
      return;
    }
    setReplacingThemeIdx(themeIdx);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'image');
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (uploadRes.ok) {
        const data = await uploadRes.json();
        const imageUrl = data.url || data.secure_url;
        if (imageUrl) {
          setCustomThemes(prev => {
            const updated = [...prev];
            updated[themeIdx] = imageUrl;
            return updated;
          });
          alert(`✓ Replaced background image for Theme ${themeIdx + 1}! All coordinates and fonts are preserved.`);
          return;
        }
      }
      // Base64 fallback
      const reader = new FileReader();
      reader.onload = (re) => {
        const b64 = re.target?.result as string;
        if (b64) {
          setCustomThemes(prev => {
            const updated = [...prev];
            updated[themeIdx] = b64;
            return updated;
          });
          alert(`✓ Replaced background image for Theme ${themeIdx + 1}! All coordinates and fonts are preserved.`);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      const reader = new FileReader();
      reader.onload = (re) => {
        const b64 = re.target?.result as string;
        if (b64) {
          setCustomThemes(prev => {
            const updated = [...prev];
            updated[themeIdx] = b64;
            return updated;
          });
          alert(`✓ Replaced background image for Theme ${themeIdx + 1}! All coordinates and fonts are preserved.`);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setReplacingThemeIdx(null);
    }
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
    | 'title' | 'scriptText' | 'resultLabel' | 'resultNum' | 'category' | 'compName'
    | 'rank1Badge' | 'rank1Name' | 'rank1Unit'
    | 'rank2Badge' | 'rank2Name' | 'rank2Unit'
    | 'rank3Badge' | 'rank3Name' | 'rank3Unit'
    | 'campusName' | 'festName'
    | string
    | null;
  const [dragging, setDragging] = useState<DragTarget>(null);
  const lastMousePos = useRef<{ x: number, y: number } | null>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Drag position maps
  const dragPosMap: Record<string, { xKey: string, yKey: string }> = {
    title: { xKey: 'titleX', yKey: 'titleY' },
    scriptText: { xKey: 'scriptX', yKey: 'scriptY' },
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

  // Helper to reverse canvas rotation for accurate pointer hit-testing and dragging
  const getRotatedCoords = (canvasX: number, canvasY: number, cfg: any) => {
    const rotDeg = Number(cfg.contentRotation ?? cfg.rotationAngle ?? 0);
    if (isNaN(rotDeg) || rotDeg === 0) return { x: canvasX, y: canvasY };
    const originX = cfg.rotationOriginX ?? 540;
    const originY = cfg.rotationOriginY ?? 520;
    const rad = (-rotDeg * Math.PI) / 180;
    const cdx = canvasX - originX;
    const cdy = canvasY - originY;
    return {
      x: originX + cdx * Math.cos(rad) - cdy * Math.sin(rad),
      y: originY + cdx * Math.sin(rad) + cdy * Math.cos(rad)
    };
  };

  const handleDragStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const { canvasX, canvasY, clientX, clientY } = coords;

    if (e.cancelable) {
      try { e.preventDefault(); } catch (_) { }
    }

    const { x: hitX, y: hitY } = getRotatedCoords(canvasX, canvasY, confRef.current);

    // Find the most specific (smallest) hit region
    let bestHit: string | null = null;
    let bestArea = Infinity;
    for (const region of hitRegions.current) {
      if (hitX >= region.x && hitX <= region.x + region.w &&
        hitY >= region.y && hitY <= region.y + region.h) {
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
        try { e.preventDefault(); } catch (_) { }
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
        // Adjust drag deltas for content rotation so elements move along visual mouse direction
        const rotDeg = Number(confRef.current.contentRotation ?? confRef.current.rotationAngle ?? 0);
        let effDx = dx;
        let effDy = dy;
        if (!isNaN(rotDeg) && rotDeg !== 0) {
          const rad = (-rotDeg * Math.PI) / 180;
          effDx = dx * Math.cos(rad) - dy * Math.sin(rad);
          effDy = dx * Math.sin(rad) + dy * Math.cos(rad);
        }

        if (typeof dragging === 'string' && dragging.startsWith('customDivider_')) {
          const divIdx = parseInt(dragging.replace('customDivider_', ''), 10);
          const currentDividers = [...(confRef.current.customDividers || [])];
          if (currentDividers[divIdx]) {
            currentDividers[divIdx] = {
              ...currentDividers[divIdx],
              x: Math.round((currentDividers[divIdx].x ?? 260) + effDx),
              y: Math.round((currentDividers[divIdx].y ?? 420) + effDy)
            };
            updateConf('customDividers', currentDividers);
          }
          lastMousePos.current = { x: clientX, y: clientY };
          return;
        }

        const posMap = dragPosMap[dragging as string];
        if (posMap) {
          const currentConf = confRef.current;
          updateConfMultiple({
            [posMap.xKey]: Math.round((currentConf[posMap.xKey] ?? 0) + effDx),
            [posMap.yKey]: Math.round((currentConf[posMap.yKey] ?? 0) + effDy)
          });
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
    const { x: hitX, y: hitY } = getRotatedCoords(canvasX, canvasY, confRef.current);

    let hovered: string | null = null;
    for (const region of hitRegions.current) {
      if (hitX >= region.x && hitX <= region.x + region.w &&
        hitY >= region.y && hitY <= region.y + region.h) {
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
      ctx.font = parseFontForCanvas(c.campusNameFont || c.fontFamily, c.campusNameSize ?? 28, '900');
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
      ctx.font = parseFontForCanvas(c.festNameFont || c.fontFamily, c.festNameSize ?? 36, '900');
      ctx.fillStyle = c.festNameColor || c.titleColor || '#fbbf24';
      const festText = c.festNameUppercase !== false ? festivalName.toUpperCase() : festivalName;
      const festMetrics = ctx.measureText(festText);
      const fx = c.festNameX ?? c.titleX ?? 540;
      const fy = c.festNameY ?? (c.titleY ? c.titleY + 20 : 120);
      ctx.fillText(festText, fx, fy);
      addRegion('festName', fx - 10, fy - (c.festNameSize ?? 36) - 5, festMetrics.width + 20, (c.festNameSize ?? 36) + 20);
    }

    // Apply Content Rotation / Tilt Angle (e.g. -7.5 deg for Theme 4 Slope)
    const rotDeg = Number(c.contentRotation ?? c.rotationAngle ?? 0);
    const hasRot = !isNaN(rotDeg) && rotDeg !== 0;
    if (hasRot) {
      ctx.save();
      const originX = c.rotationOriginX ?? 540;
      const originY = c.rotationOriginY ?? 520;
      ctx.translate(originX, originY);
      ctx.rotate((rotDeg * Math.PI) / 180);
      ctx.translate(-originX, -originY);
    }

    // Result Label (Word: e.g. "RESULT")
    if (c.showResultLabel !== false) {
      const rx = (c.resultLabelX !== undefined && !isNaN(c.resultLabelX))
        ? c.resultLabelX
        : (c.resultNumX !== undefined ? c.resultNumX + 48 : 183);
      const ry = (c.resultLabelY !== undefined && !isNaN(c.resultLabelY))
        ? c.resultLabelY
        : (c.resultNumY !== undefined ? Math.max(c.resultNumY - 90, 80) : 284);
      const rawLbl = c.resultLabelText || 'RESULT';
      const rLblText = c.resultLabelUppercase !== false ? rawLbl.toUpperCase() : rawLbl;
      const lblSize = c.resultLabelSize || 24;

      ctx.save();
      ctx.textAlign = 'left';
      ctx.font = parseFontForCanvas(c.resultLabelFont || c.fontFamily, lblSize, '800');
      const lblColor = (!c.resultLabelColor || c.resultLabelColor === '#000000' || c.resultLabelColor === 'black')
        ? (c.resultNumColor || '#84C75D')
        : c.resultLabelColor;
      ctx.fillStyle = lblColor;

      const rLblMetrics = ctx.measureText(rLblText);
      if (c.resultLabelVertical) {
        const chars = rLblText.split('');
        const gap = c.resultLabelLineGap || Math.max(lblSize * 1.25, 18);
        chars.forEach((ch: string, i: number) => {
          ctx.fillText(ch, rx, ry + i * gap);
        });
        const verticalHeight = (chars.length - 1) * gap + lblSize;
        addRegion('resultLabel', rx - 10, ry - lblSize - 5, lblSize + 20, verticalHeight + 20);
      } else {
        ctx.fillText(rLblText, rx, ry);
        addRegion('resultLabel', rx - 10, ry - lblSize - 5, rLblMetrics.width + 20, lblSize + 20);
      }
      ctx.restore();
    }

    // Result Number (Number: e.g. "01", "100", "101" - Normal Solid Font by default)
    ctx.textAlign = 'left';
    ctx.font = parseFontForCanvas(c.resultNumFont || c.fontFamily, c.resultNumSize || 145, '700');
    const rNumX = (c.resultNumX !== undefined && !isNaN(c.resultNumX)) ? c.resultNumX : 135;
    const rNumY = (c.resultNumY !== undefined && !isNaN(c.resultNumY)) ? c.resultNumY : 375;
    const rNumColor = (!c.resultNumColor || c.resultNumColor === '#000000') ? '#84C75D' : c.resultNumColor;
    const rNumText = sampleResultNum || '01';
    const rNumMetrics = ctx.measureText(rNumText);

    const rNumRot = Number(c.resultNumRotation || 0);
    const hasNumRot = !isNaN(rNumRot) && rNumRot !== 0;
    if (hasNumRot) {
      ctx.save();
      ctx.translate(rNumX, rNumY);
      ctx.rotate((rNumRot * Math.PI) / 180);
      ctx.translate(-rNumX, -rNumY);
    }

    if (c.resultNumStyle === 'stroke') {
      ctx.save();
      ctx.strokeStyle = rNumColor;
      ctx.lineWidth = c.resultNumStrokeWidth || 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeText(rNumText, rNumX, rNumY);
      ctx.restore();
    } else {
      // Normal solid font (Clean, filled font glyphs without 2-line stroke)
      ctx.fillStyle = rNumColor;
      ctx.fillText(rNumText, rNumX, rNumY);
    }

    if (hasNumRot) {
      ctx.restore();
    }
    addRegion('resultNum', rNumX - 10, rNumY - (c.resultNumSize || 145) - 5, rNumMetrics.width + 20, (c.resultNumSize || 145) + 20);

    // Cursive Script Text (SignPainter) e.g. "mid zone"
    if (c.showScriptText !== false && (c.scriptSize ?? 0) > 0) {
      const sText = c.scriptTextOverride !== undefined && c.scriptTextOverride !== ''
        ? c.scriptTextOverride
        : (c.scriptText || 'mid zone');
      if (sText) {
        ctx.save();
        ctx.textAlign = (c.scriptAlign || 'left') as CanvasTextAlign;
        ctx.font = parseFontForCanvas(c.scriptFont || '"SignPainter", cursive', c.scriptSize ?? 48, '400');
        ctx.fillStyle = c.scriptColor || '#ffffff';
        const sx = c.scriptX ?? 296;
        const sy = c.scriptY ?? 308;
        ctx.fillText(sText, sx, sy);
        const sMetrics = ctx.measureText(sText);
        const sW = sMetrics.width;
        const scriptHitX = c.scriptAlign === 'center' ? sx - sW / 2 : sx;
        addRegion('scriptText', scriptHitX - 10, sy - (c.scriptSize ?? 48) - 5, sW + 20, (c.scriptSize ?? 48) + 20);
        ctx.restore();
      }
    }

    // Category
    ctx.textAlign = 'left';
    ctx.font = parseFontForCanvas(c.categoryFont || c.fontFamily, c.categorySize ?? 26, '400');
    ctx.fillStyle = c.categoryColor || 'rgba(255, 255, 255, 0.7)';
    const rawCat = selectedThemeIndex === 3 ? 'Junior' : 'Category';
    const catText = c.categoryUppercase ? rawCat.toUpperCase() : rawCat;
    const catMetrics = ctx.measureText(catText);
    ctx.fillText(catText, c.categoryX ?? 540, c.categoryY ?? 260);
    addRegion('category', (c.categoryX ?? 540) - 10, (c.categoryY ?? 260) - (c.categorySize ?? 26) - 5, catMetrics.width + 20, (c.categorySize ?? 26) + 20);

    // Competition Name with auto-fit and alignment
    ctx.textAlign = (c.compNameAlign || 'left') as CanvasTextAlign;
    let compNameSize = c.compNameSize ?? 52;
    const rawComp = selectedThemeIndex === 1 ? 'Senior Speech english' : (selectedThemeIndex === 3 ? 'Madh Song' : 'Competition Name');
    const compText = c.compNameUppercase ? rawComp.toUpperCase() : rawComp;
    const compLines = compText.split('\n').filter(Boolean);
    const compX = c.compNameX ?? 540;
    const compY = c.compNameY ?? 330;

    const compRot = Number(c.compNameRotation || 0);
    const hasCompRot = !isNaN(compRot) && compRot !== 0;
    if (hasCompRot) {
      ctx.save();
      ctx.translate(compX, compY);
      ctx.rotate((compRot * Math.PI) / 180);
      ctx.translate(-compX, -compY);
    }

    ctx.font = parseFontForCanvas(c.compNameFont || c.fontFamily, compNameSize, '700');
    ctx.fillStyle = c.compNameColor || '#ffffff';
    let maxCompW = 0;
    const compGap = compNameSize * 1.15;
    compLines.forEach((line: string, i: number) => {
      ctx.fillText(line, compX, compY + i * compGap);
      const w = ctx.measureText(line).width;
      if (w > maxCompW) maxCompW = w;
    });

    if (hasCompRot) {
      ctx.restore();
    }
    const compHitX = c.compNameAlign === 'center' ? compX - maxCompW / 2 : compX;
    addRegion('compName', compHitX - 10, compY - compNameSize - 5, maxCompW + 20, (compLines.length * compGap) + 10);

    // Sample data tailored for active theme
    const sampleNames = selectedThemeIndex === 1
      ? ['Sayyid Sinan', 'Sayyid Sinan', 'Sayyid Sinan']
      : selectedThemeIndex === 3
        ? ['FASIL FARHAN', 'MUHAMMED RAYYAN', 'MUHAMMED SINAN']
        : ['Participant Name 1', 'Participant Name 2', 'Participant Name 3'];
    const sampleUnits = selectedThemeIndex === 1 || selectedThemeIndex === 3
      ? ['sanaviyya', 'sanaviyya', 'sanaviyya']
      : ['Team Name', 'Team Name', 'Team Name'];

    // Draw each rank separately
    const rankData = [
      { rank: 1, badgeXKey: 'rank1BadgeX', badgeYKey: 'rank1BadgeY', nameXKey: 'rank1NameX', nameYKey: 'rank1NameY', unitXKey: 'rank1UnitX', unitYKey: 'rank1UnitY', color: c.rank1Color, text: c.rank1Text, badgeId: 'rank1Badge', nameId: 'rank1Name', unitId: 'rank1Unit', sampleName: sampleNames[0], sampleUnit: sampleUnits[0] },
      { rank: 2, badgeXKey: 'rank2BadgeX', badgeYKey: 'rank2BadgeY', nameXKey: 'rank2NameX', nameYKey: 'rank2NameY', unitXKey: 'rank2UnitX', unitYKey: 'rank2UnitY', color: c.rank2Color, text: c.rank2Text, badgeId: 'rank2Badge', nameId: 'rank2Name', unitId: 'rank2Unit', sampleName: sampleNames[1], sampleUnit: sampleUnits[1] },
      { rank: 3, badgeXKey: 'rank3BadgeX', badgeYKey: 'rank3BadgeY', nameXKey: 'rank3NameX', nameYKey: 'rank3NameY', unitXKey: 'rank3UnitX', unitYKey: 'rank3UnitY', color: c.rank3Color, text: c.rank3Text, badgeId: 'rank3Badge', nameId: 'rank3Name', unitId: 'rank3Unit', sampleName: sampleNames[2], sampleUnit: sampleUnits[2] },
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
      const rankFontSize = c.rankSize || 32;
      ctx.font = parseFontForCanvas(c.rankFont || c.fontFamily, rankFontSize, '500');
      const rankTextWidth = ctx.measureText(rankText).width;
      const badgeShapeSize = c.rankBadgeShapeSize ?? 40;
      const badgeCenterY = by - (rankFontSize * 0.32);

      let badgeW = rankTextWidth + 40;
      let badgeH = 50;

      if (c.rankBadgeShape !== 'none') {
        ctx.fillStyle = rd.color;
        ctx.beginPath();
        if (c.rankBadgeShape === 'pill') {
          badgeH = Math.max(badgeShapeSize * 1.25, rankFontSize * 1.25);
          const pillPadX = Math.max(badgeShapeSize * 0.5, 16);
          badgeW = rankTextWidth + pillPadX * 2;
          ctx.roundRect(bx - badgeW / 2, badgeCenterY - badgeH / 2, badgeW, badgeH, badgeH / 2);
        } else if (c.rankBadgeShape === 'circle') {
          const radius = badgeShapeSize;
          badgeW = radius * 2;
          badgeH = radius * 2;
          ctx.arc(bx, badgeCenterY, radius, 0, 2 * Math.PI);
        } else {
          badgeH = Math.max(badgeShapeSize * 1.25, rankFontSize * 1.25);
          const rectPadX = Math.max(badgeShapeSize * 0.5, 16);
          badgeW = rankTextWidth + rectPadX * 2;
          ctx.rect(bx - badgeW / 2, badgeCenterY - badgeH / 2, badgeW, badgeH);
        }
        ctx.fill();
      }

      const rankFill = c.rankTextColor || '#ffffff';
      ctx.fillStyle = rankFill;
      ctx.textAlign = 'center';
      const isRankFractul = (c.rankFont || c.fontFamily || '').includes('Fractul Alt');
      if (isRankFractul) {
        ctx.save();
        ctx.strokeStyle = rankFill;
        ctx.lineWidth = 0.9;
        ctx.lineJoin = 'round';
        ctx.strokeText(rankText, bx, by);
        ctx.fillText(rankText, bx, by);
        ctx.restore();
      } else {
        ctx.fillText(rankText, bx, by);
      }
      addRegion(rd.badgeId, bx - badgeW / 2 - 5, badgeCenterY - badgeH / 2 - 5, badgeW + 10, badgeH + 10);

      // Participant name with Auto-fit preview and 2-line wrap
      ctx.textAlign = (c.winnerAlign || 'left') as CanvasTextAlign;
      let winnerFontSize = c.winnerSize || 34;
      const maxWinnerAllowedWidth = c.winnerMaxWidth || Math.max(Math.min(W - (c.rank1NameX ?? 260) - 60, 520), 380);
      const rawNameText = rd.sampleName || 'Participant Name';
      const nameText = (c.winnerUppercase || c.uppercaseNames) ? rawNameText.toUpperCase() : rawNameText;
      let nameLines = nameText.split('\n').filter(Boolean);
      if (c.winnerWrap && nameLines.length === 1 && nameText.includes(' ')) {
        const words = nameText.split(' ');
        if (words.length >= 2) {
          const mid = Math.ceil(words.length / 2);
          nameLines = [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
        }
      }
      ctx.font = parseFontForCanvas(c.winnerFont || c.fontFamily, winnerFontSize, '500');
      let longestNameLine = nameLines.length > 0 ? Math.max(...nameLines.map((l: string) => ctx.measureText(l).width)) : 0;
      while (longestNameLine > maxWinnerAllowedWidth && winnerFontSize > 14) {
        winnerFontSize -= 1;
        ctx.font = parseFontForCanvas(c.winnerFont || c.fontFamily, winnerFontSize, '500');
        longestNameLine = Math.max(...nameLines.map((l: string) => ctx.measureText(l).width));
      }
      const winnerFill = c.winnerColor || '#ffffff';
      ctx.fillStyle = winnerFill;
      const nameGap = winnerFontSize * 1.15;
      let maxNameW = 0;
      const isWinnerFractul = (c.winnerFont || c.fontFamily || '').includes('Fractul Alt');
      nameLines.forEach((line: string, i: number) => {
        if (isWinnerFractul) {
          ctx.save();
          ctx.strokeStyle = winnerFill;
          ctx.lineWidth = 0.9;
          ctx.lineJoin = 'round';
          ctx.strokeText(line, nx, ny + i * nameGap);
          ctx.fillText(line, nx, ny + i * nameGap);
          ctx.restore();
        } else {
          ctx.fillText(line, nx, ny + i * nameGap);
        }
        const w = ctx.measureText(line).width;
        if (w > maxNameW) maxNameW = w;
      });
      const nameHitX = c.winnerAlign === 'center' ? nx - maxNameW / 2 : nx;
      addRegion(rd.nameId, nameHitX - 5, ny - winnerFontSize - 5, maxNameW + 10, (nameLines.length * nameGap) + 10);

      // Unit/Team name with multi-line and alignment
      const isArabic = c.unitLanguage === 'ar';
      const arabicFont = (c.unitFont && c.unitFont !== 'monospace') ? c.unitFont : "'Cairo', 'Amiri', sans-serif";
      ctx.textAlign = (c.unitAlign || c.winnerAlign || 'left') as CanvasTextAlign;
      let unitFontSize = c.unitSize || 22;
      ctx.font = parseFontForCanvas(isArabic ? arabicFont : (c.unitFont || 'monospace'), unitFontSize, '500');
      const sampleUnitName = rd.sampleUnit;
      const displayUnitName = getPosterDisplayUnitName(sampleUnitName, c);
      const unitText = isArabic ? displayUnitName : (c.unitUppercase ? displayUnitName.toUpperCase() : displayUnitName);
      const unitLines = unitText.split('\n').filter(Boolean);
      let longestUnitLine = unitLines.length > 0 ? Math.max(...unitLines.map((l: string) => ctx.measureText(l).width)) : 0;
      while (longestUnitLine > maxWinnerAllowedWidth && unitFontSize > 12) {
        unitFontSize -= 1;
        ctx.font = parseFontForCanvas(isArabic ? arabicFont : (c.unitFont || 'monospace'), unitFontSize, '500');
        longestUnitLine = Math.max(...unitLines.map((l: string) => ctx.measureText(l).width));
      }
      const unitFill = getPosterTeamColor(sampleUnitName, c.unitColor, c);
      ctx.fillStyle = unitFill;
      const unitGap = unitFontSize * 1.15;
      let maxUnitW = 0;
      const isUnitFractul = (c.unitFont || c.fontFamily || '').includes('Fractul Alt');
      unitLines.forEach((line: string, i: number) => {
        if (isUnitFractul) {
          ctx.save();
          ctx.strokeStyle = unitFill;
          ctx.lineWidth = 0.65;
          ctx.lineJoin = 'round';
          ctx.strokeText(line, ux, uy + i * unitGap);
          ctx.fillText(line, ux, uy + i * unitGap);
          ctx.restore();
        } else {
          ctx.fillText(line, ux, uy + i * unitGap);
        }
        const w = ctx.measureText(line).width;
        if (w > maxUnitW) maxUnitW = w;
      });
      const unitHitX = (c.unitAlign || c.winnerAlign) === 'center' ? ux - maxUnitW / 2 : ux;
      addRegion(rd.unitId, unitHitX - 5, uy - unitFontSize - 5, maxUnitW + 10, (unitLines.length * unitGap) + 10);

      // Divider line preview
      if (c.showDividers && rd.rank < 3) {
        ctx.save();
        ctx.strokeStyle = c.dividerColor || 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = c.dividerWidth || 1;
        const dLen = c.dividerLength ?? 280;
        const dYOffset = c.dividerYOffset ?? 8;
        const divStartX = c.dividerStartX ?? nx;
        const divY = uy + (c.unitSize || 18) + dYOffset;
        ctx.beginPath();
        ctx.moveTo(divStartX, divY);
        ctx.lineTo(divStartX + dLen, divY);
        ctx.stroke();
        ctx.restore();
      }
    });

    // Custom standalone divider lines (User-added & fully editable)
    if (c.customDividers && Array.isArray(c.customDividers)) {
      c.customDividers.forEach((div: any, i: number) => {
        const dx = div.x ?? 260;
        const dy = div.y ?? 420;
        const dLen = div.length ?? 300;
        const dThick = div.thickness ?? 2;
        const dCol = div.color || 'rgba(255, 255, 255, 0.4)';

        ctx.save();
        ctx.strokeStyle = dCol;
        ctx.lineWidth = dThick;
        ctx.beginPath();
        ctx.moveTo(dx, dy);
        ctx.lineTo(dx + dLen, dy);
        ctx.stroke();
        ctx.restore();

        addRegion(`customDivider_${i}`, dx - 5, dy - Math.max(dThick, 16) / 2, dLen + 10, Math.max(dThick, 16));
      });
    }

    // End Content Rotation before drawing footer
    if (hasRot) {
      ctx.restore();
    }


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
  }, [selectedThemeIndex, customThemes, themeConfigs, hoveredElement, dragging, imgLoaded, sampleResultNum]);

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
                      <label
                        title={`Replace Background Image for Theme ${idx + 1}`}
                        className="absolute bottom-2 right-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2 py-0.5 text-[9px] font-bold shadow-md cursor-pointer transition-all z-10 flex items-center gap-1 opacity-90 hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${replacingThemeIdx === idx ? 'animate-spin' : ''}`} />
                        <span>Replace</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleReplaceThemeImage(idx, file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        title={`Duplicate Theme ${idx + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateTheme(idx);
                        }}
                        className="absolute -top-2 right-6 bg-slate-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-slate-900 shadow-md cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title={`Delete Theme ${idx + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (customThemes.length <= 1) {
                            alert('At least one theme must be retained.');
                            return;
                          }
                          if (!confirm(`Are you sure you want to delete Theme ${idx + 1}?`)) return;
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
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600 shadow-md cursor-pointer"
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
                            const previousConf = getThemeConfig(selectedThemeIndex);
                            setCustomThemes(prev => {
                              const newThemes = [...prev, result];
                              const newIdx = newThemes.length - 1;
                              setSelectedThemeIndex(newIdx);
                              setThemeConfigs((configs: any) => ({
                                ...configs,
                                [newIdx]: {
                                  ...JSON.parse(JSON.stringify(previousConf))
                                }
                              }));
                              return newThemes;
                            });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}

                {/* Copy Theme Settings Section */}
                {customThemes.length > 1 && (
                  <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 space-y-2 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Copy className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copy Layout & Settings</span>
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                        Editing Theme {selectedThemeIndex + 1}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Copy all element positions, font sizes, colors, and badge styles from another theme into <strong>Theme {selectedThemeIndex + 1}</strong>.
                    </p>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <select
                        value={sourceThemeToCopy}
                        onChange={(e) => setSourceThemeToCopy(Number(e.target.value))}
                        className="flex-1 bg-white border border-slate-300 text-slate-800 text-xs rounded-xl px-3 py-2 font-semibold outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {customThemes.map((_, i) => (
                          i !== selectedThemeIndex ? (
                            <option key={i} value={i}>
                              Copy from Theme {i + 1} {themeConfigs[i] ? '(Customized)' : '(Default)'}
                            </option>
                          ) : null
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleCopyThemeSettings(sourceThemeToCopy, selectedThemeIndex)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy to Theme {selectedThemeIndex + 1}</span>
                      </button>
                    </div>
                  </div>
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
                    onClick={() => setThemeRules([...themeRules, { id: Date.now(), type: 'singleResult', resultNumber: 1, themeIndex: 0 }])}
                    className="flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-lg border border-sky-200 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Single Result Rule
                  </button>
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
                  const isSingleResult = rule.type === 'singleResult' || rule.type === 'single';
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
                          value={isSingleResult ? 'singleResult' : isCategoryRule ? 'category' : 'resultRange'}
                          onChange={e => {
                            const newType = e.target.value;
                            const newRules = [...themeRules];
                            if (newType === 'singleResult') {
                              newRules[idx] = {
                                ...newRules[idx],
                                type: 'singleResult',
                                resultNumber: newRules[idx].resultNumber || newRules[idx].startResult || 1
                              };
                            } else if (newType === 'category') {
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
                          <option value="singleResult">Single Result (Only 1 Result)</option>
                          <option value="resultRange">Result Number Range</option>
                          <option value="category">Category Wise</option>
                        </select>
                      </div>

                      {/* Rule Inputs */}
                      {isSingleResult ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600">Result Number:</span>
                          <span className="text-xs text-slate-400 font-mono font-bold">#</span>
                          <input
                            type="number"
                            min={1}
                            value={rule.resultNumber ?? rule.startResult ?? 1}
                            onChange={e => {
                              const newRules = [...themeRules];
                              newRules[idx].resultNumber = Number(e.target.value);
                              setThemeRules(newRules);
                            }}
                            className="w-20 px-2 py-1 text-xs border rounded bg-white text-slate-800 font-bold"
                          />
                        </div>
                      ) : isCategoryRule ? (
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
            <SectionHeader id="colors" title={`Colors — Theme ${selectedThemeIndex + 1}`} icon={Palette} />
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
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">
                    Unit / Team Name Color
                  </label>
                  <input type="color" value={conf.unitColor || '#1e293b'} onChange={e => updateConf('unitColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Rank Text Color</label>
                  <input type="color" value={conf.rankTextColor} onChange={e => updateConf('rankTextColor', e.target.value)} className="w-full h-8 rounded border" />
                </div>
                <div className="col-span-2 sm:col-span-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Use Distinct Team Colors</span>
                    <span className="text-[10px] text-slate-400 block">When disabled, all teams use the unified Theme Unit Color above</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={conf.useTeamColors === true}
                      onChange={e => updateConf('useTeamColors', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Typography */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="typography" title={`Typography — Theme ${selectedThemeIndex + 1}`} icon={Layers} />
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

                {/* Text Alignment & Multi-Line Controls */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Text Alignments & Multi-Line Wrapping
                  </span>

                  {/* Participant Name Alignment & Wrap */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Participant / Winner Names</span>
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                        {(['left', 'center', 'right'] as const).map(align => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateConf('winnerAlign', align)}
                            className={`px-2.5 py-1 text-[11px] font-bold rounded-md capitalize transition ${
                              (conf.winnerAlign || 'left') === align
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-slate-100">
                      <input
                        type="checkbox"
                        checked={conf.winnerWrap ?? false}
                        onChange={e => updateConf('winnerWrap', e.target.checked)}
                        className="accent-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-700">Wrap Names into 2 Lines (e.g. Sayyid Sinan)</span>
                    </label>
                  </div>

                  {/* Unit / Team Name Alignment */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Unit / Team Names</span>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      {(['left', 'center', 'right'] as const).map(align => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => updateConf('unitAlign', align)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md capitalize transition ${
                            (conf.unitAlign || conf.winnerAlign || 'left') === align
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Competition Name Alignment */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Competition Name</span>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      {(['left', 'center', 'right'] as const).map(align => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => updateConf('compNameAlign', align)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md capitalize transition ${
                            (conf.compNameAlign || 'left') === align
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Script Text Alignment */}
                  <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Cursive Script (e.g. mid zone)</span>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      {(['left', 'center', 'right'] as const).map(align => (
                        <button
                          key={align}
                          type="button"
                          onClick={() => updateConf('scriptAlign', align)}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md capitalize transition ${
                            (conf.scriptAlign || 'left') === align
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {align}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Font Families</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Campus Font</label>
                      <select value={conf.campusNameFont || 'sans-serif'} onChange={e => updateConf('campusNameFont', e.target.value)} className="w-full text-xs p-1.5 border rounded-lg bg-white">
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Fest Font</label>
                      <select value={conf.festNameFont || 'sans-serif'} onChange={e => updateConf('festNameFont', e.target.value)} className="w-full text-xs p-1.5 border rounded-lg bg-white">
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Category Font</label>
                      <select value={conf.categoryFont || 'sans-serif'} onChange={e => updateConf('categoryFont', e.target.value)} className="w-full text-xs p-1.5 border rounded-lg bg-white">
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Competition Font</label>
                      <select value={conf.compNameFont || 'sans-serif'} onChange={e => updateConf('compNameFont', e.target.value)} className="w-full text-xs p-1.5 border rounded-lg bg-white">
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Result Label Font</label>
                      <select value={conf.resultLabelFont || 'sans-serif'} onChange={e => updateConf('resultLabelFont', e.target.value)} className="w-full text-xs p-1.5 border rounded-lg bg-white">
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Result Num Font</label>
                      <select value={conf.resultNumFont || 'sans-serif'} onChange={e => updateConf('resultNumFont', e.target.value)} className="w-full text-xs p-1.5 border rounded-lg bg-white">
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Winner Name Font</label>
                      <select value={conf.winnerFont || 'sans-serif'} onChange={e => updateConf('winnerFont', e.target.value)} className="w-full text-xs p-1.5 border rounded-lg bg-white">
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Unit Name Font</label>
                      <select value={conf.unitFont || 'monospace'} onChange={e => updateConf('unitFont', e.target.value)} className="w-full text-xs p-1.5 border rounded-lg bg-white">
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 mb-0.5">Rank Font</label>
                      <select value={conf.rankFont || 'sans-serif'} onChange={e => updateConf('rankFont', e.target.value)} className="w-full text-xs p-1.5 border rounded-lg bg-white">
                        {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Team / Unit Name Display Language (Poster Only) */}
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                        Team / Unit Name Language (Poster Only)
                      </span>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Display team names in English or Arabic on this poster theme. Everywhere else remains English.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateConf('unitLanguage', 'en')}
                      className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs transition border cursor-pointer ${conf.unitLanguage !== 'ar'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      English
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        updateConf('unitLanguage', 'ar');
                        if (!conf.unitFont || conf.unitFont === 'monospace') {
                          updateConf('unitFont', "'Cairo', sans-serif");
                        }
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-xl font-bold text-xs transition border cursor-pointer ${conf.unitLanguage === 'ar'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                      Arabic (العربية)
                    </button>
                  </div>

                  {conf.unitLanguage === 'ar' && (
                    <div className="pt-2 border-t border-emerald-200/60 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-950 uppercase">
                          Custom Arabic Team Names & Spellings (Editable)
                        </span>
                        <span className="text-[9px] text-slate-500">Edit Arabic poster display name for each team</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        {activeUnits.map((u, idx) => {
                          const defaultAr = idx === 0 ? 'TEAM السِّيرَافِي' : idx === 1 ? 'TEAM التَّبْرِيزِي' : idx === 2 ? 'TEAM الزَّنْجَبَارِي' : u.name;
                          const arValue = conf.unitArabicNames?.[u.name] ?? defaultAr;
                          const defaultColor = idx === 0 ? '#0284c7' : idx === 1 ? '#d97706' : '#16a34a';
                          const unitColorVal = conf.unitColors?.[u.name] || defaultColor;

                          return (
                            <div key={u.id || u.name} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-800 truncate" title={u.name}>{u.name}</span>
                                {conf.useTeamColors && (
                                  <input
                                    type="color"
                                    value={unitColorVal}
                                    onChange={(e) => {
                                      const updated = { ...(conf.unitColors || {}), [u.name]: e.target.value };
                                      updateConf('unitColors', updated);
                                    }}
                                    title={`${u.name} Color`}
                                    className="w-5 h-5 rounded cursor-pointer border border-slate-200"
                                  />
                                )}
                              </div>
                              <input
                                type="text"
                                dir="rtl"
                                value={arValue}
                                onChange={(e) => {
                                  const updated = { ...(conf.unitArabicNames || {}), [u.name]: e.target.value };
                                  updateConf('unitArabicNames', updated);
                                }}
                                className="w-full px-2.5 py-1 text-sm font-bold border border-slate-200 rounded-lg text-right"
                                placeholder={defaultAr}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Result Label Controls */}
                <div className="p-3 bg-slate-50 rounded-xl space-y-3 border border-slate-200/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Result Label ("RESULT")</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={conf.showResultLabel !== false}
                        onChange={e => updateConf('showResultLabel', e.target.checked)}
                        className="accent-emerald-600"
                      />
                      <span className="text-xs font-bold text-slate-700">Show Label</span>
                    </label>
                  </div>

                  {conf.showResultLabel !== false && (
                    <div className="space-y-2.5 pt-1 border-t border-slate-200/60">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Result Label Text Word</label>
                        <input
                          type="text"
                          value={conf.resultLabelText ?? 'RESULT'}
                          onChange={e => updateConf('resultLabelText', e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border rounded-lg bg-white"
                          placeholder="RESULT"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Label Direction</label>
                          <select
                            value={conf.resultLabelVertical ? 'vertical' : 'horizontal'}
                            onChange={e => updateConf('resultLabelVertical', e.target.value === 'vertical')}
                            className="w-full text-xs p-1.5 border rounded-lg bg-white font-semibold"
                          >
                            <option value="vertical">Vertical Letters</option>
                            <option value="horizontal">Horizontal Line</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-1">Label Color</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={conf.resultLabelColor || '#84C75D'}
                              onChange={e => updateConf('resultLabelColor', e.target.value)}
                              className="w-7 h-7 rounded border cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-slate-500">{conf.resultLabelColor || '#84C75D'}</span>
                          </div>
                        </div>
                      </div>

                      {conf.resultLabelVertical && (
                        <RangeControl
                          label="Vertical Letter Spacing"
                          value={conf.resultLabelLineGap || Math.round((conf.resultLabelSize || 24) * 1.25)}
                          onChange={v => updateConf('resultLabelLineGap', v)}
                          min={8}
                          max={50}
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          const rX = conf.resultNumX ?? 135;
                          const rY = conf.resultNumY ?? 375;
                          updateConfMultiple({
                            showResultLabel: true,
                            resultLabelX: rX + 48,
                            resultLabelY: Math.max(rY - 90, 80),
                            resultLabelColor: conf.resultNumColor || '#84C75D',
                            resultLabelVertical: true,
                            resultLabelSize: 22
                          });
                        }}
                        className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-lg border border-emerald-200 transition cursor-pointer"
                      >
                        Reset / Snap Label to Number Position
                      </button>
                    </div>
                  )}
                </div>

                {/* Result Number Controls (Normal Solid Font vs Outline) */}
                <div className="p-3 bg-slate-50 rounded-xl space-y-3 border border-slate-200/70">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Result Number Style</span>
                      <span className="text-[10px] text-slate-400 block">Choose normal solid font or outline stroke</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateConf('resultNumStyle', 'fill')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        conf.resultNumStyle !== 'stroke'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Normal Solid Font
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConf('resultNumStyle', 'stroke')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        conf.resultNumStyle === 'stroke'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Outline Stroke (2-Line)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1">Cursive Script Text (SignPainter, e.g. "mid zone")</label>
                  <input type="text" value={conf.scriptText ?? 'mid zone'} onChange={e => updateConf('scriptText', e.target.value)} className="w-full px-3 py-1.5 text-sm border rounded-lg" placeholder="e.g. mid zone" />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={conf.showDividers ?? false} onChange={e => updateConf('showDividers', e.target.checked)} className="accent-emerald-600" />
                    <span className="text-sm font-bold text-slate-700">Winner Divider Lines</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={conf.showScriptText !== false} onChange={e => updateConf('showScriptText', e.target.checked)} className="accent-emerald-600" />
                    <span className="text-sm font-bold text-slate-700">Cursive Script</span>
                  </label>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={conf.uppercaseNames} onChange={e => updateConf('uppercaseNames', e.target.checked)} className="accent-emerald-600" />
                  <span className="text-sm font-bold text-slate-700">Force Uppercase Names</span>
                </label>
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl">
                  <RangeControl label="Script Size" value={conf.scriptSize ?? 48} onChange={v => updateConf('scriptSize', v)} min={16} max={90} />
                  <RangeControl label="Campus Size" value={conf.campusNameSize ?? 28} onChange={v => updateConf('campusNameSize', v)} min={12} max={60} />
                  <RangeControl label="Fest Size" value={conf.festNameSize ?? 36} onChange={v => updateConf('festNameSize', v)} min={16} max={80} />
                  <RangeControl label="Result Label Size" value={conf.resultLabelSize || 28} onChange={v => updateConf('resultLabelSize', v)} min={14} max={80} />
                  <RangeControl label="Result Number Size" value={conf.resultNumSize || 28} onChange={v => updateConf('resultNumSize', v)} min={14} max={180} />
                  <RangeControl label="Category Size" value={conf.categorySize} onChange={v => updateConf('categorySize', v)} min={16} max={80} />
                  <RangeControl label="Comp Name Size" value={conf.compNameSize} onChange={v => updateConf('compNameSize', v)} min={20} max={100} />
                  <RangeControl label="Winner Name Size" value={conf.winnerSize} onChange={v => updateConf('winnerSize', v)} min={20} max={80} />
                  <RangeControl label="Unit Name Size" value={conf.unitSize} onChange={v => updateConf('unitSize', v)} min={14} max={60} />
                  <RangeControl label="Rank Text Size" value={conf.rankSize} onChange={v => updateConf('rankSize', v)} min={14} max={80} />
                </div>
              </div>
            )}
          </div>

          {/* Divider Lines (Automatic Winner Row Separators & Standalone Custom Lines) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="dividers" title={`Divider Lines — Theme ${selectedThemeIndex + 1}`} icon={Minus} />
            {expandedSection === 'dividers' && (
              <div className="space-y-4">
                {/* Automatic Winner Dividers */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Winner Row Dividers</span>
                      <span className="text-[10px] text-slate-400 block">Horizontal separator lines between Rank 1, Rank 2 & Rank 3</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={conf.showDividers ?? false}
                        onChange={e => updateConf('showDividers', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {conf.showDividers && (
                    <div className="pt-2 border-t border-slate-200 space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Line Color</label>
                        <input
                          type="color"
                          value={conf.dividerColor || '#ffffff'}
                          onChange={e => updateConf('dividerColor', e.target.value)}
                          className="w-8 h-7 rounded border border-slate-200 cursor-pointer"
                        />
                        <span className="text-xs font-mono text-slate-500">{conf.dividerColor || '#ffffff'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <RangeControl
                          label="Line Thickness"
                          value={conf.dividerWidth ?? 1}
                          onChange={v => updateConf('dividerWidth', v)}
                          min={1}
                          max={10}
                        />
                        <RangeControl
                          label="Line Length"
                          value={conf.dividerLength ?? 280}
                          onChange={v => updateConf('dividerLength', v)}
                          min={50}
                          max={800}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Standalone Custom Divider Lines */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Custom Standalone Divider Lines</span>
                      <span className="text-[10px] text-slate-400 block">Add custom divider lines anywhere. Drag & drop directly on preview!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const current = [...(conf.customDividers || [])];
                        current.push({
                          id: 'div_' + Date.now(),
                          x: 260,
                          y: 530,
                          length: 300,
                          thickness: 2,
                          color: '#ffffff'
                        });
                        updateConf('customDividers', current);
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg border border-emerald-300 transition shadow-2xs cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Line</span>
                    </button>
                  </div>

                  {(!conf.customDividers || conf.customDividers.length === 0) ? (
                    <div className="text-center py-4 text-xs text-slate-400 italic bg-white rounded-xl border border-dashed border-slate-200">
                      No custom divider lines added yet. Click "+ Add Line" to add one.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {conf.customDividers.map((div: any, i: number) => (
                        <div key={div.id || i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Divider Line #{i + 1}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                title="Duplicate Line"
                                onClick={() => {
                                  const current = [...(conf.customDividers || [])];
                                  current.push({
                                    ...div,
                                    id: 'div_' + Date.now(),
                                    y: (div.y || 530) + 40
                                  });
                                  updateConf('customDividers', current);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded transition cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Delete Line"
                                onClick={() => {
                                  const current = (conf.customDividers || []).filter((_: any, idx: number) => idx !== i);
                                  updateConf('customDividers', current);
                                }}
                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Color and Presets */}
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Color</label>
                            <input
                              type="color"
                              value={div.color || '#ffffff'}
                              onChange={e => {
                                const current = [...(conf.customDividers || [])];
                                current[i] = { ...current[i], color: e.target.value };
                                updateConf('customDividers', current);
                              }}
                              className="w-7 h-6 rounded border cursor-pointer"
                            />
                            <div className="flex items-center gap-1">
                              {['#ffffff', '#84C75D', '#FFAE00', '#C4020B', '#1e293b'].map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => {
                                    const current = [...(conf.customDividers || [])];
                                    current[i] = { ...current[i], color: c };
                                    updateConf('customDividers', current);
                                  }}
                                  className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs hover:scale-110 transition cursor-pointer"
                                  style={{ backgroundColor: c }}
                                  title={c}
                                />
                              ))}
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 ml-auto">{div.color || '#ffffff'}</span>
                          </div>

                          {/* Position & Dimensions */}
                          <div className="grid grid-cols-2 gap-2">
                            <RangeControl
                              label="Position X"
                              value={div.x ?? 260}
                              onChange={v => {
                                const current = [...(conf.customDividers || [])];
                                current[i] = { ...current[i], x: v };
                                updateConf('customDividers', current);
                              }}
                              min={0}
                              max={1080}
                            />
                            <RangeControl
                              label="Position Y"
                              value={div.y ?? 530}
                              onChange={v => {
                                const current = [...(conf.customDividers || [])];
                                current[i] = { ...current[i], y: v };
                                updateConf('customDividers', current);
                              }}
                              min={50}
                              max={1300}
                            />
                            <RangeControl
                              label="Length (px)"
                              value={div.length ?? 300}
                              onChange={v => {
                                const current = [...(conf.customDividers || [])];
                                current[i] = { ...current[i], length: v };
                                updateConf('customDividers', current);
                              }}
                              min={20}
                              max={1000}
                            />
                            <RangeControl
                              label="Thickness (px)"
                              value={div.thickness ?? 2}
                              onChange={v => {
                                const current = [...(conf.customDividers || [])];
                                current[i] = { ...current[i], thickness: v };
                                updateConf('customDividers', current);
                              }}
                              min={1}
                              max={20}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Tilt & Rotation */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="rotation" title={`Tilt & Rotation — Theme ${selectedThemeIndex + 1}`} icon={RotateCw} />
            {expandedSection === 'rotation' && (
              <div className="space-y-4">
                <p className="text-[10px] text-slate-500">
                  Rotate the entire content layout or individual elements in degrees.
                </p>

                {/* Overall Content Tilt */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Overall Content Tilt / Angle</span>
                      <span className="text-[10px] text-slate-500 block">Slants all elements together (Theme 4 slope is -7.5°)</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                      {conf.contentRotation ?? 0}°
                    </span>
                  </div>

                  <RangeControl
                    label="Rotation Angle (Degrees)"
                    value={conf.contentRotation ?? 0}
                    onChange={v => updateConf('contentRotation', v)}
                    min={-30}
                    max={30}
                    step={0.5}
                  />

                  {/* Preset Slant Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 mr-1">Presets:</span>
                    {[
                      { label: '0° Flat', val: 0 },
                      { label: '-7.5° (Theme 4 Slope)', val: -7.5 },
                      { label: '+7.5°', val: 7.5 },
                      { label: '-15°', val: -15 },
                      { label: '+15°', val: 15 },
                    ].map(p => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => updateConf('contentRotation', p.val)}
                        className={`px-2 py-1 text-[10px] font-bold rounded-lg transition border cursor-pointer ${
                          (conf.contentRotation ?? 0) === p.val
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Individual Element Rotations */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                    Individual Element Tilt
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <RangeControl
                      label="Result Number Tilt"
                      value={conf.resultNumRotation ?? 0}
                      onChange={v => updateConf('resultNumRotation', v)}
                      min={-45}
                      max={45}
                      step={1}
                    />
                    <RangeControl
                      label="Competition Title Tilt"
                      value={conf.compNameRotation ?? 0}
                      onChange={v => updateConf('compNameRotation', v)}
                      min={-45}
                      max={45}
                      step={1}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rank Badges */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
            <SectionHeader id="ranks" title={`Rank Badges — Theme ${selectedThemeIndex + 1}`} icon={Award} />
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <RangeControl
                    label="Badge Shape Size"
                    value={conf.rankBadgeShapeSize ?? 40}
                    onChange={v => updateConf('rankBadgeShapeSize', v)}
                    min={20}
                    max={120}
                  />
                  <RangeControl
                    label="Rank Text Size"
                    value={conf.rankSize ?? 38}
                    onChange={v => updateConf('rankSize', v)}
                    min={14}
                    max={80}
                  />
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
            <SectionHeader id="footer" title={`Footer Options — Theme ${selectedThemeIndex + 1}`} icon={Layers} />
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
            <SectionHeader id="positions" title={`Positions — Theme ${selectedThemeIndex + 1}`} icon={Move} />
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
                    <RangeControl label="Script X" value={conf.scriptX ?? 296} onChange={v => updateConf('scriptX', v)} min={0} max={1080} />
                    <RangeControl label="Script Y" value={conf.scriptY ?? 308} onChange={v => updateConf('scriptY', v)} min={30} max={600} />
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
            <div className="flex items-center justify-between w-full pb-3 border-b border-slate-100 mb-3 px-2">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider font-mono">
                Default Template Preview — Theme {selectedThemeIndex + 1}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Drag any element to reposition</span>
            </div>

            {/* 3-Digit Result Number Preview Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 bg-slate-900 text-white rounded-2xl border border-slate-700/80 mb-3 shadow-md w-full">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-extrabold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                  <Eye className="w-4 h-4 text-cyan-400" /> Preview Result No:
                </span>
                {['01', '09', '10', '99', '100', '101', '125'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setSampleResultNum(num)}
                    className={`px-2 py-0.5 rounded-md font-mono text-xs font-black transition-all cursor-pointer ${
                      sampleResultNum === num
                        ? 'bg-cyan-400 text-slate-950 shadow-md scale-105'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-semibold">Custom:</span>
                <input
                  type="text"
                  value={sampleResultNum}
                  onChange={(e) => setSampleResultNum(e.target.value)}
                  maxLength={6}
                  placeholder="e.g. 101"
                  className="w-16 px-1.5 py-0.5 rounded-lg bg-slate-800 text-cyan-300 font-mono text-center text-xs font-bold border border-slate-700 focus:border-cyan-400 focus:outline-none"
                />
              </div>
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

export default PosterSettingsView;

