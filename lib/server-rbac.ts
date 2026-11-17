import type {
  AccountStatus,
  DatabaseState,
  OkrUser,
  UserRole,
} from '@/types/okr';

export function findUserBySession(
  users: OkrUser[],
  googleSub: string,
  email: string
): OkrUser | undefined {
  const bySub = users.find((u) => u.googleSub && u.googleSub === googleSub);
  if (bySub) return bySub;
  const normalizedEmail = email.trim().toLowerCase();
  return users.find((u) => u.email.trim().toLowerCase() === normalizedEmail);
}

export function getAccountStatusForUser(
  users: OkrUser[],
  googleSub: string,
  email: string
): AccountStatus | 'UNREGISTERED' {
  const found = findUserBySession(users, googleSub, email);
  return found ? found.accountStatus : 'UNREGISTERED';
}

export function isAdminRole(role?: UserRole): boolean {
  return role === 'ADMIN';
}

export function isOkrAdminOrHigher(role?: UserRole): boolean {
  return role === 'ADMIN' || role === 'OKR_ADMIN';
}

export function hasAnyApprovedAdmin(users: OkrUser[]): boolean {
  return users.some((u) => u.accountStatus === 'APPROVED' && u.role === 'ADMIN');
}

/**
 * Checks whether `candidateManagerId` creates a cycle or self-management loop for `employeeUserId`.
 */
export function detectManagerCycle(
  users: OkrUser[],
  employeeUserId: string,
  candidateManagerId: string
): string | null {
  if (!candidateManagerId) return null;
  if (candidateManagerId === employeeUserId) {
    return 'Nhân viên không thể tự làm người quản lý trực tiếp của chính mình.';
  }
  const visited = new Set<string>([employeeUserId]);
  let cursor: string | undefined = candidateManagerId;
  let guard = 0;
  while (cursor && guard < 100) {
    if (visited.has(cursor)) {
      return 'Phát hiện vòng lặp quan hệ quản lý trực tiếp (Cycle detected). Không thể gán cấp quản lý tạo thành vòng lặp.';
    }
    visited.add(cursor);
    const mgr = users.find((u) => u.userId === cursor);
    cursor = mgr?.managerId;
    guard++;
  }
  return null;
}

export function detectDepartmentParentCycle(
  departments: DatabaseState['departments'],
  departmentId: string,
  candidateParentId: string
): string | null {
  if (!candidateParentId) return null;
  if (candidateParentId === departmentId) {
    return 'Phòng ban không thể tự làm đơn vị cha của chính mình.';
  }
  const visited = new Set<string>([departmentId]);
  let cursor: string | undefined = candidateParentId;
  let guard = 0;
  while (cursor && guard < 100) {
    if (visited.has(cursor)) {
      return 'Phát hiện vòng lặp phân cấp phòng ban. Vui lòng chọn đơn vị cha hợp lệ.';
    }
    visited.add(cursor);
    const dept = departments.find((d) => d.departmentId === cursor);
    cursor = dept?.parentDepartmentId;
    guard++;
  }
  return null;
}

export function detectTeamParentCycle(
  teams: DatabaseState['teams'],
  teamId: string,
  candidateParentId: string
): string | null {
  if (!candidateParentId) return null;
  if (candidateParentId === teamId) {
    return 'Nhóm không thể tự làm nhóm cha của chính mình.';
  }
  const visited = new Set<string>([teamId]);
  let cursor: string | undefined = candidateParentId;
  let guard = 0;
  while (cursor && guard < 100) {
    if (visited.has(cursor)) {
      return 'Phát hiện vòng lặp phân cấp nhóm. Vui lòng chọn nhóm cha hợp lệ.';
    }
    visited.add(cursor);
    const team = teams.find((t) => t.teamId === cursor);
    cursor = team?.parentTeamId;
    guard++;
  }
  return null;
}

/**
 * Validates referential integrity & reporting rules before saving organization assignments.
 */
