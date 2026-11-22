import { dbClient } from './db.js';
import { 
  Participant, Result, Team, Unit, Competition, StageType, 
  ResultStatus, ParticipationType, JudgmentSheetStatus 
} from '../src/types.js';

/**
 * Helper to normalize mark out of 100 if two judges gave marks.
 */
export const getNormalizedMark = (r: Result): number => {
  if (r.status === ResultStatus.ABSENT || (r as any).status === 'absent') return 0;
  if (r.averageMark !== undefined && !isNaN(r.averageMark)) {
    return r.averageMark;
  }
  if (r.totalMark === undefined || isNaN(r.totalMark)) return 0;
  const j1 = Number(r.judge1Mark) || 0;
  const j2 = Number(r.judge2Mark) || 0;
  const activeJudges = (j1 > 0 ? 1 : 0) + (j2 > 0 ? 1 : 0) || 1;
  return Math.round(((j1 + j2) / activeJudges) * 100) / 100;
};

/**
 * Official Grade calculation:
 * Individual:
 *  95 - 100: A+
 *  85 - 94: A  (90-95: A, 85-90: A)
 *  70 - 84: B  (80-85: B, 75-80: B, 70-75: B)
 *  50 - 69: C  (65-70: C, 55-65: C, 50-55: C)
 *  Below 50: No grade (40-50: No grade with 1 point, Below 40: No grade with 0 points)
 *
 * Group:
 *  95 - 100: A+
 *  80 - 94: A  (90-95: A, 85-90: A, 80-85: A)
 *  55 - 79: B  (75-80: B, 70-75: B, 65-70: B, 55-65: B)
 *  30 - 54: C  (50-55: C, 40-50: C, 30-40: C)
 *  Below 30: No grade (with 5 points for mark > 0)
 */
export interface GradeMatrixRow {
  id: string;
  minMark: number;
  maxMark: number;
  indGrade: string;
  indPoints: number;
  groupGrade: string;
  groupPoints: number;
}

export const DEFAULT_GRADE_MATRIX: GradeMatrixRow[] = [
  { id: '1', minMark: 95, maxMark: 100, indGrade: 'A+', indPoints: 10, groupGrade: 'A+', groupPoints: 20 },
  { id: '2', minMark: 90, maxMark: 95, indGrade: 'A', indPoints: 9, groupGrade: 'A', groupPoints: 19 },
  { id: '3', minMark: 85, maxMark: 90, indGrade: 'A', indPoints: 8, groupGrade: 'A', groupPoints: 18 },
  { id: '4', minMark: 80, maxMark: 85, indGrade: 'B', indPoints: 7, groupGrade: 'A', groupPoints: 17 },
  { id: '5', minMark: 75, maxMark: 80, indGrade: 'B', indPoints: 6, groupGrade: 'B', groupPoints: 16 },
  { id: '6', minMark: 70, maxMark: 75, indGrade: 'B', indPoints: 5, groupGrade: 'B', groupPoints: 15 },
  { id: '7', minMark: 65, maxMark: 70, indGrade: 'C', indPoints: 4, groupGrade: 'B', groupPoints: 14 },
  { id: '8', minMark: 55, maxMark: 65, indGrade: 'C', indPoints: 3, groupGrade: 'B', groupPoints: 13 },
  { id: '9', minMark: 50, maxMark: 55, indGrade: 'C', indPoints: 2, groupGrade: 'C', groupPoints: 12 },
  { id: '10', minMark: 40, maxMark: 50, indGrade: '-', indPoints: 1, groupGrade: 'C', groupPoints: 11 },
  { id: '11', minMark: 30, maxMark: 40, indGrade: '-', indPoints: 0, groupGrade: 'C', groupPoints: 10 },
  { id: '12', minMark: 0, maxMark: 30, indGrade: '-', indPoints: 0, groupGrade: '-', groupPoints: 5 }
];

export interface TeamSizePointTier {
  id: string;
  name: string;
  minMembers: number;
  maxMembers: number;
  matchKeywords?: string[];
  pointsAPlus: number;
  pointsA: number;
  pointsB: number;
  pointsC: number;
}

