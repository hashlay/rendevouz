/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  SECTOR_TEAM = 'sector_team',
  UNIT_TEAM_LEADER = 'unit_team_leader',
  GREEN_ROOM_MANAGER = 'green_room_manager',
  JUDGE = 'judge',
  RESULT_MANAGER = 'result_manager',
  VIEWER = 'viewer'
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  email?: string;
  passwordHash: string;
  role: UserRole;
  assignedUnitId?: string; // For unit_team_leader
  assignedCompetitionIds?: string[]; // For judge program assignments
  active: boolean;
  mustChangePassword?: boolean;
  failedLoginAttempts: number;
  lockedUntil?: string; // ISO string
  lastLoginAt?: string; // ISO string
  passwordChangedAt?: string; // ISO string
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  sessionTokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  lastActivityAt: string;
}

export interface LoginAudit {
  id: string;
  username: string;
  success: boolean;
  failureReason?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  actorUserId?: string;
  actorUsername?: string;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId: string;
  assignedUnitId?: string;
  previousData?: string; // JSON string
  newData?: string; // JSON string
  timestamp: string;
}

export interface Unit {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export enum EducationStatus {
  STUDENT = 'student',
  HIGHER_SECONDARY = 'higher_secondary',
  UNDERGRADUATE = 'undergraduate',
  POSTGRADUATE = 'postgraduate'
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female'
}

export interface Category {
  id: string;
  name: string;
  code?: string;
  criteriaType?: 'dob' | 'class';
  dobStart?: string; // YYYY-MM-DD
  dobEnd?: string; // YYYY-MM-DD
  classStart?: string;
  classEnd?: string;
  pointsRank1?: number;
  pointsRank2?: number;
  pointsRank3?: number;
  pointsRank4?: number;
  pointsRank5?: number;
  pointsRank6?: number;
  pointsRank7?: number;
  pointsRank8?: number;
  pointsRank9?: number;
  pointsRank10?: number;
  startingChestNumber?: number;
  educationRequirements?: EducationStatus[];
  active: boolean;
}

export enum ParticipationType {
  INDIVIDUAL = 'individual',
  GROUP = 'group'
}

export enum StageType {
  ON_STAGE = 'on_stage',
  OFF_STAGE = 'off_stage'
}

export interface Competition {
  id: string;
  name: string;
  categoryId: string; // References Category
  language?: string;
  participationType: ParticipationType;
  teamSize: number; // For group events, defaults to 1 for individual
  duration: number; // in minutes
  stageType: StageType;
  displayOrder: number;
  numJudges?: number;
  active: boolean;
}

export interface Participant {
  id: string;
  fullName: string;
  dob: string; // YYYY-MM-DD
  unitId: string; // References Unit
  gender: Gender;
  educationStatus: EducationStatus;
  institution?: string;
  course?: string;
  yearSemester?: string;
  selectedCategoryId: string; // References Category
  phone?: string;
  guardianPhone?: string;
  address?: string;
  notes?: string;
  profilePhoto?: string;
  active: boolean;
  
  // Soft delete fields
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface Registration {
  id: string;
  participantId: string; // References Participant
  categoryId: string; // References Category
  selectedIndividualCompetitionIds: string[]; // References Competition
  selectedGroupTeamIds: string[]; // References Team
  registrationStatus: string; // 'pending', 'confirmed'
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  teamNumber: string; // Auto-generated e.g. "T-001" or "Nekkila-Burda-1"
  teamName?: string; // Custom team name
  unitId: string; // References Unit
  categoryId: string; // References Category
  competitionId: string; // References Competition
  memberIds: string[]; // References Participant
  
  // Soft delete fields
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
  
  createdAt: string;
  updatedAt: string;
}

export enum ResultStatus {
  PARTICIPATED = 'participated',
  NOT_PARTICIPATED = 'not_participated',
  ABSENT = 'absent',
  DISQUALIFIED = 'disqualified',
  RESULT_PENDING = 'result_pending'
}

export interface Result {
  id: string;
  categoryId: string; // References Category
  competitionId: string; // References Competition
  participantId?: string; // References Participant (for individual)
  teamId?: string; // References Team (for group)
  judge1Mark: number;
  judge2Mark: number;
  totalMark: number;
  rank?: number; // Calculated rank (1, 2, 3...)
  status: ResultStatus;
  remarks?: string;
  publishedStatus: boolean;
  certificatePublished?: boolean;
  manualRankOverride?: boolean;
  manualRankOverrideReason?: string;
  