export function validateOrganizationAssignment(
  db: DatabaseState,
  params: {
    userId: string;
    departmentId: string;
    teamId?: string;
    managerId?: string;
    role?: UserRole;
  }
): string | null {
  const activeDepts = db.departments.filter((d) => d.status !== 'DELETED');
  const dept = activeDepts.find((d) => d.departmentId === params.departmentId);
  if (!dept) {
    return 'Phòng ban được chọn không tồn tại hoặc đã ngừng hoạt động.';
  }

  if (params.teamId) {
    const team = (db.teams || []).find(
      (t) => t.teamId === params.teamId && t.status !== 'DELETED'
    );
    if (!team) {
      return 'Nhóm được chọn không tồn tại hoặc đã ngừng hoạt động.';
    }
    if (team.departmentId !== params.departmentId) {
      return 'Nhóm được chọn không thuộc phòng ban đã chỉ định.';
    }
  }

  if (params.managerId) {
    const manager = db.users.find((u) => u.userId === params.managerId);
    if (!manager) {
      return 'Người quản lý trực tiếp không tồn tại trong hệ thống.';
    }
    if (manager.accountStatus !== 'APPROVED') {
      return 'Người quản lý trực tiếp phải là tài khoản đã được phê duyệt (APPROVED).';
    }
    const allowedManagerRoles: UserRole[] = ['ADMIN', 'OKR_ADMIN', 'EXECUTIVE', 'MANAGER'];
    if (!allowedManagerRoles.includes(manager.role)) {
      return 'Nhân sự được chọn chưa có vai trò quản lý (MANAGER / EXECUTIVE / ADMIN).';
    }
    const cycleErr = detectManagerCycle(db.users, params.userId, params.managerId);
    if (cycleErr) return cycleErr;

    // Cross-department manager rule: allow if manager is EXECUTIVE/ADMIN/OKR_ADMIN, or same department, or parent department
    const isTopExec = manager.role === 'ADMIN' || manager.role === 'EXECUTIVE' || manager.role === 'OKR_ADMIN';
    const sameDept = manager.departmentId === params.departmentId;
    const isParentDeptManager =
      dept.parentDepartmentId && manager.departmentId === dept.parentDepartmentId;
    if (!isTopExec && !sameDept && !isParentDeptManager) {
      return 'Không thể gán quản lý trực thuộc một phòng ban không liên quan (chỉ áp dụng Quản lý cùng phòng ban, phòng ban cấp trên hoặc Ban điều hành).';
    }
  }

  return null;
}

/**
 * Returns direct and recursive subordinate user IDs for a manager.
 */
export function getSubordinateIds(users: OkrUser[], managerId: string): Set<string> {
  const subs = new Set<string>();
  const queue = [managerId];
  let guard = 0;
  while (queue.length > 0 && guard < 500) {
    const curr = queue.shift()!;
    for (const u of users) {
      if (u.managerId === curr && !subs.has(u.userId) && u.userId !== managerId) {
        subs.add(u.userId);
        queue.push(u.userId);
      }
    }
    guard++;
  }
  return subs;
}

/**
 * Enforces backend data access scope based on Role, Department, Team, Manager Relationship, and Ownership.
 */