export const DEFAULT_TEAM_SIZE_TIERS: TeamSizePointTier[] = [
  { id: 'tier_ind', name: '1 Member (Individual)', minMembers: 1, maxMembers: 1, pointsAPlus: 6, pointsA: 5, pointsB: 3, pointsC: 1 },
  { id: 'tier_2', name: '2 Members (Group)', minMembers: 2, maxMembers: 2, pointsAPlus: 7, pointsA: 6, pointsB: 4, pointsC: 2 },
  { id: 'tier_3', name: '3 Members (Group)', minMembers: 3, maxMembers: 3, pointsAPlus: 10, pointsA: 9, pointsB: 6, pointsC: 3 },
  { id: 'tier_4_5', name: '4 or 5 Members (Group)', minMembers: 4, maxMembers: 5, pointsAPlus: 18, pointsA: 15, pointsB: 10, pointsC: 5 },
  { id: 'tier_10', name: '10 Members (Group)', minMembers: 10, maxMembers: 10, pointsAPlus: 25, pointsA: 20, pointsB: 12, pointsC: 6 },
  { id: 'tier_project', name: 'Project (Special)', minMembers: 1, maxMembers: 99, matchKeywords: ['project', 'പ്രോജക്ട്'], pointsAPlus: 25, pointsA: 20, pointsB: 12, pointsC: 6 },
  { id: 'tier_vlog', name: 'Vlog / Social Story', minMembers: 1, maxMembers: 99, matchKeywords: ['vlog', 'social story', 'വ്ലോഗ്', 'സോഷ്യൽ സ്റ്റോറി'], pointsAPlus: 25, pointsA: 20, pointsB: 12, pointsC: 6 }
];

export const OFFICIAL_GRADE_MATRIX: GradeMatrixRow[] = [
  { id: '1', minMark: 90, maxMark: 100, indGrade: 'A+', indPoints: 6, groupGrade: 'A+', groupPoints: 10 },
  { id: '2', minMark: 70, maxMark: 89, indGrade: 'A', indPoints: 5, groupGrade: 'A', groupPoints: 9 },
  { id: '3', minMark: 60, maxMark: 69, indGrade: 'B', indPoints: 3, groupGrade: 'B', groupPoints: 6 },
  { id: '4', minMark: 50, maxMark: 59, indGrade: 'C', indPoints: 1, groupGrade: 'C', groupPoints: 3 },
  { id: '5', minMark: 0, maxMark: 49, indGrade: '-', indPoints: 0, groupGrade: '-', groupPoints: 0 }
];

export const calculateGrade = (mark: number, isGroup: boolean = false, eventSettings?: any, categoryId?: string): string => {
  const m = Math.round(Number(mark) || 0);
  if (m <= 0 || isNaN(m)) return '';

  const db = dbClient.get();
  const settings = eventSettings || db.eventSettings;

  // If a custom gradeMatrix is configured, use it
  if (settings?.gradeMatrix && Array.isArray(settings.gradeMatrix) && settings.gradeMatrix.length > 0) {
    let matrix: GradeMatrixRow[] = settings.gradeMatrix;
    if (settings?.categorySpecificGradesEnabled && categoryId && settings?.categoryGradeMatrices?.[categoryId] && Array.isArray(settings.categoryGradeMatrices[categoryId]) && settings.categoryGradeMatrices[categoryId].length > 0) {
      matrix = settings.categoryGradeMatrices[categoryId];
    }
    const sorted = [...matrix].sort((a, b) => Number(b.minMark) - Number(a.minMark));
    for (const row of sorted) {
      if (m >= Number(row.minMark)) {
        const g = isGroup ? row.groupGrade : row.indGrade;
        return (!g || g === '-' || g === 'None') ? '' : g;
      }
    }
  }

  // Official Sahityotsav '26 Grade System:
  // A+: 90–100, A: 70–89, B: 60–69, C: 50–59, Below 50: No grade
  if (m >= 90) return 'A+';
  if (m >= 70) return 'A';
  if (m >= 60) return 'B';
  if (m >= 50) return 'C';
  return '';
};

/**
 * Grade Pointing System (Festival Points Distribution):
 * If gradeSystemEnabled !== false (Enabled by default):
 * Evaluates points dynamically from settings.categoryGradeMatrices[catId] (if category-specific enabled)
 * or settings.gradeMatrix or DEFAULT_GRADE_MATRIX
 */
