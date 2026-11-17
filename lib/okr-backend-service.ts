import {
  checkDriveSpreadsheetOwnership,
  isConfiguredAdminEmail,
  type SignedSessionPayload,
} from './server-google-auth';
import {
  detectDepartmentParentCycle,
  detectManagerCycle,
  detectTeamParentCycle,
  findUserBySession,
  getAccountStatusForUser,
  getSubordinateIds,
  hasAnyApprovedAdmin,
  isAdminRole,
  validateOrganizationAssignment,
} from './server-rbac';
import { readAllTabs, writeStateToSheet } from './server-sheets-repo';
import type {
  AccountStatus,
  ApprovalLog,
  AuditLog,
  DatabaseState,
  Department,
  OkrUser,
  OrganizationHistory,
  Team,
  UserRole,
  VerifiedSessionInfo,
} from '@/types/okr';

export class ServiceError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function appendAuditLog(
  db: DatabaseState,
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  newValue: string
): AuditLog[] {
  return [
    {
      logId: makeId('LOG'),
      userId,
      action,
      entityType,
      entityId,
      newValue,
      timestamp: nowIso(),
    },
    ...(db.auditLogs || []),
  ];
}

export async function getAccountStatus(
  spreadsheetId: string,
  accessToken: string,
  session: VerifiedSessionInfo
): Promise<{
  accountStatus: AccountStatus | 'UNREGISTERED';
  user: OkrUser | null;
  canOwnerBootstrap: boolean;
}> {
  const { data } = await readAllTabs(spreadsheetId, accessToken);
  const existing = findUserBySession(data.users, session.googleSub, session.email);
  const noAdminYet = !hasAnyApprovedAdmin(data.users);
  const isOwner = noAdminYet
    ? await checkDriveSpreadsheetOwnership(spreadsheetId, accessToken, session.email)
    : false;
  return {
    accountStatus: existing ? existing.accountStatus : 'UNREGISTERED',
    user: existing || null,
    canOwnerBootstrap: noAdminYet && (isOwner || isConfiguredAdminEmail(session.email)),
  };
}