  // Soft delete fields
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
  
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventSettings {
  eventTitle: string;
  sectorName: string;
  eventYear: string;
  cutoffDate: string; // YYYY-MM-DD, default "2026-05-01"
  eventDate?: string;
  venue?: string;
  contactInfo?: string;
  
  // Registration limits
  maxIndividualEvents: number; // default 3
  maxGroupEvents: number; // default 2
  registrationOpen: boolean;
  
  // Branding & CMS
  ssfLogoUrl: string;
  sahityotsavLogoUrl: string;
  logoUrl?: string;
  festivalName?: string;
  campusName?: string;
  entityMode?: 'unit' | 'house' | 'team';
  entityLabel?: string;
  gradeSystemEnabled?: boolean;
  certTheme1Url?: string;
  certTheme2Url?: string;
  certTheme3Url?: string;
  primaryColor: string; // e.g. "emerald" or HEX
  accentColor: string; // e.g. "amber" or HEX
  headerBannerUrl?: string;
  
  // Result configuration
  numJudges: number; // default 2
  markDecimalPrecision: number; // default 2
  autoRankingEnabled: boolean;
  maxMarksPerJudge?: number; // default 100
  
  // Global Points System
  globalPointsRank1?: number;
  globalPointsRank2?: number;
  globalPointsRank3?: number;
  globalPointsRank4?: number;
  globalPointsRank5?: number;
  globalPointsRank6?: number;
  globalPointsRank7?: number;
  globalPointsRank8?: number;
  globalPointsRank9?: number;
  globalPointsRank10?: number;
  
  // Poster Generation System
  posterTemplateConfig?: any; // Stores themes and coordinates for dynamic poster generation
  
  // Certificate Generation System
  certificateTemplateConfig?: any; // Stores themes and coordinates for dynamic certificate generation

  // Media Hub
  photoHubDriveLink?: string;
  stage1LiveLink?: string;
  stage2LiveLink?: string;
}

// ===== CHEST NUMBER SYSTEM =====

export interface ChestNumber {
  id: string;
  chestNumber: number; // e.g. 1000, 1001, 2000
  participantId: string;
  categoryId: string;
  unitId: string;
  generatedBy: string;
  generatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface Counter {
  id: string;
  categoryId: string;
  currentValue: number; // Last assigned number
}

// ===== GREEN ROOM SYSTEM =====

export enum GreenRoomStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  PRINTED = 'printed',
  CHECKED_IN = 'checked_in',
  STAGE_READY = 'stage_ready'
}

export interface GreenRoomAssignment {
  id: string;
  competitionId: string;
  categoryId: string;
  participantId?: string; // For individual
  teamId?: string; // For group
  chestNumber?: number;
  codeLetter: string; // A, B, C... Z, AA, AB...
  status: GreenRoomStatus;
  generatedBy: string;
  generatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

// ===== JUDGMENT SHEET SYSTEM =====

export enum JudgmentSheetStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  LOCKED = 'locked'
}

export interface JudgmentSheet {
  id: string;
  competitionId: string;
  categoryId: string;
  status: JudgmentSheetStatus;
  maxMarks: number;
  numJudges: number;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  publishedToResults?: boolean;
  deletedAt?: string;
}

export interface JudgeScoreEntry {
  judgeNumber: number; // 1-5
  mark: number;
  c1?: number; // Criteria 1 (max 25)
  c2?: number; // Criteria 2 (max 25)
  c3?: number; // Criteria 3 (max 25)
  c4?: number; // Criteria 4 (max 25)
  remarks?: string;
}

export enum JudgeScoreStatus {
  PARTICIPATED = 'participated',
  ABSENT = 'absent',
  DISQUALIFIED = 'disqualified'
}

export interface JudgeScore {
  id: string;
  judgmentSheetId: string;
  competitionId: string;
  codeLetter: string;
  greenRoomAssignmentId: string;
  judgeScores: JudgeScoreEntry[];
  totalMark: number;
  averageMark: number;
  rank?: number;
  status: JudgeScoreStatus;
  remarks?: string;
  enteredBy: string;
  enteredAt: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: 'Inauguration' | 'Performances' | 'Literary' | 'Exhibition' | 'Crowd & Life' | 'Competitions' | 'Awarding' | 'Campus';
  imageUrl: string;
  caption: string;
  photographer?: string;
  date: string;
  isApproved?: boolean;
  isFeatured?: boolean;
  createdAt?: number;
}

export interface VideoHighlight {
  id: string;
  title: string;
  event: string;
  performer: string;
  duration: string;
  views: string;
  thumbnailUrl: string;
  videoUrl: string;
  stageName: string;
  createdAt?: number;
}

export interface DragBlock {
  id: string;
  title: string;
  type: 'hero' | 'about' | 'announcements' | 'live_stages' | 'results' | 'sponsors' | 'schedule' | 'gallery' | 'photo_hub' | 'highlights' | 'custom';
  enabled: boolean;
  order: number;
  contentSnippet?: string;
}

export interface CMSSettings {
  aboutTitle: string;
  aboutSubtitle: string;
  aboutDescription: string;
  aboutBadge?: string;
  aboutMainHeading?: string;
  aboutImage?: string;
  aboutImageBadge?: string;
  aboutImageTitle?: string;
  aboutImageSubtitle?: string;
  aboutImageLocation?: string;
  aboutImageFooter?: string;
  themeTitle: string;
  themeDescription: string;
  themeButtonText?: string;
  conceptModalBadge?: string;
  conceptModalTitle?: string;
  conceptModalSubtitle?: string;
  conceptModalDescription?: string;
  conceptModalFooter?: string;
  footerText?: string;
  footerLogo?: string;
  footerLogoTitle?: string;
  footerLogoSubtitle?: string;
  footerLogoBadge?: string;
  footerDescription?: string;
  footerLocation?: string;
  footerEmail?: string;
  footerPhone?: string;
  footerInstagram?: string;
  footerYoutube?: string;
  footerFacebook?: string;
  headerLogo?: string;
  headerLogoTitle?: string;
  headerLogoSubtitle?: string;
  heroLogo?: string;
  heroLogoTitle?: string;
  heroLogoSubtitle?: string;
  heroLogoBadge?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroInstitutionLeft?: string;
  heroInstitutionRight?: string;
  heroDate?: string;
  heroLocation?: string;
  heroDesktopLoopEnabled?: boolean;
  heroDesktopLoopInterval?: number;
  heroDesktopImages?: string[];
  heroMobileLoopEnabled?: boolean;
  heroMobileLoopInterval?: number;
  heroMobileImages?: string[];
}

export interface HeroMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
  title: string;
  caption?: string;
  order: number;
}