export const calculateResultPoints = (r: Result, comp?: Competition, eventSettings?: any): number => {
  const db = dbClient.get();
  const settings = eventSettings || db.eventSettings;
  const gradeSystemEnabled = settings?.gradeSystemEnabled !== false;
  const combineGradeAndRankPoints = settings?.combineGradeAndRankPoints === true;
  const pointDistributionMode = settings?.pointDistributionMode || (settings?.categorySpecificGradesEnabled ? 'category_wise' : 'team_size');

  if (r.status === ResultStatus.ABSENT || (r as any).status === 'absent') return 0;
  const mark = getNormalizedMark(r);
  const m = Math.round(Number(mark) || 0);

  const compObj = comp || (db.competitions ? db.competitions.find(c => c.id === r.competitionId) : undefined);
  const isGroup = !!r.teamId || compObj?.participationType === ParticipationType.GROUP || (compObj as any)?.isGroup === true || String(compObj?.participationType).toLowerCase() === 'group';
  const catId = r.categoryId || compObj?.categoryId;
  const grade = (r as any).grade || (m > 0 ? calculateGrade(m, isGroup, settings, catId) : '');

  // 1. Calculate Grade Points based on active Point Distribution Mode
  let gradePoints = 0;
  if (gradeSystemEnabled && m > 0 && grade) {
    if (pointDistributionMode === 'team_size') {
      const tiers: TeamSizePointTier[] = (settings?.teamSizePointTiers && Array.isArray(settings.teamSizePointTiers) && settings.teamSizePointTiers.length > 0)
        ? settings.teamSizePointTiers
        : DEFAULT_TEAM_SIZE_TIERS;

      const compName = (compObj?.name || (r as any).eventName || '').toLowerCase();
      let teamSize = Number(compObj?.teamSize) || (isGroup ? 2 : 1);
      if (r.teamId && db.teams) {
        const t = db.teams.find(tm => tm.id === r.teamId);
        if (t && Array.isArray(t.memberIds) && t.memberIds.length > 0) {
          teamSize = t.memberIds.length;
        }
      }

      // 1. Check keyword match first (Project, Vlog, Social Story, etc.)
      let matchedTier = tiers.find(t =>
        Array.isArray(t.matchKeywords) && t.matchKeywords.some(kw => compName.includes(kw.toLowerCase()))
      );

      // 2. Match by team size range
      if (!matchedTier) {
        matchedTier = tiers.find(t => teamSize >= t.minMembers && teamSize <= t.maxMembers);
      }

      // 3. Fallback
      if (!matchedTier) {
        matchedTier = teamSize === 1 ? tiers[0] : (tiers.find(t => t.minMembers > 1) || tiers[0]);
      }

      if (matchedTier) {
        if (grade === 'A+') gradePoints = matchedTier.pointsAPlus;
        else if (grade === 'A') gradePoints = matchedTier.pointsA;
        else if (grade === 'B+' || grade === 'B') gradePoints = matchedTier.pointsB;
        else if (grade === 'C+' || grade === 'C') gradePoints = matchedTier.pointsC;
      }
    } else {
      // Standard Matrix lookup (Mode 1: all_categories, or Mode 2: category_wise)
      let matrix: GradeMatrixRow[] = OFFICIAL_GRADE_MATRIX;
      if (pointDistributionMode === 'category_wise' && catId && settings?.categoryGradeMatrices?.[catId] && Array.isArray(settings.categoryGradeMatrices[catId]) && settings.categoryGradeMatrices[catId].length > 0) {
        matrix = settings.categoryGradeMatrices[catId];
      } else if (settings?.gradeMatrix && Array.isArray(settings.gradeMatrix) && settings.gradeMatrix.length > 0) {
        matrix = settings.gradeMatrix;
      }

      const sorted = [...matrix].sort((a, b) => Number(b.minMark) - Number(a.minMark));
      for (const row of sorted) {
        if (m >= Number(row.minMark)) {
          gradePoints = isGroup ? Number(row.groupPoints) : Number(row.indPoints);
          break;
        }
      }
    }
  }

  // 2. Calculate Rank Points (Default: 1st=5, 2nd=3, 3rd=1, others=0)
  let rankPoints = 0;
  if (!gradeSystemEnabled || combineGradeAndRankPoints) {
    if (r.rank && r.rank >= 1 && r.rank <= 10) {
      const cat = db.categories ? db.categories.find(c => c.id === r.categoryId || c.id === compObj?.categoryId) : null;
      let catRankVal: any = null;
      if (cat) {
        const key = `pointsRank${r.rank}` as keyof typeof cat;
        if (cat[key] !== undefined && cat[key] !== null) {
          catRankVal = Number(cat[key]);
        }
      }
      if (catRankVal !== null && !isNaN(catRankVal)) {
        rankPoints = catRankVal;
      } else {
        const settingsKey = `globalPointsRank${r.rank}`;
        const settingsVal = (settings as any)?.[settingsKey];
        if (settingsVal !== undefined && settingsVal !== null) {
          const val = Number(settingsVal);
          if (!isNaN(val)) rankPoints = val;
        } else {
          const defaultMap: Record<number, number> = { 1: 5, 2: 3, 3: 1, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
          rankPoints = defaultMap[r.rank] || 0;
        }
      }
    }
  }

  // 3. Return total points according to active mode
  if (gradeSystemEnabled && combineGradeAndRankPoints) {
    return gradePoints + rankPoints;
  }
  if (gradeSystemEnabled) {
    return gradePoints;
  }
  return rankPoints;
};

export function toTitleCase(str: string): string {
  if (!str) return '';
  return str.trim().split(/\s+/).map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

/**
 * Service to centralize all scoreboard and standings calculations.
 */
export const CalculationService = {
  
  /**
   * Automatically calculates ranks for a specific competition,
   * respecting manual overrides and excluding inactive/absent participants.
   */
  calculateCompetitionRanks: (competitionId: string): Result[] => {
    const db = dbClient.get();
    
    // Get all results for this competition that are not soft-deleted
    const results = db.results.filter(r => r.competitionId === competitionId && !r.deletedAt);
    
    // Helper to get effective mark for ranking
    const getMark = (r: Result) => {
      if (r.averageMark !== undefined && !isNaN(r.averageMark)) return r.averageMark;
      if (r.totalMark !== undefined && !isNaN(r.totalMark)) return r.totalMark;
      const j1 = Number(r.judge1Mark) || 0;
      const j2 = Number(r.judge2Mark) || 0;
      return j1 + j2;
    };

    // Filter results that should be ranked
    const rankableResults = results.filter(r => 
      (r.status === ResultStatus.PARTICIPATED || (r.status as string) === 'participated' || !r.status) && 
      getMark(r) >= 0
    );
    
    // Sort rankable results: highest mark first
    rankableResults.sort((a, b) => getMark(b) - getMark(a));
    
    // Assign automatic ranks (Dense Ranking: 1, 1, 2, 2, 3, 3)
    let currentRank = 1;
    for (let i = 0; i < rankableResults.length; i++) {
      if (i > 0 && getMark(rankableResults[i]) < getMark(rankableResults[i - 1])) {
        currentRank++;
      }
      
      // Only apply auto-rank if there's no manual override
      if (!rankableResults[i].manualRankOverride) {
        rankableResults[i].rank = currentRank;
      }
    }
    
    // Handle manual overrides - merge overrides into the rankings
    // Non-rankable results (absent/disqualified) don't get ranks
    results.forEach(r => {
      const isPart = !r.status || r.status === ResultStatus.PARTICIPATED || (r.status as string) === 'participated';
      if (!isPart) {
        r.rank = undefined;
      } else if (r.manualRankOverride && r.rank === undefined) {
        // If manual rank override is true, ensure they have a rank (default to 1 if not set)
        r.rank = 1;
      }
    });
    
    return results;
  },

  /**
   * Calculates the individual scoreboard.
   * Returns details of ALL active participants (not deleted), sorted by score.
   */
  getIndividualScoreboard: (filters: {
    categoryId?: string;
    unitId?: string;
    stageType?: StageType;
    search?: string;
    includeLocked?: boolean;
  } = {}) => {
    const db = dbClient.get();
    const includeLocked = filters.includeLocked !== false; // Enabled by default as requested!
    
    const lockedCompIds = new Set(
      (db.judgmentSheets || [])
        .filter(js => !js.deletedAt && (js.status === JudgmentSheetStatus.LOCKED || js.publishedToResults))
        .map(js => js.competitionId)
    );

    const isResultEligible = (r: Result) => {
      if (r.deletedAt) return false;
      const statusOk = !r.status || r.status === ResultStatus.PARTICIPATED || String(r.status).toLowerCase() === 'participated';
      if (!statusOk) return false;
      return true;
    };

    // Get all active, non-deleted participants
    let participants = db.participants.filter(p => !p.deletedAt);
    
    // Apply filters
    if (filters.categoryId) {
      participants = participants.filter(p => p.selectedCategoryId === filters.categoryId);
    }
    if (filters.unitId) {
      participants = participants.filter(p => p.unitId === filters.unitId);
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      participants = participants.filter(p => p.fullName.toLowerCase().includes(searchLower));
    }
    
    // Map participants to their scores
    const scoreboardEntries = participants.map(participant => {
      // Find all eligible individual results for this participant:
      const rawIndResults = db.results.filter(r => {
        if (r.participantId !== participant.id) return false;
        return isResultEligible(r);
      });

      // Strict Deduplication per competitionId: Never count any competition twice!
      const uniqueIndMap = new Map<string, Result>();
      rawIndResults.forEach(r => {
        if (!uniqueIndMap.has(r.competitionId)) {
          uniqueIndMap.set(r.competitionId, r);
        }
      });
      const individualResults = Array.from(uniqueIndMap.values());
      
      // Group results: find teams where this participant is a member
      const teams = db.teams.filter(t => t.memberIds.includes(participant.id) && !t.deletedAt);
      const teamIds = teams.map(t => t.id);
      
      const rawGroupResults = db.results.filter(r => {
        if (!r.teamId || !teamIds.includes(r.teamId)) return false;
        return isResultEligible(r);
      });

      // Strict Deduplication per group competitionId:
      const uniqueGrpMap = new Map<string, Result>();
      rawGroupResults.forEach(r => {
        if (!uniqueGrpMap.has(r.competitionId)) {
          uniqueGrpMap.set(r.competitionId, r);
        }
      });
      const groupResults = Array.from(uniqueGrpMap.values());
      
      // Fetch competition metadata for filtering by On-Stage / Off-Stage
      let filteredIndividualResults = individualResults;
      let filteredGroupResults = groupResults;
      
      if (filters.stageType) {
        filteredIndividualResults = individualResults.filter(r => {
          const comp = db.competitions.find(c => c.id === r.competitionId);
          return comp && comp.stageType === filters.stageType;
        });
        filteredGroupResults = groupResults.filter(r => {
          const comp = db.competitions.find(c => c.id === r.competitionId);
          return comp && comp.stageType === filters.stageType;
        });
      }
      
      // Helper to identify General Category competitions
      const isGeneralComp = (r: Result) => {
        const comp = db.competitions.find(c => c.id === r.competitionId);
        if (comp) {
          if (comp.categoryId === 'cat_general') return true;
          const cat = db.categories.find(c => c.id === comp.categoryId);
          if (cat && cat.name.toLowerCase().includes('general')) return true;
        }
        if (r.categoryId === 'cat_general') return true;
        if ((r as any).categoryName && (r as any).categoryName.toLowerCase().includes('general')) return true;
        return false;
      };

      // Separate into primary category vs general category results
      const primaryIndividualResults = filteredIndividualResults.filter(r => !isGeneralComp(r));
      const generalIndividualResults = filteredIndividualResults.filter(r => isGeneralComp(r));

      const primaryGroupResults = filteredGroupResults.filter(r => !isGeneralComp(r));
      const generalGroupResults = filteredGroupResults.filter(r => isGeneralComp(r));

      // Calculate sums
      // Individual Marks: strictly from primary category individual competitions
      const individualMarks = Math.round(primaryIndividualResults.reduce((sum, r) => sum + getNormalizedMark(r), 0) * 100) / 100;
      const groupMarks = Math.round(primaryGroupResults.reduce((sum, r) => sum + getNormalizedMark(r), 0) * 100) / 100;
      const generalMarks = Math.round([...generalIndividualResults, ...generalGroupResults].reduce((sum, r) => sum + getNormalizedMark(r), 0) * 100) / 100;
      
      // Calculate points dynamically from grade pointing system
      const individualPoints = primaryIndividualResults.reduce((sum, r) => {
        const comp = db.competitions.find(c => c.id === r.competitionId);
        return sum + calculateResultPoints(r, comp, db.eventSettings);
      }, 0);

      // Individual Scoreboard strictly counts only their primary category individual competitions
      const overallMarks = individualMarks;
      const totalEvents = primaryIndividualResults.length;
      
      const unit = db.units.find(u => u.id === participant.unitId);
      const category = db.categories.find(c => c.id === participant.selectedCategoryId);

      const cnRecord = (db.chestNumbers || []).find((c: any) => !c.deletedAt && (c.participantId === participant.id || c.entityId === participant.id));
      const chestNumber = cnRecord?.chestNumber?.toString() || (participant as any).chestNumber?.toString() || participant.profilePhoto || '—';
      
      // Find rankings in individual, group, & general events
      const rankPlacements = [
        ...primaryIndividualResults.map(r => {
          const comp = db.competitions.find(c => c.id === r.competitionId);
          return {
            compId: r.competitionId,
            compName: comp ? toTitleCase(comp.name) : 'Competition',
            rank: r.rank,
            marks: getNormalizedMark(r),
            points: calculateResultPoints(r, comp, db.eventSettings),
            grade: (r as any).grade || calculateGrade(getNormalizedMark(r), false, db.eventSettings, r.categoryId || comp?.categoryId),
            type: 'Individual',
            isLocked: !((r as any).publishedStatus || (r as any).isPublished)
          };
        }),
        ...primaryGroupResults.map(r => {
          const comp = db.competitions.find(c => c.id === r.competitionId);
          return {
            compId: r.competitionId,
            compName: comp ? toTitleCase(comp.name) : 'Competition',
            rank: r.rank,
            marks: getNormalizedMark(r),
            points: calculateResultPoints(r, comp, db.eventSettings),
            grade: (r as any).grade || calculateGrade(getNormalizedMark(r), true, db.eventSettings, r.categoryId || comp?.categoryId),
            type: 'Group',
            isLocked: !((r as any).publishedStatus || (r as any).isPublished)
          };
        }),
        ...[...generalIndividualResults, ...generalGroupResults].map(r => {
          const comp = db.competitions.find(c => c.id === r.competitionId);
          return {
            compId: r.competitionId,
            compName: comp ? toTitleCase(comp.name) : 'Competition',
            rank: r.rank,
            marks: getNormalizedMark(r),
            points: calculateResultPoints(r, comp, db.eventSettings),
            grade: (r as any).grade || calculateGrade(getNormalizedMark(r), comp?.participationType === 'group', db.eventSettings, r.categoryId || comp?.categoryId),
            type: 'General',
            isLocked: !((r as any).publishedStatus || (r as any).isPublished)
          };
        })
      ];
      
      return {
        participantId: participant.id,
        name: toTitleCase(participant.fullName),
        unitId: participant.unitId,
        unitName: unit ? unit.name : 'Unknown',
        categoryId: participant.selectedCategoryId,
        categoryName: category ? category.name : 'Unknown',
        totalEvents,
        individualMarks,
        individualPoints,
        overallPoints: individualPoints,
        groupMarks,
        generalMarks,
        overallMarks,
        placements: rankPlacements,
        chestNumber
      };
    });
    
    // Sort primarily by points descending, then by overall marks descending, then by name
    scoreboardEntries.sort((a, b) => {
      const bPts = b.individualPoints ?? 0;
      const aPts = a.individualPoints ?? 0;
      if (bPts !== aPts) {
        return bPts - aPts;
      }
      if (b.overallMarks !== a.overallMarks) {
        return b.overallMarks - a.overallMarks;
      }
      return a.name.localeCompare(b.name);
    });
    
    // Assign ranks (Dense Ranking based on points then marks)
    let currentRank = 1;
    const finalScoreboard = scoreboardEntries.map((entry, index) => {
      if (index > 0) {
        const prev = scoreboardEntries[index - 1];
        const entryPts = entry.individualPoints ?? 0;
        const prevPts = prev.individualPoints ?? 0;
        if (entryPts < prevPts || (entryPts === prevPts && entry.overallMarks < prev.overallMarks)) {
          currentRank++;
        }
      }
      return {
        ...entry,
        rank: ((entry.individualPoints ?? 0) > 0 || entry.overallMarks > 0) ? currentRank : 'N/A'
      };
    });
    
    return finalScoreboard;
  },

  /**
   * Calculates unit standings.
   * Returns standings of ALL 6 units, sorted by total accumulated score.
   */
  getUnitStandings: (filters: {
    categoryId?: string;
    includeLocked?: boolean;
  } = {}) => {
    const db = dbClient.get();
    const includeLocked = Boolean(filters.includeLocked);

    const lockedCompIds = new Set(
      (db.judgmentSheets || [])
        .filter(js => !js.deletedAt && (js.status === JudgmentSheetStatus.LOCKED || js.publishedToResults))
        .map(js => js.competitionId)
    );

    const isResultEligible = (r: Result) => {
      if (r.deletedAt) return false;
      const statusOk = !r.status || r.status === ResultStatus.PARTICIPATED || String(r.status).toLowerCase() === 'participated';
      if (!statusOk) return false;
      const isPub = (r as any).publishedStatus === true || (r as any).isPublished === true;
      if (isPub) return true;
      if (includeLocked) {
        if (lockedCompIds.has(r.competitionId)) return true;
      }
      return false;
    };
    
    // Sum scores for all 6 units
    const unitStandings = db.units.map(unit => {
      // Find active participants in this unit
      // Helper to match unit flexibly (e.g. ash-shukr vs as-shukr vs unit_ash_shukr)
      const isUnitMatch = (uId?: string, uName?: string) => {
        if (!uId && !uName) return false;
        const normTarget = unit.id.toLowerCase().replace(/[-_]/g, '');
        const normId = uId ? String(uId).toLowerCase().replace(/[-_]/g, '') : '';
        const normName = uName ? String(uName).toLowerCase().replace(/[-_]/g, '') : '';
        if (normId === normTarget || normName === normTarget) return true;
        if (normTarget.includes('shukr') && (normId.includes('shukr') || normName.includes('shukr'))) return true;
        if (normTarget.includes('sabr') && (normId.includes('sabr') || normName.includes('sabr'))) return true;
        return false;
      };

      let participants = db.participants.filter(p => (isUnitMatch(p.unitId) || p.unitId === unit.id) && !p.deletedAt);
      if (filters.categoryId) {
        participants = participants.filter(p => p.selectedCategoryId === filters.categoryId);
      }
      
      const participantIds = participants.map(p => p.id);
      
      // Individual results for this unit's participants or directly assigned unit
      const rawIndResults = db.results.filter(r => {
        if (!isResultEligible(r)) return false;
        if (r.participantId && participantIds.includes(r.participantId)) return true;
        if (!r.teamId && (isUnitMatch((r as any).unitId, (r as any).unitName || (r as any).department))) return true;
        return false;
      });

      // Strict Deduplication per (competitionId, participantId)
      const uniqueIndMap = new Map<string, Result>();
      rawIndResults.forEach(r => {
        const key = `${r.competitionId}_${r.participantId || r.id}`;
        if (!uniqueIndMap.has(key)) {
          uniqueIndMap.set(key, r);
        }
      });
      const individualResults = Array.from(uniqueIndMap.values());
      
      // Group results for this unit's teams
      let teams = db.teams.filter(t => (isUnitMatch(t.unitId) || t.unitId === unit.id) && !t.deletedAt);
      if (filters.categoryId) {
        teams = teams.filter(t => t.categoryId === filters.categoryId);
      }
      const teamIds = teams.map(t => t.id);
      
      const rawGroupResults = db.results.filter(r => {
        if (!isResultEligible(r)) return false;
        if (r.teamId && teamIds.includes(r.teamId)) return true;
        if (r.teamId && isUnitMatch((r as any).unitId, (r as any).unitName || (r as any).department)) return true;
        return false;
      });

      // Strict Deduplication per (competitionId, teamId)
      const uniqueGrpMap = new Map<string, Result>();
      rawGroupResults.forEach(r => {
        const key = `${r.competitionId}_${r.teamId || r.id}`;
        if (!uniqueGrpMap.has(key)) {
          uniqueGrpMap.set(key, r);
        }
      });
      const groupResults = Array.from(uniqueGrpMap.values());
      
      // On-stage subtotals
      const onStageIndividual = individualResults.filter(r => {
        const comp = db.competitions.find(c => c.id === r.competitionId);
        return comp && comp.stageType === StageType.ON_STAGE;
      });
      const onStageGroup = groupResults.filter(r => {
        const comp = db.competitions.find(c => c.id === r.competitionId);
        return comp && comp.stageType === StageType.ON_STAGE;
      });
      const onStageMarks = Math.round((onStageIndividual.reduce((sum, r) => sum + getNormalizedMark(r), 0) + 
                             onStageGroup.reduce((sum, r) => sum + getNormalizedMark(r), 0)) * 100) / 100;
      
      // Off-stage subtotals
      const offStageIndividual = individualResults.filter(r => {
        const comp = db.competitions.find(c => c.id === r.competitionId);
        return comp && comp.stageType === StageType.OFF_STAGE;
      });
      const offStageGroup = groupResults.filter(r => {
        const comp = db.competitions.find(c => c.id === r.competitionId);
        return comp && comp.stageType === StageType.OFF_STAGE;
      });
      const offStageMarks = Math.round((offStageIndividual.reduce((sum, r) => sum + getNormalizedMark(r), 0) + 
                              offStageGroup.reduce((sum, r) => sum + getNormalizedMark(r), 0)) * 100) / 100;
      
      // Overall totals
      const overallMarks = Math.round((onStageMarks + offStageMarks) * 100) / 100;
      const completedResultsCount = individualResults.length + groupResults.length;
      
      // Calculate placement counts (Rank 1, Rank 2, Rank 3, Rank 4-7)
      let firstPlaceCount = 0;
      let secondPlaceCount = 0;
      let thirdPlaceCount = 0;
      let fourthToSeventhPlaceCount = 0;
      
      const countPlacements = (resultsList: Result[]) => {
        resultsList.forEach(r => {
          if (r.rank === 1) firstPlaceCount++;
          else if (r.rank === 2) secondPlaceCount++;
          else if (r.rank === 3) thirdPlaceCount++;
          else if (r.rank !== undefined && r.rank >= 4 && r.rank <= 7) fourthToSeventhPlaceCount++;
        });
      };
      
      countPlacements(individualResults);
      countPlacements(groupResults);
      
      // Helper to compute points dynamically from Grade Pointing System (or Category rank configuration)
      const getPoints = (r: Result) => {
        const comp = db.competitions.find(c => c.id === r.competitionId);
        return calculateResultPoints(r, comp, db.eventSettings);
      };

      // Compute individual & group points separately for transparency
      const individualPoints = individualResults.reduce((sum, r) => sum + getPoints(r), 0);
      const groupPoints = groupResults.reduce((sum, r) => sum + getPoints(r), 0);

      // Compute total unit points dynamically
      const overallPoints = individualPoints + groupPoints;

      // Compute Category Breakdown
      const categoryBreakdown = db.categories.map(cat => {
        // count of participants in this category for this unit
        const count = participants.filter(p => p.selectedCategoryId === cat.id).length;
        
        // results for this category
        const catResults = [...individualResults, ...groupResults].filter(r => r.categoryId === cat.id);
        const marks = Math.round(catResults.reduce((sum, r) => sum + getNormalizedMark(r), 0) * 100) / 100;
        
        let points = 0;
        catResults.forEach(r => {
          points += getPoints(r);
        });
        
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          count,
          marks,
          points
        };
      }).filter(b => b.count > 0 || b.marks > 0);

      return {
        unitId: unit.id,
        unitName: unit.name,
        unitCode: unit.code,
        totalParticipants: participants.length,
        completedResultsCount,
        individualPoints,
        groupPoints,
        onStageMarks,
        offStageMarks,
        overallMarks,
        overallPoints,
        firstPlaceCount,
        secondPlaceCount,
        thirdPlaceCount,
        fourthToSeventhPlaceCount,
        categoryBreakdown
      };
    });
    
    // Sort units: highest official points first, raw marks as tiebreaker
    unitStandings.sort((a, b) => {
      if (b.overallPoints !== a.overallPoints) return b.overallPoints - a.overallPoints;
      return b.overallMarks - a.overallMarks;
    });
    
    // Assign ranks (Dense Ranking)
    let currentRank = 1;
    const finalStandings = unitStandings.map((standing, index) => {
      const prev = unitStandings[index - 1];
      if (index > 0 && (standing.overallPoints < prev.overallPoints || (standing.overallPoints === prev.overallPoints && standing.overallMarks < prev.overallMarks))) {
        currentRank++;
      }
      return {
        ...standing,
        rank: currentRank
      };
    });
    
    return finalStandings;
  },

  /**
   * Fetches 1st, 2nd, and 3rd rank winners across all locked and evaluated competitions
   * Formatted specifically for stage announcements and official master printing
   */
  getLockedWinnersList: () => {
    const db = dbClient.get();
    
    // Find all judgment sheets that are LOCKED or COMPLETED or publishedToResults
    const sheetMap = new Map<string, any>();
    (db.judgmentSheets || []).forEach(js => {
      if (!js.deletedAt) {
        sheetMap.set(js.competitionId, js);
      }
    });

    const evaluatedCompIds = new Set(
      Array.from(sheetMap.values())
        .filter(js => js.status === JudgmentSheetStatus.LOCKED || js.publishedToResults)
        .map(js => js.competitionId)
    );

    const winnersByComp: any[] = [];

    db.competitions.forEach(comp => {
      const sheet = sheetMap.get(comp.id);
      // Must have locked judgment sheet or published results
      const isLockedSheet = evaluatedCompIds.has(comp.id);
      const isPublishedComp = (db.results || []).some(r => !r.deletedAt && r.competitionId === comp.id && ((r as any).publishedStatus === true || (r as any).isPublished === true));

      if (!isLockedSheet && !isPublishedComp) return;

      const compResults = (db.results || []).filter(r => 
        !r.deletedAt && 
        r.competitionId === comp.id && 
        r.rank && r.rank <= 3 &&
        (r.status === ResultStatus.PARTICIPATED || !r.status || String(r.status).toLowerCase() === 'participated')
      );

      if (compResults.length === 0) return;

      // Deduplicate by participantId or teamId
      const seenEntries = new Set<string>();
      const validResults: Result[] = [];
      for (const r of compResults) {
        const key = r.participantId || r.teamId || r.id;
        if (!seenEntries.has(key)) {
          seenEntries.add(key);
          validResults.push(r);
        }
      }

      validResults.sort((a, b) => (a.rank || 0) - (b.rank || 0));

      const category = db.categories.find(c => c.id === comp.categoryId);

      const winners = validResults.map(r => {
        let name = '';
        let chestNumber = '';
        let unitName = '';
        let unitId = '';

        if (r.participantId) {
          const p = db.participants.find(part => part.id === r.participantId);
          if (p) {
            name = p.fullName;
            unitId = p.unitId;
            const u = db.units.find(unit => unit.id === p.unitId);
            unitName = u ? u.name : '';
          }
          const cn = (db.chestNumbers || []).find((c: any) => !c.deletedAt && (c.participantId === r.participantId || c.entityId === r.participantId));
          chestNumber = cn?.chestNumber?.toString() || (p as any)?.chestNumber?.toString() || '';
        } else if (r.teamId) {
          const t = db.teams.find(team => team.id === r.teamId);
          if (t) {
            name = t.teamName || (t as any).name || 'Team';
            unitId = t.unitId;
            const u = db.units.find(unit => unit.id === t.unitId);
            unitName = u ? u.name : '';
          }
          const cn = (db.chestNumbers || []).find((c: any) => !c.deletedAt && (c.teamId === r.teamId || c.entityId === r.teamId));
          chestNumber = cn?.chestNumber?.toString() || '';
        }

        if (!unitName && (r as any).unitId) {
          const u = db.units.find(unit => unit.id === (r as any).unitId);
          if (u) unitName = u.name;
        }

        const mark = getNormalizedMark(r);
        const grade = (r as any).grade || calculateGrade(mark, comp.participationType === 'group', db.eventSettings, comp.categoryId || r.categoryId);
        const points = calculateResultPoints(r, comp, db.eventSettings);

        return {
          rank: r.rank,
          name: toTitleCase(name),
          chestNumber: chestNumber || '—',
          unitId,
          unitName: unitName || '—',
          mark,
          grade: grade || '—',
          points,
          status: r.status
        };
      });

      winnersByComp.push({
        competitionId: comp.id,
        competitionName: comp.name,
        competitionCode: comp.code || comp.id,
        categoryId: comp.categoryId,
        categoryName: category ? category.name : 'Unknown',
        stageType: comp.stageType || 'on_stage',
        participationType: comp.participationType || 'individual',
        sheetStatus: sheet?.status || 'locked',
        isPublished: Boolean(sheet?.publishedToResults || compResults.some(r => (r as any).publishedStatus)),
        winners
      });
    });

    // Sort by category name, then competition name
    winnersByComp.sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.competitionName.localeCompare(b.competitionName));

    return winnersByComp;
  }
};
