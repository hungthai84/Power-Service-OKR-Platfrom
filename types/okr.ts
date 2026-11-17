export type Lang = 'vi' | 'ko';
export type ThemeMode = 'system' | 'light' | 'dark';

export type UserRole = 'ADMIN' | 'OKR_ADMIN' | 'EXECUTIVE' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export type AccountStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'INACTIVE';

export type OkrStatus = 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'COMPLETED' | 'NOT_STARTED' | 'PAUSED';
export type TaskStatus = 'BACKLOG' | 'TO_DO' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'DONE';
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
export type MetricType = 'NUMBER' | 'PERCENTAGE' | 'CURRENCY' | 'BOOLEAN' | 'MILESTONE' | 'RANGE' | 'MANUAL';
export type DirectionType = 'INCREASE' | 'DECREASE' | 'MAINTAIN';

export interface OkrUser {
  userId: string;
  googleSub: string;
  email: string;
  emailVerified: boolean;
  displayNameVi: string;
  displayNameKo: string;
  avatarUrl?: string;
  employeeCode: string;
  jobTitleVi: string;
  jobTitleKo: string;
  startDate?: string;
  departmentId: string;
  teamId: string;
  managerId: string;
  role: UserRole;
  accountStatus: AccountStatus;
  /** Legacy compatibility alias kept in sync with accountStatus */
  status?: string;
  requestedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface ApprovalLog {
  approvalId: string;
  userId: string;
  action: 'APPROVE' | 'REJECT' | 'SAVE_DRAFT' | 'SUSPEND' | 'REACTIVATE' | 'ROLE_CHANGE' | 'BOOTSTRAP_ADMIN';
  previousStatus: string;
  newStatus: string;
  departmentId: string;
  teamId: string;
  managerId: string;
  assignedRole: UserRole;
  approvedBy: string;
  reason: string;
  createdAt: string;
}

export interface OrganizationHistory {
  historyId: string;
  userId: string;
  previousDepartmentId: string;
  newDepartmentId: string;
  previousTeamId: string;
  newTeamId: string;
  previousManagerId: string;
  newManagerId: string;
  previousJobTitle: string;
  newJobTitle: string;
  changedBy: string;
  effectiveDate: string;
  reason: string;
  createdAt: string;
}

export interface Department {
  departmentId: string;
  parentDepartmentId: string;
  nameVi: string;
  nameKo: string;
  managerId: string;
  division: string;
  level: string;
  sortOrder: number;
  descriptionVi: string;
  descriptionKo: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Team {
  teamId: string;
  departmentId: string;
  parentTeamId: string;
  nameVi: string;
  nameKo: string;
  managerId: string;
  level: string;
  sortOrder: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Cycle {
  cycleId: string;
  nameVi: string;
  nameKo: string;
  cycleType: string;
  startDate: string;
  endDate: string;
  status: string;
  createdAt?: string;
}

export interface Objective {
  objectiveId: string;
  cycleId: string;
  parentObjectiveId: string;
  level: string;
  titleVi: string;
  titleKo: string;
  descriptionVi: string;
  descriptionKo: string;
  ownerId: string;
  departmentId: string;
  priority: string;
  status: OkrStatus;
  weight: number;
  progress: number;
  confidence: number;
  startDate: string;
  dueDate: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  version: number;
}

export interface KeyResult {
  krId: string;
  objectiveId: string;
  titleVi: string;
  titleKo: string;
  metricType: MetricType;
  direction: DirectionType;
  unit: string;
  baselineValue: number;
  currentValue: number;
  targetValue: number;
  minTargetValue?: string | number;
  maxTargetValue?: string | number;
  weight: number;
  progress: number;
  ownerId: string;
  startDate?: string;
  dueDate?: string;
  status: OkrStatus;
  lastCheckinAt?: string;
  deletedAt?: string;
}

export interface ProjectItem {
  projectId: string;
  objectiveId: string;
  departmentId: string;
  nameVi: string;
  nameKo: string;
  descriptionVi: string;
  descriptionKo: string;
  ownerId: string;
  status: ProjectStatus;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  progress: number;
  budget: number;
  currency: string;
  startDate: string;
  dueDate: string;
  driveLink?: string;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskItem {
  taskId: string;
  projectId: string;
  objectiveId: string;
  krId: string;
  titleVi: string;
  titleKo: string;
  descriptionVi?: string;
  ownerId: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: TaskStatus;
  dueDate: string;
  estimatedHours?: number;
  progress: number;
  driveAttachmentUrl?: string;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CheckIn {
  checkInId: string;
  krId: string;
  objectiveId: string;
  cycleId: string;
  currentValue: number;
  calculatedProgress: number;
  confidenceScore: number;
  status: OkrStatus;
  winsVi: string;
  winsKo: string;
  blockersVi: string;
  nextStepsVi: string;
  evidenceUrl: string;
  ownerId: string;
  createdAt: string;
}

export interface NotificationItem {
  notificationId: string;
  userId: string;
  type: string;
  titleVi: string;
  titleKo: string;
  messageVi: string;
  messageKo: string;
  isRead: boolean;
  createdAt: string;
}

export interface CommentItem {
  commentId: string;
  entityType: string;
  entityId: string;
  userId: string;
  bodyVi: string;
  bodyKo: string;
  createdAt: string;
}

export interface AuditLog {
  logId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  newValue: string;
  timestamp: string;
}

export interface WorkspaceSettings {
  companyName: string;
  checkinFrequency: string;
  onTrackThreshold: number;
  atRiskThreshold: number;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

export interface VerifiedSessionInfo {
  googleSub: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  avatarUrl: string;
}

export interface DatabaseState {
  users: OkrUser[];
  departments: Department[];
  teams: Team[];
  cycles: Cycle[];
  objectives: Objective[];
  keyResults: KeyResult[];
  projects: ProjectItem[];
  tasks: TaskItem[];
  checkins: CheckIn[];
  notifications: NotificationItem[];
  comments: CommentItem[];
  auditLogs: AuditLog[];
  approvalLogs: ApprovalLog[];
  organizationHistory: OrganizationHistory[];
  settings: WorkspaceSettings;
}