export function filterDatabaseByPermissions(
  db: DatabaseState,
  currentUser: OkrUser
): DatabaseState {
  if (
    currentUser.role === 'ADMIN' ||
    currentUser.role === 'OKR_ADMIN' ||
    currentUser.role === 'EXECUTIVE'
  ) {
    // EXECUTIVE can see org data & OKRs, but approvalLogs are masked unless ADMIN
    return {
      ...db,
      approvalLogs: currentUser.role === 'ADMIN' ? db.approvalLogs : [],
      auditLogs:
        currentUser.role === 'ADMIN' || currentUser.role === 'OKR_ADMIN'
          ? db.auditLogs
          : [],
    };
  }

  if (currentUser.role === 'MANAGER') {
    const subordinateIds = getSubordinateIds(db.users, currentUser.userId);
    const visibleUserIds = new Set<string>([currentUser.userId, ...subordinateIds]);
    if (currentUser.managerId) visibleUserIds.add(currentUser.managerId);

    const visibleUsers = db.users
      .filter(
        (u) =>
          u.accountStatus === 'APPROVED' &&
          (u.departmentId === currentUser.departmentId || visibleUserIds.has(u.userId))
      )
      .map((u) => ({
        ...u,
        googleSub: u.userId === currentUser.userId ? u.googleSub : '',
      }));

    const visibleObjectives = db.objectives.filter(
      (o) =>
        o.level === 'Company' ||
        o.departmentId === currentUser.departmentId ||
        visibleUserIds.has(o.ownerId)
    );
    const visibleObjIds = new Set(visibleObjectives.map((o) => o.objectiveId));
    const visibleKrs = db.keyResults.filter(
      (k) => visibleObjIds.has(k.objectiveId) || visibleUserIds.has(k.ownerId)
    );
    const visibleProjects = db.projects.filter(
      (p) =>
        p.departmentId === currentUser.departmentId ||
        visibleObjIds.has(p.objectiveId) ||
        visibleUserIds.has(p.ownerId)
    );
    const visibleProjIds = new Set(visibleProjects.map((p) => p.projectId));
    const visibleTasks = db.tasks.filter(
      (t) =>
        visibleProjIds.has(t.projectId) ||
        visibleObjIds.has(t.objectiveId) ||
        visibleUserIds.has(t.ownerId)
    );

    return {
      ...db,
      users: visibleUsers,
      objectives: visibleObjectives,
      keyResults: visibleKrs,
      projects: visibleProjects,
      tasks: visibleTasks,
      notifications: db.notifications.filter((n) => n.userId === currentUser.userId),
      approvalLogs: [],
      auditLogs: [],
      organizationHistory: db.organizationHistory.filter((h) => visibleUserIds.has(h.userId)),
    };
  }

  // MEMBER and VIEWER: see own profile, direct manager, peers in team/dept, company OKRs, and assigned OKRs/tasks
  const visibleUsers = db.users
    .filter(
      (u) =>
        u.accountStatus === 'APPROVED' &&
        (u.userId === currentUser.userId ||
          u.userId === currentUser.managerId ||
          (currentUser.teamId && u.teamId === currentUser.teamId) ||
          (currentUser.departmentId && u.departmentId === currentUser.departmentId))
    )
    .map((u) => ({
      ...u,
      googleSub: u.userId === currentUser.userId ? u.googleSub : '',
    }));

  const visibleObjectives = db.objectives.filter(
    (o) =>
      o.level === 'Company' ||
      o.ownerId === currentUser.userId ||
      (currentUser.departmentId && o.departmentId === currentUser.departmentId)
  );
  const visibleObjIds = new Set(visibleObjectives.map((o) => o.objectiveId));
  const visibleKrs = db.keyResults.filter(
    (k) => visibleObjIds.has(k.objectiveId) || k.ownerId === currentUser.userId
  );
  const visibleProjects = db.projects.filter(
    (p) =>
      p.ownerId === currentUser.userId ||
      (currentUser.departmentId && p.departmentId === currentUser.departmentId) ||
      visibleObjIds.has(p.objectiveId)
  );
  const visibleProjIds = new Set(visibleProjects.map((p) => p.projectId));
  const visibleTasks = db.tasks.filter(
    (t) =>
      t.ownerId === currentUser.userId ||
      visibleProjIds.has(t.projectId) ||
      visibleObjIds.has(t.objectiveId)
  );

  return {
    ...db,
    users: visibleUsers,
    objectives: visibleObjectives,
    keyResults: visibleKrs,
    projects: visibleProjects,
    tasks: visibleTasks,
    notifications: db.notifications.filter((n) => n.userId === currentUser.userId),
    approvalLogs: [],
    auditLogs: [],
    organizationHistory: db.organizationHistory.filter((h) => h.userId === currentUser.userId),
  };
}