export async function createPendingUser(
  spreadsheetId: string,
  accessToken: string,
  session: VerifiedSessionInfo
): Promise<{ user: OkrUser; db: DatabaseState }> {
  const { data } = await readAllTabs(spreadsheetId, accessToken);
  const existing = findUserBySession(data.users, session.googleSub, session.email);
  if (existing) {
    return { user: existing, db: data };
  }

  const ts = nowIso();
  const isEnvAdmin = isConfiguredAdminEmail(session.email);
  const newUser: OkrUser = {
    userId: makeId('USR'),
    googleSub: session.googleSub,
    email: session.email,
    emailVerified: session.emailVerified,
    displayNameVi: session.fullName,
    displayNameKo: session.fullName,
    avatarUrl: session.avatarUrl,
    employeeCode: '',
    jobTitleVi: isEnvAdmin ? 'Quản trị viên Hệ thống' : '',
    jobTitleKo: isEnvAdmin ? '시스템 관리자' : '',
    startDate: ts.slice(0, 10),
    departmentId: data.departments[0]?.departmentId || '',
    teamId: '',
    managerId: '',
    role: isEnvAdmin ? 'ADMIN' : 'MEMBER',
    accountStatus: isEnvAdmin ? 'APPROVED' : 'PENDING',
    status: isEnvAdmin ? 'APPROVED' : 'PENDING',
    requestedAt: ts,
    approvedAt: isEnvAdmin ? ts : '',
    approvedBy: isEnvAdmin ? 'SYSTEM_ENV_CONFIG' : '',
    rejectedAt: '',
    rejectedBy: '',
    rejectionReason: '',
    lastLoginAt: ts,
    createdAt: ts,
    updatedAt: ts,
    version: 1,
  };

  const approvalLogs: ApprovalLog[] = isEnvAdmin
    ? [
        {
          approvalId: makeId('APR'),
          userId: newUser.userId,
          action: 'BOOTSTRAP_ADMIN',
          previousStatus: 'UNREGISTERED',
          newStatus: 'APPROVED',
          departmentId: newUser.departmentId,
          teamId: '',
          managerId: '',
          assignedRole: 'ADMIN',
          approvedBy: 'SYSTEM_ENV_CONFIG',
          reason: 'Initialized via configured ADMIN_BOOTSTRAP_EMAIL',
          createdAt: ts,
        },
        ...(data.approvalLogs || []),
      ]
    : data.approvalLogs || [];

  const nextDb: DatabaseState = {
    ...data,
    users: [...data.users, newUser],
    approvalLogs,
    auditLogs: appendAuditLog(
      data,
      newUser.userId,
      isEnvAdmin ? 'ADMIN_BOOTSTRAP_ENV' : 'USER_REGISTERED_PENDING',
      'USER',
      newUser.userId,
      `${newUser.email} (${newUser.accountStatus})`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { user: newUser, db: nextDb };
}

export async function signInWithGoogleToWorkspace(
  spreadsheetId: string,
  accessToken: string,
  session: VerifiedSessionInfo
): Promise<{
  user: OkrUser;
  accountStatus: AccountStatus;
  canOwnerBootstrap: boolean;
  pendingCount: number;
}> {
  const { data } = await readAllTabs(spreadsheetId, accessToken);
  const existing = findUserBySession(data.users, session.googleSub, session.email);
  const ts = nowIso();

  if (!existing) {
    const created = await createPendingUser(spreadsheetId, accessToken, session);
    const noAdminYet = !hasAnyApprovedAdmin(created.db.users);
    const isOwner = noAdminYet
      ? await checkDriveSpreadsheetOwnership(spreadsheetId, accessToken, session.email)
      : false;
    return {
      user: created.user,
      accountStatus: created.user.accountStatus,
      canOwnerBootstrap: noAdminYet && (isOwner || isConfiguredAdminEmail(session.email)),
      pendingCount:
        created.user.role === 'ADMIN' && created.user.accountStatus === 'APPROVED'
          ? created.db.users.filter((u) => u.accountStatus === 'PENDING').length
          : 0,
    };
  }

  // Case 4, 5, 6 & 3: Existing user — bind googleSub if missing, update lastLoginAt & verified avatar, NEVER reset REJECTED/SUSPENDED/INACTIVE to PENDING
  const updatedUser: OkrUser = {
    ...existing,
    googleSub: existing.googleSub || session.googleSub,
    emailVerified: session.emailVerified,
    avatarUrl: session.avatarUrl || existing.avatarUrl || '',
    lastLoginAt: ts,
    updatedAt: ts,
  };

  const nextUsers = data.users.map((u) => (u.userId === existing.userId ? updatedUser : u));
  const nextDb: DatabaseState = {
    ...data,
    users: nextUsers,
  };

  // Persist login timestamp only if user is APPROVED or first sub binding (avoid extra noisy writes for rejected/suspended)
  if (
    existing.googleSub !== updatedUser.googleSub ||
    existing.accountStatus === 'APPROVED'
  ) {
    await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  }

  const noAdminYet = !hasAnyApprovedAdmin(nextUsers);
  const isOwner = noAdminYet
    ? await checkDriveSpreadsheetOwnership(spreadsheetId, accessToken, session.email)
    : false;

  return {
    user: updatedUser,
    accountStatus: updatedUser.accountStatus,
    canOwnerBootstrap: noAdminYet && (isOwner || isConfiguredAdminEmail(session.email)),
    pendingCount:
      updatedUser.role === 'ADMIN' && updatedUser.accountStatus === 'APPROVED'
        ? nextUsers.filter((u) => u.accountStatus === 'PENDING').length
        : 0,
  };
}

export async function getCurrentUser(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload
): Promise<{
  user: OkrUser | null;
  accountStatus: AccountStatus | 'UNREGISTERED';
  canOwnerBootstrap: boolean;
  pendingCount: number;
}> {
  const { data } = await readAllTabs(spreadsheetId, accessToken);
  const user = findUserBySession(data.users, session.googleSub, session.email) || null;
  const status = getAccountStatusForUser(data.users, session.googleSub, session.email);
  const noAdminYet = !hasAnyApprovedAdmin(data.users);
  const isOwner = noAdminYet
    ? await checkDriveSpreadsheetOwnership(spreadsheetId, accessToken, session.email)
    : false;
  return {
    user,
    accountStatus: status,
    canOwnerBootstrap: noAdminYet && (isOwner || isConfiguredAdminEmail(session.email)),
    pendingCount:
      user && user.role === 'ADMIN' && user.accountStatus === 'APPROVED'
        ? data.users.filter((u) => u.accountStatus === 'PENDING').length
        : 0,
  };
}

/**
 * Explicit Owner Bootstrap Admin flow (Section B5):
 * Only allowed when there are ZERO approved ADMINs in USERS AND caller is verified Drive owner or configured env admin.
 */
export async function bootstrapInitialAdmin(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload
): Promise<OkrUser> {
  const { data } = await readAllTabs(spreadsheetId, accessToken);
  if (hasAnyApprovedAdmin(data.users)) {
    throw new ServiceError(
      'Hệ thống đã có Quản trị viên (ADMIN). Không thể tự khởi tạo quyền ADMIN.',
      403,
      'ADMIN_ALREADY_EXISTS'
    );
  }

  const isOwner = await checkDriveSpreadsheetOwnership(spreadsheetId, accessToken, session.email);
  const isEnvAdmin = isConfiguredAdminEmail(session.email);
  if (!isOwner && !isEnvAdmin) {
    throw new ServiceError(
      'Chỉ chủ sở hữu Google Drive của bảng tính hoặc Email Admin cấu hình mới được khởi tạo Quản trị viên đầu tiên.',
      403,
      'NOT_WORKSPACE_OWNER'
    );
  }

  const existing = findUserBySession(data.users, session.googleSub, session.email);
  if (existing && existing.accountStatus === 'REJECTED') {
    throw new ServiceError('Tài khoản đã bị từ chối không thể tự kích hoạt.', 403, 'ACCOUNT_REJECTED');
  }

  const ts = nowIso();
  const targetDeptId = existing?.departmentId || data.departments[0]?.departmentId || '';

  const adminUser: OkrUser = existing
    ? {
        ...existing,
        googleSub: session.googleSub,
        emailVerified: session.emailVerified,
        role: 'ADMIN',
        accountStatus: 'APPROVED',
        status: 'APPROVED',
        departmentId: targetDeptId,
        employeeCode: existing.employeeCode || 'EMP-001',
        jobTitleVi: existing.jobTitleVi || 'Quản trị viên Hệ thống (Owner)',
        jobTitleKo: existing.jobTitleKo || '시스템 관리자 (소유자)',
        approvedAt: ts,
        approvedBy: 'OWNER_BOOTSTRAP',
        updatedAt: ts,
        version: (existing.version || 1) + 1,
      }
    : {
        userId: makeId('USR'),
        googleSub: session.googleSub,
        email: session.email,
        emailVerified: session.emailVerified,
        displayNameVi: session.fullName,
        displayNameKo: session.fullName,
        avatarUrl: session.avatarUrl,
        employeeCode: 'EMP-001',
        jobTitleVi: 'Quản trị viên Hệ thống (Owner)',
        jobTitleKo: '시스템 관리자 (소유자)',
        startDate: ts.slice(0, 10),
        departmentId: targetDeptId,
        teamId: '',
        managerId: '',
        role: 'ADMIN',
        accountStatus: 'APPROVED',
        status: 'APPROVED',
        requestedAt: ts,
        approvedAt: ts,
        approvedBy: 'OWNER_BOOTSTRAP',
        rejectedAt: '',
        rejectedBy: '',
        rejectionReason: '',
        lastLoginAt: ts,
        createdAt: ts,
        updatedAt: ts,
        version: 1,
      };

  const nextUsers = existing
    ? data.users.map((u) => (u.userId === existing.userId ? adminUser : u))
    : [...data.users, adminUser];

  const approvalLog: ApprovalLog = {
    approvalId: makeId('APR'),
    userId: adminUser.userId,
    action: 'BOOTSTRAP_ADMIN',
    previousStatus: existing?.accountStatus || 'UNREGISTERED',
    newStatus: 'APPROVED',
    departmentId: adminUser.departmentId,
    teamId: adminUser.teamId,
    managerId: '',
    assignedRole: 'ADMIN',
    approvedBy: adminUser.userId,
    reason: 'Verified Google Drive owner bootstrap initial administrator',
    createdAt: ts,
  };

  const nextDb: DatabaseState = {
    ...data,
    users: nextUsers,
    approvalLogs: [approvalLog, ...(data.approvalLogs || [])],
    auditLogs: appendAuditLog(
      data,
      adminUser.userId,
      'BOOTSTRAP_ADMIN',
      'USER',
      adminUser.userId,
      `Verified Drive owner ${adminUser.email} initialized as ADMIN`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return adminUser;
}

async function loadAndRequireAdmin(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload
): Promise<{ db: DatabaseState; actor: OkrUser }> {
  const { data } = await readAllTabs(spreadsheetId, accessToken);
  const actor = findUserBySession(data.users, session.googleSub, session.email);
  if (!actor || actor.accountStatus !== 'APPROVED') {
    throw new ServiceError('Tài khoản chưa được phê duyệt để thực hiện thao tác.', 403, 'ACCOUNT_NOT_APPROVED');
  }
  if (!isAdminRole(actor.role)) {
    throw new ServiceError('Chỉ Quản trị viên (ADMIN) mới có quyền thực hiện thao tác này.', 403, 'FORBIDDEN_ADMIN_ONLY');
  }
  return { db: data, actor };
}

async function loadAndRequireApproved(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload
): Promise<{ db: DatabaseState; actor: OkrUser }> {
  const { data } = await readAllTabs(spreadsheetId, accessToken);
  const actor = findUserBySession(data.users, session.googleSub, session.email);
  if (!actor || actor.accountStatus !== 'APPROVED') {
    throw new ServiceError(
      `Tài khoản đang ở trạng thái ${actor?.accountStatus || 'UNREGISTERED'}, không thể truy cập nghiệp vụ.`,
      403,
      'ACCOUNT_NOT_APPROVED'
    );
  }
  return { db: data, actor };
}

// ============================================================================
// APPROVAL FUNCTIONS (Section G)
// ============================================================================

export async function getPendingUsers(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload
) {
  const { db } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  return {
    users: db.users,
    pendingUsers: db.users.filter((u) => u.accountStatus === 'PENDING'),
    approvalLogs: db.approvalLogs || [],
    departments: db.departments.filter((d) => d.status !== 'DELETED'),
    teams: (db.teams || []).filter((t) => t.status !== 'DELETED'),
  };
}

export async function getUserApprovalDetails(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  targetUserId: string
) {
  const { db } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const target = db.users.find((u) => u.userId === targetUserId);
  if (!target) {
    throw new ServiceError('Không tìm thấy hồ sơ nhân sự.', 404, 'USER_NOT_FOUND');
  }
  return {
    user: target,
    logs: (db.approvalLogs || []).filter((l) => l.userId === targetUserId),
    orgHistory: (db.organizationHistory || []).filter((h) => h.userId === targetUserId),
  };
}

export interface ApproveUserPayload {
  userId: string;
  displayNameVi: string;
  displayNameKo?: string;
  employeeCode: string;
  jobTitleVi: string;
  jobTitleKo?: string;
  role: UserRole;
  departmentId: string;
  teamId?: string;
  managerId?: string;
  startDate?: string;
  accountStatus?: AccountStatus;
  reason?: string;
}

export async function approveUser(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  input: ApproveUserPayload
): Promise<{ user: OkrUser; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const target = db.users.find((u) => u.userId === input.userId);
  if (!target) {
    throw new ServiceError('Không tìm thấy tài khoản cần phê duyệt.', 404, 'USER_NOT_FOUND');
  }

  if (
    !input.displayNameVi?.trim() ||
    !input.employeeCode?.trim() ||
    !input.jobTitleVi?.trim() ||
    !input.departmentId?.trim() ||
    !input.role
  ) {
    throw new ServiceError(
      'Vui lòng điền đầy đủ thông tin bắt buộc: Họ tên, Mã nhân viên, Chức danh, Vai trò và Phòng ban.',
      400,
      'MISSING_REQUIRED_FIELDS'
    );
  }

  const integrityError = validateOrganizationAssignment(db, {
    userId: target.userId,
    departmentId: input.departmentId,
    teamId: input.teamId || '',
    managerId: input.managerId || '',
    role: input.role,
  });
  if (integrityError) {
    throw new ServiceError(integrityError, 400, 'ORG_INTEGRITY_ERROR');
  }

  const ts = nowIso();
  const prevStatus = target.accountStatus;
  const updatedUser: OkrUser = {
    ...target,
    displayNameVi: input.displayNameVi.trim(),
    displayNameKo: (input.displayNameKo || input.displayNameVi).trim(),
    employeeCode: input.employeeCode.trim(),
    jobTitleVi: input.jobTitleVi.trim(),
    jobTitleKo: (input.jobTitleKo || input.jobTitleVi).trim(),
    startDate: input.startDate || target.startDate || ts.slice(0, 10),
    departmentId: input.departmentId,
    teamId: input.teamId || '',
    managerId: input.managerId || '',
    role: input.role,
    accountStatus: 'APPROVED',
    status: 'APPROVED',
    approvedAt: ts,
    approvedBy: actor.userId,
    rejectionReason: '',
    updatedAt: ts,
    version: (target.version || 1) + 1,
  };

  const approvalLog: ApprovalLog = {
    approvalId: makeId('APR'),
    userId: target.userId,
    action: 'APPROVE',
    previousStatus: prevStatus,
    newStatus: 'APPROVED',
    departmentId: updatedUser.departmentId,
    teamId: updatedUser.teamId,
    managerId: updatedUser.managerId,
    assignedRole: updatedUser.role,
    approvedBy: actor.userId,
    reason: input.reason || 'Approved & assigned organization scope',
    createdAt: ts,
  };

  const orgChanged =
    target.departmentId !== updatedUser.departmentId ||
    target.teamId !== updatedUser.teamId ||
    target.managerId !== updatedUser.managerId ||
    target.jobTitleVi !== updatedUser.jobTitleVi;

  const orgHistory: OrganizationHistory[] = orgChanged
    ? [
        {
          historyId: makeId('ORG'),
          userId: target.userId,
          previousDepartmentId: target.departmentId || '',
          newDepartmentId: updatedUser.departmentId,
          previousTeamId: target.teamId || '',
          newTeamId: updatedUser.teamId,
          previousManagerId: target.managerId || '',
          newManagerId: updatedUser.managerId,
          previousJobTitle: target.jobTitleVi || '',
          newJobTitle: updatedUser.jobTitleVi,
          changedBy: actor.userId,
          effectiveDate: updatedUser.startDate || ts.slice(0, 10),
          reason: input.reason || 'Initial approval & assignment',
          createdAt: ts,
        },
        ...(db.organizationHistory || []),
      ]
    : db.organizationHistory || [];

  const notif = {
    notificationId: makeId('NOTIF'),
    userId: target.userId,
    type: 'APPROVAL',
    titleVi: 'Tài khoản FlowOKR đã được phê duyệt',
    titleKo: 'FlowOKR 계정이 승인되었습니다',
    messageVi: `Chào mừng ${updatedUser.displayNameVi}! Tài khoản của bạn đã được kích hoạt với vai trò ${updatedUser.role}.`,
    messageKo: `${updatedUser.displayNameKo}님 환영합니다! ${updatedUser.role} 역할로 계정이 활성화되었습니다.`,
    isRead: false,
    createdAt: ts,
  };

  const nextDb: DatabaseState = {
    ...db,
    users: db.users.map((u) => (u.userId === target.userId ? updatedUser : u)),
    approvalLogs: [approvalLog, ...(db.approvalLogs || [])],
    organizationHistory: orgHistory,
    notifications: [notif, ...(db.notifications || [])],
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'APPROVE_USER',
      'USER',
      target.userId,
      `Approved ${target.email} as ${updatedUser.role} in ${updatedUser.departmentId}`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { user: updatedUser, db: nextDb };
}

export async function saveUserDraft(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  input: ApproveUserPayload
): Promise<{ user: OkrUser; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const target = db.users.find((u) => u.userId === input.userId);
  if (!target) {
    throw new ServiceError('Không tìm thấy tài khoản.', 404, 'USER_NOT_FOUND');
  }

  if (input.departmentId) {
    const integrityError = validateOrganizationAssignment(db, {
      userId: target.userId,
      departmentId: input.departmentId,
      teamId: input.teamId || '',
      managerId: input.managerId || '',
      role: input.role,
    });
    if (integrityError) {
      throw new ServiceError(integrityError, 400, 'ORG_INTEGRITY_ERROR');
    }
  }

  const ts = nowIso();
  const updatedUser: OkrUser = {
    ...target,
    displayNameVi: input.displayNameVi?.trim() || target.displayNameVi,
    displayNameKo: (input.displayNameKo || input.displayNameVi || target.displayNameKo).trim(),
    employeeCode: input.employeeCode?.trim() ?? target.employeeCode,
    jobTitleVi: input.jobTitleVi?.trim() ?? target.jobTitleVi,
    jobTitleKo: (input.jobTitleKo || input.jobTitleVi || target.jobTitleKo).trim(),
    startDate: input.startDate ?? target.startDate,
    departmentId: input.departmentId ?? target.departmentId,
    teamId: input.teamId ?? target.teamId,
    managerId: input.managerId ?? target.managerId,
    role: input.role || target.role,
    updatedAt: ts,
    version: (target.version || 1) + 1,
  };

  const approvalLog: ApprovalLog = {
    approvalId: makeId('APR'),
    userId: target.userId,
    action: 'SAVE_DRAFT',
    previousStatus: target.accountStatus,
    newStatus: target.accountStatus,
    departmentId: updatedUser.departmentId,
    teamId: updatedUser.teamId,
    managerId: updatedUser.managerId,
    assignedRole: updatedUser.role,
    approvedBy: actor.userId,
    reason: input.reason || 'Saved draft configuration',
    createdAt: ts,
  };

  const nextDb: DatabaseState = {
    ...db,
    users: db.users.map((u) => (u.userId === target.userId ? updatedUser : u)),
    approvalLogs: [approvalLog, ...(db.approvalLogs || [])],
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'SAVE_USER_DRAFT',
      'USER',
      target.userId,
      `Saved draft config for ${target.email}`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { user: updatedUser, db: nextDb };
}

export async function rejectUser(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  userId: string,
  reason: string
): Promise<{ user: OkrUser; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  if (!reason || !reason.trim()) {
    throw new ServiceError('Vui lòng nhập lý do từ chối tài khoản.', 400, 'REASON_REQUIRED');
  }
  const target = db.users.find((u) => u.userId === userId);
  if (!target) throw new ServiceError('Không tìm thấy tài khoản.', 404, 'USER_NOT_FOUND');
  if (target.userId === actor.userId) {
    throw new ServiceError('Admin không thể tự từ chối tài khoản của chính mình.', 400, 'SELF_ACTION_BLOCKED');
  }

  const ts = nowIso();
  const prevStatus = target.accountStatus;
  const updatedUser: OkrUser = {
    ...target,
    accountStatus: 'REJECTED',
    status: 'REJECTED',
    rejectedAt: ts,
    rejectedBy: actor.userId,
    rejectionReason: reason.trim(),
    updatedAt: ts,
    version: (target.version || 1) + 1,
  };

  const approvalLog: ApprovalLog = {
    approvalId: makeId('APR'),
    userId: target.userId,
    action: 'REJECT',
    previousStatus: prevStatus,
    newStatus: 'REJECTED',
    departmentId: target.departmentId,
    teamId: target.teamId,
    managerId: target.managerId,
    assignedRole: target.role,
    approvedBy: actor.userId,
    reason: reason.trim(),
    createdAt: ts,
  };

  const nextDb: DatabaseState = {
    ...db,
    users: db.users.map((u) => (u.userId === target.userId ? updatedUser : u)),
    approvalLogs: [approvalLog, ...(db.approvalLogs || [])],
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'REJECT_USER',
      'USER',
      target.userId,
      `Rejected ${target.email}: ${reason.trim()}`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { user: updatedUser, db: nextDb };
}

export async function suspendUser(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  userId: string,
  reason: string,
  nextStatus: 'SUSPENDED' | 'INACTIVE' = 'SUSPENDED'
): Promise<{ user: OkrUser; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const target = db.users.find((u) => u.userId === userId);
  if (!target) throw new ServiceError('Không tìm thấy tài khoản.', 404, 'USER_NOT_FOUND');
  if (target.userId === actor.userId) {
    throw new ServiceError('Không thể tự khóa tài khoản Admin đang đăng nhập.', 400, 'SELF_ACTION_BLOCKED');
  }

  const ts = nowIso();
  const prevStatus = target.accountStatus;
  const updatedUser: OkrUser = {
    ...target,
    accountStatus: nextStatus,
    status: nextStatus,
    rejectionReason: reason?.trim() || target.rejectionReason || '',
    updatedAt: ts,
    version: (target.version || 1) + 1,
  };

  const approvalLog: ApprovalLog = {
    approvalId: makeId('APR'),
    userId: target.userId,
    action: 'SUSPEND',
    previousStatus: prevStatus,
    newStatus: nextStatus,
    departmentId: target.departmentId,
    teamId: target.teamId,
    managerId: target.managerId,
    assignedRole: target.role,
    approvedBy: actor.userId,
    reason: reason?.trim() || `Changed status to ${nextStatus}`,
    createdAt: ts,
  };

  const nextDb: DatabaseState = {
    ...db,
    users: db.users.map((u) => (u.userId === target.userId ? updatedUser : u)),
    approvalLogs: [approvalLog, ...(db.approvalLogs || [])],
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'SUSPEND_USER',
      'USER',
      target.userId,
      `${nextStatus}: ${target.email} (${reason || ''})`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { user: updatedUser, db: nextDb };
}

export async function reactivateUser(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  userId: string,
  reason?: string
): Promise<{ user: OkrUser; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const target = db.users.find((u) => u.userId === userId);
  if (!target) throw new ServiceError('Không tìm thấy tài khoản.', 404, 'USER_NOT_FOUND');

  if (!target.departmentId) {
    throw new ServiceError('Vui lòng gán Phòng ban trước khi kích hoạt lại tài khoản.', 400, 'MISSING_DEPT');
  }

  const ts = nowIso();
  const prevStatus = target.accountStatus;
  const updatedUser: OkrUser = {
    ...target,
    accountStatus: 'APPROVED',
    status: 'APPROVED',
    approvedAt: ts,
    approvedBy: actor.userId,
    rejectionReason: '',
    updatedAt: ts,
    version: (target.version || 1) + 1,
  };

  const approvalLog: ApprovalLog = {
    approvalId: makeId('APR'),
    userId: target.userId,
    action: 'REACTIVATE',
    previousStatus: prevStatus,
    newStatus: 'APPROVED',
    departmentId: target.departmentId,
    teamId: target.teamId,
    managerId: target.managerId,
    assignedRole: target.role,
    approvedBy: actor.userId,
    reason: reason || 'Reactivated account',
    createdAt: ts,
  };

  const nextDb: DatabaseState = {
    ...db,
    users: db.users.map((u) => (u.userId === target.userId ? updatedUser : u)),
    approvalLogs: [approvalLog, ...(db.approvalLogs || [])],
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'REACTIVATE_USER',
      'USER',
      target.userId,
      `Reactivated ${target.email}`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { user: updatedUser, db: nextDb };
}

export async function updateUserRole(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  userId: string,
  newRole: UserRole,
  reason?: string
): Promise<{ user: OkrUser; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const target = db.users.find((u) => u.userId === userId);
  if (!target) throw new ServiceError('Không tìm thấy nhân sự.', 404, 'USER_NOT_FOUND');

  // Ensure we don't accidentally remove the very last active ADMIN
  if (target.role === 'ADMIN' && newRole !== 'ADMIN') {
    const otherAdmins = db.users.filter(
      (u) => u.userId !== target.userId && u.role === 'ADMIN' && u.accountStatus === 'APPROVED'
    );
    if (otherAdmins.length === 0) {
      throw new ServiceError('Không thể thu hồi quyền ADMIN cuối cùng của hệ thống.', 400, 'LAST_ADMIN');
    }
  }

  const ts = nowIso();
  const prevRole = target.role;
  const updatedUser: OkrUser = {
    ...target,
    role: newRole,
    updatedAt: ts,
    version: (target.version || 1) + 1,
  };

  const approvalLog: ApprovalLog = {
    approvalId: makeId('APR'),
    userId: target.userId,
    action: 'ROLE_CHANGE',
    previousStatus: target.accountStatus,
    newStatus: target.accountStatus,
    departmentId: target.departmentId,
    teamId: target.teamId,
    managerId: target.managerId,
    assignedRole: newRole,
    approvedBy: actor.userId,
    reason: reason || `Role changed from ${prevRole} to ${newRole}`,
    createdAt: ts,
  };

  const nextDb: DatabaseState = {
    ...db,
    users: db.users.map((u) => (u.userId === target.userId ? updatedUser : u)),
    approvalLogs: [approvalLog, ...(db.approvalLogs || [])],
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'UPDATE_USER_ROLE',
      'USER',
      target.userId,
      `${target.email}: ${prevRole} → ${newRole}`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { user: updatedUser, db: nextDb };
}

export async function updateUserOrganization(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  input: {
    userId: string;
    departmentId: string;
    teamId?: string;
    managerId?: string;
    jobTitleVi?: string;
    jobTitleKo?: string;
    role?: UserRole;
    effectiveDate?: string;
    reason?: string;
  }
): Promise<{ user: OkrUser; db: DatabaseState }> {
  return transferEmployee(spreadsheetId, accessToken, session, input);
}

// ============================================================================
// ORGANIZATION FUNCTIONS (Section D & G)
// ============================================================================

export async function getDepartments(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload
) {
  const { db } = await loadAndRequireApproved(spreadsheetId, accessToken, session);
  return db.departments.filter((d) => d.status !== 'DELETED');
}

export async function createDepartment(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  input: Partial<Department>
): Promise<{ department: Department; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  if (!input.nameVi?.trim()) {
    throw new ServiceError('Tên phòng ban không được để trống.', 400, 'NAME_REQUIRED');
  }
  const ts = nowIso();
  const departmentId = input.departmentId || makeId('DEPT');
  if (input.parentDepartmentId) {
    const cycleErr = detectDepartmentParentCycle(db.departments, departmentId, input.parentDepartmentId);
    if (cycleErr) throw new ServiceError(cycleErr, 400, 'DEPT_CYCLE');
  }

  const newDept: Department = {
    departmentId,
    parentDepartmentId: input.parentDepartmentId || '',
    nameVi: input.nameVi.trim(),
    nameKo: (input.nameKo || input.nameVi).trim(),
    managerId: input.managerId || '',
    division: input.division || '',
    level: input.level || 'DEPARTMENT',
    sortOrder: Number(input.sortOrder || db.departments.length + 1),
    descriptionVi: input.descriptionVi || '',
    descriptionKo: input.descriptionKo || '',
    status: input.status || 'ACTIVE',
    createdAt: ts,
    updatedAt: ts,
  };

  const nextDb: DatabaseState = {
    ...db,
    departments: [...db.departments, newDept],
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'CREATE_DEPARTMENT',
      'DEPARTMENT',
      newDept.departmentId,
      newDept.nameVi
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { department: newDept, db: nextDb };
}

export async function updateDepartment(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  input: Partial<Department> & { departmentId: string }
): Promise<{ department: Department; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const existing = db.departments.find((d) => d.departmentId === input.departmentId);
  if (!existing) throw new ServiceError('Không tìm thấy phòng ban.', 404, 'DEPT_NOT_FOUND');

  if (input.parentDepartmentId) {
    const cycleErr = detectDepartmentParentCycle(
      db.departments,
      existing.departmentId,
      input.parentDepartmentId
    );
    if (cycleErr) throw new ServiceError(cycleErr, 400, 'DEPT_CYCLE');
  }

  if (input.managerId) {
    const mgr = db.users.find((u) => u.userId === input.managerId && u.accountStatus === 'APPROVED');
    if (!mgr) throw new ServiceError('Trưởng phòng được bổ nhiệm phải là nhân sự đã APPROVED.', 400, 'INVALID_MGR');
  }

  const updated: Department = {
    ...existing,
    parentDepartmentId: input.parentDepartmentId ?? existing.parentDepartmentId,
    nameVi: input.nameVi?.trim() || existing.nameVi,
    nameKo: input.nameKo?.trim() || existing.nameKo,
    managerId: input.managerId ?? existing.managerId,
    division: input.division ?? existing.division,
    level: input.level ?? existing.level,
    sortOrder: input.sortOrder !== undefined ? Number(input.sortOrder) : existing.sortOrder,
    descriptionVi: input.descriptionVi ?? existing.descriptionVi,
    descriptionKo: input.descriptionKo ?? existing.descriptionKo,
    status: input.status ?? existing.status,
    updatedAt: nowIso(),
  };

  const nextDb: DatabaseState = {
    ...db,
    departments: db.departments.map((d) => (d.departmentId === existing.departmentId ? updated : d)),
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'UPDATE_DEPARTMENT',
      'DEPARTMENT',
      updated.departmentId,
      `${updated.nameVi} (Manager: ${updated.managerId || 'none'})`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { department: updated, db: nextDb };
}

export async function deleteDepartment(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  departmentId: string
): Promise<{ db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const existing = db.departments.find((d) => d.departmentId === departmentId);
  if (!existing) throw new ServiceError('Không tìm thấy phòng ban.', 404, 'DEPT_NOT_FOUND');

  const activeUsersInDept = db.users.filter(
    (u) => u.departmentId === departmentId && u.accountStatus === 'APPROVED'
  );
  if (activeUsersInDept.length > 0) {
    throw new ServiceError(
      `Phòng ban đang có ${activeUsersInDept.length} nhân sự hoạt động. Vui lòng điều chuyển nhân sự trước khi xóa mềm phòng ban.`,
      400,
      'DEPT_HAS_USERS'
    );
  }

  const updated: Department = {
    ...existing,
    status: 'DELETED',
    updatedAt: nowIso(),
  };

  const nextDb: DatabaseState = {
    ...db,
    departments: db.departments.map((d) => (d.departmentId === departmentId ? updated : d)),
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'DELETE_DEPARTMENT',
      'DEPARTMENT',
      departmentId,
      `Soft deleted ${existing.nameVi}`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { db: nextDb };
}

export async function getTeams(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload
) {
  const { db } = await loadAndRequireApproved(spreadsheetId, accessToken, session);
  return (db.teams || []).filter((t) => t.status !== 'DELETED');
}

export async function createTeam(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  input: Partial<Team>
): Promise<{ team: Team; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  if (!input.nameVi?.trim() || !input.departmentId) {
    throw new ServiceError('Vui lòng nhập Tên nhóm và chọn Phòng ban trực thuộc.', 400, 'MISSING_FIELDS');
  }
  const dept = db.departments.find((d) => d.departmentId === input.departmentId && d.status !== 'DELETED');
  if (!dept) throw new ServiceError('Phòng ban trực thuộc không tồn tại.', 400, 'DEPT_NOT_FOUND');

  const ts = nowIso();
  const teamId = input.teamId || makeId('TEAM');
  if (input.parentTeamId) {
    const cycleErr = detectTeamParentCycle(db.teams || [], teamId, input.parentTeamId);
    if (cycleErr) throw new ServiceError(cycleErr, 400, 'TEAM_CYCLE');
  }

  const newTeam: Team = {
    teamId,
    departmentId: input.departmentId,
    parentTeamId: input.parentTeamId || '',
    nameVi: input.nameVi.trim(),
    nameKo: (input.nameKo || input.nameVi).trim(),
    managerId: input.managerId || '',
    level: input.level || 'TEAM',
    sortOrder: Number(input.sortOrder || (db.teams || []).length + 1),
    status: input.status || 'ACTIVE',
    createdAt: ts,
    updatedAt: ts,
  };

  const nextDb: DatabaseState = {
    ...db,
    teams: [...(db.teams || []), newTeam],
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'CREATE_TEAM',
      'TEAM',
      newTeam.teamId,
      `${newTeam.nameVi} (${newTeam.departmentId})`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { team: newTeam, db: nextDb };
}

export async function updateTeam(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  input: Partial<Team> & { teamId: string }
): Promise<{ team: Team; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const existing = (db.teams || []).find((t) => t.teamId === input.teamId);
  if (!existing) throw new ServiceError('Không tìm thấy nhóm.', 404, 'TEAM_NOT_FOUND');

  const targetDeptId = input.departmentId || existing.departmentId;
  const dept = db.departments.find((d) => d.departmentId === targetDeptId && d.status !== 'DELETED');
  if (!dept) throw new ServiceError('Phòng ban đích không tồn tại.', 400, 'DEPT_NOT_FOUND');

  if (input.parentTeamId) {
    const cycleErr = detectTeamParentCycle(db.teams || [], existing.teamId, input.parentTeamId);
    if (cycleErr) throw new ServiceError(cycleErr, 400, 'TEAM_CYCLE');
  }

  const updated: Team = {
    ...existing,
    departmentId: targetDeptId,
    parentTeamId: input.parentTeamId ?? existing.parentTeamId,
    nameVi: input.nameVi?.trim() || existing.nameVi,
    nameKo: input.nameKo?.trim() || existing.nameKo,
    managerId: input.managerId ?? existing.managerId,
    level: input.level ?? existing.level,
    sortOrder: input.sortOrder !== undefined ? Number(input.sortOrder) : existing.sortOrder,
    status: input.status ?? existing.status,
    updatedAt: nowIso(),
  };

  // If team moved to a different department, keep users in that team aligned or record org history
  const ts = nowIso();
  const movedDept = targetDeptId !== existing.departmentId;
  const addedHistory: OrganizationHistory[] = [];
  const nextUsers = movedDept
    ? db.users.map((u) => {
        if (u.teamId !== existing.teamId) return u;
        addedHistory.push({
          historyId: makeId('ORG'),
          userId: u.userId,
          previousDepartmentId: u.departmentId,
          newDepartmentId: targetDeptId,
          previousTeamId: existing.teamId,
          newTeamId: existing.teamId,
          previousManagerId: u.managerId,
          newManagerId: u.managerId,
          previousJobTitle: u.jobTitleVi,
          newJobTitle: u.jobTitleVi,
          changedBy: actor.userId,
          effectiveDate: ts.slice(0, 10),
          reason: `Team "${updated.nameVi}" transferred to department ${dept.nameVi}`,
          createdAt: ts,
        });
        return { ...u, departmentId: targetDeptId, updatedAt: ts };
      })
    : db.users;

  const nextDb: DatabaseState = {
    ...db,
    teams: (db.teams || []).map((t) => (t.teamId === existing.teamId ? updated : t)),
    users: nextUsers,
    organizationHistory: [...addedHistory, ...(db.organizationHistory || [])],
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'UPDATE_TEAM',
      'TEAM',
      updated.teamId,
      `${updated.nameVi} → Dept: ${targetDeptId}`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { team: updated, db: nextDb };
}

export async function assignManager(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  userId: string,
  managerId: string,
  reason?: string
) {
  const { db } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const target = db.users.find((u) => u.userId === userId);
  if (!target) throw new ServiceError('Không tìm thấy nhân viên.', 404, 'USER_NOT_FOUND');

  return transferEmployee(spreadsheetId, accessToken, session, {
    userId,
    departmentId: target.departmentId,
    teamId: target.teamId,
    managerId,
    reason: reason || 'Updated direct manager',
  });
}

export async function transferEmployee(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  input: {
    userId: string;
    departmentId: string;
    teamId?: string;
    managerId?: string;
    jobTitleVi?: string;
    jobTitleKo?: string;
    role?: UserRole;
    effectiveDate?: string;
    reason?: string;
  }
): Promise<{ user: OkrUser; db: DatabaseState }> {
  const { db, actor } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const target = db.users.find((u) => u.userId === input.userId);
  if (!target) throw new ServiceError('Không tìm thấy nhân viên.', 404, 'USER_NOT_FOUND');

  const nextRole = input.role || target.role;
  const integrityError = validateOrganizationAssignment(db, {
    userId: target.userId,
    departmentId: input.departmentId,
    teamId: input.teamId || '',
    managerId: input.managerId || '',
    role: nextRole,
  });
  if (integrityError) {
    throw new ServiceError(integrityError, 400, 'ORG_INTEGRITY_ERROR');
  }

  const ts = nowIso();
  const updatedUser: OkrUser = {
    ...target,
    departmentId: input.departmentId,
    teamId: input.teamId ?? '',
    managerId: input.managerId ?? '',
    jobTitleVi: input.jobTitleVi?.trim() || target.jobTitleVi,
    jobTitleKo: input.jobTitleKo?.trim() || input.jobTitleVi?.trim() || target.jobTitleKo,
    role: nextRole,
    updatedAt: ts,
    version: (target.version || 1) + 1,
  };

  const historyEntry: OrganizationHistory = {
    historyId: makeId('ORG'),
    userId: target.userId,
    previousDepartmentId: target.departmentId || '',
    newDepartmentId: updatedUser.departmentId,
    previousTeamId: target.teamId || '',
    newTeamId: updatedUser.teamId,
    previousManagerId: target.managerId || '',
    newManagerId: updatedUser.managerId,
    previousJobTitle: target.jobTitleVi || '',
    newJobTitle: updatedUser.jobTitleVi,
    changedBy: actor.userId,
    effectiveDate: input.effectiveDate || ts.slice(0, 10),
    reason: input.reason || 'Organization transfer / reporting line update',
    createdAt: ts,
  };

  // Preserve 100% historical OKRs and Check-ins (never alter/delete past Check-ins or OKRs)
  const nextDb: DatabaseState = {
    ...db,
    users: db.users.map((u) => (u.userId === target.userId ? updatedUser : u)),
    organizationHistory: [historyEntry, ...(db.organizationHistory || [])],
    auditLogs: appendAuditLog(
      db,
      actor.userId,
      'TRANSFER_EMPLOYEE',
      'USER',
      target.userId,
      `${target.email}: Dept ${target.departmentId}→${updatedUser.departmentId}, Mgr ${target.managerId || 'none'}→${updatedUser.managerId || 'none'}`
    ),
  };

  await writeStateToSheet(spreadsheetId, nextDb, accessToken);
  return { user: updatedUser, db: nextDb };
}

export async function updateReportingLine(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  userId: string,
  newManagerId: string,
  reason?: string
) {
  const { db } = await loadAndRequireAdmin(spreadsheetId, accessToken, session);
  const target = db.users.find((u) => u.userId === userId);
  if (!target) throw new ServiceError('Không tìm thấy nhân viên.', 404, 'USER_NOT_FOUND');

  const cycleErr = detectManagerCycle(db.users, userId, newManagerId);
  if (cycleErr) throw new ServiceError(cycleErr, 400, 'MANAGER_CYCLE');

  return transferEmployee(spreadsheetId, accessToken, session, {
    userId,
    departmentId: target.departmentId,
    teamId: target.teamId,
    managerId: newManagerId,
    reason: reason || 'Reporting line updated via Organization Chart',
  });
}

export async function getEmployeeProfile(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  targetUserId: string
) {
  const { db, actor } = await loadAndRequireApproved(spreadsheetId, accessToken, session);
  const target = db.users.find((u) => u.userId === targetUserId);
  if (!target) throw new ServiceError('Không tìm thấy hồ sơ nhân sự.', 404, 'USER_NOT_FOUND');

  // Enforce org read permissions
  const canView =
    actor.role === 'ADMIN' ||
    actor.role === 'OKR_ADMIN' ||
    actor.role === 'EXECUTIVE' ||
    actor.userId === target.userId ||
    target.departmentId === actor.departmentId ||
    getSubordinateIds(db.users, actor.userId).has(target.userId) ||
    actor.managerId === target.userId;

  if (!canView) {
    throw new ServiceError('Bạn không có quyền xem hồ sơ nhân sự này.', 403, 'FORBIDDEN_PROFILE');
  }

  return {
    user: target,
    manager: db.users.find((u) => u.userId === target.managerId) || null,
    directReports: db.users.filter((u) => u.managerId === target.userId && u.accountStatus === 'APPROVED'),
    objectives: db.objectives.filter((o) => !o.deletedAt && o.ownerId === target.userId),
    keyResults: db.keyResults.filter((k) => !k.deletedAt && k.ownerId === target.userId),
    tasks: db.tasks.filter((t) => !t.deletedAt && t.ownerId === target.userId),
    checkins: db.checkins.filter((c) => c.ownerId === target.userId),
  };
}

export async function getManagerHierarchy(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload,
  managerId: string
) {
  const { db } = await loadAndRequireApproved(spreadsheetId, accessToken, session);
  const subs = getSubordinateIds(db.users, managerId);
  return {
    manager: db.users.find((u) => u.userId === managerId) || null,
    directReports: db.users.filter((u) => u.managerId === managerId && u.accountStatus === 'APPROVED'),
    allSubordinates: db.users.filter((u) => subs.has(u.userId) && u.accountStatus === 'APPROVED'),
  };
}

export async function getOrganizationTree(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload
) {
  const { db } = await loadAndRequireApproved(spreadsheetId, accessToken, session);
  return {
    companyName: db.settings.companyName,
    departments: db.departments.filter((d) => d.status !== 'DELETED'),
    teams: (db.teams || []).filter((t) => t.status !== 'DELETED'),
    users: db.users.filter((u) => u.accountStatus === 'APPROVED'),
  };
}

export async function getOrganizationHistory(
  spreadsheetId: string,
  accessToken: string,
  session: SignedSessionPayload
) {
  const { db } = await loadAndRequireApproved(spreadsheetId, accessToken, session);
  return db.organizationHistory || [];
}
