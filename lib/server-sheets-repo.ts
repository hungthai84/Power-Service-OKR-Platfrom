import type {
  AccountStatus,
  ApprovalLog,
  DatabaseState,
  Department,
  OkrUser,
  OrganizationHistory,
  Team,
  UserRole,
} from '@/types/okr';

export const DRIVE_FOLDER_NAME = 'FlowOKR_Workspace';

export const SHEET_SCHEMAS: Record<string, string[]> = {
  CYCLES: ['cycleId', 'nameVi', 'nameKo', 'cycleType', 'startDate', 'endDate', 'status', 'createdAt'],
  DEPARTMENTS: [
    'departmentId',
    'parentDepartmentId',
    'nameVi',
    'nameKo',
    'managerId',
    'division',
    'level',
    'sortOrder',
    'descriptionVi',
    'descriptionKo',
    'status',
    'createdAt',
    'updatedAt',
  ],
  TEAMS: [
    'teamId',
    'departmentId',
    'parentTeamId',
    'nameVi',
    'nameKo',
    'managerId',
    'level',
    'sortOrder',
    'status',
    'createdAt',
    'updatedAt',
  ],
  USERS: [
    'userId',
    'googleSub',
    'email',
    'emailVerified',
    'displayNameVi',
    'displayNameKo',
    'avatarUrl',
    'employeeCode',
    'jobTitleVi',
    'jobTitleKo',
    'startDate',
    'departmentId',
    'teamId',
    'managerId',
    'role',
    'accountStatus',
    'requestedAt',
    'approvedAt',
    'approvedBy',
    'rejectedAt',
    'rejectedBy',
    'rejectionReason',
    'lastLoginAt',
    'createdAt',
    'updatedAt',
    'version',
  ],
  OBJECTIVES: [
    'objectiveId',
    'cycleId',
    'parentObjectiveId',
    'level',
    'titleVi',
    'titleKo',
    'descriptionVi',
    'descriptionKo',
    'ownerId',
    'departmentId',
    'priority',
    'status',
    'weight',
    'progress',
    'confidence',
    'startDate',
    'dueDate',
    'createdBy',
    'createdAt',
    'updatedAt',
    'deletedAt',
    'version',
  ],
  KEY_RESULTS: [
    'krId',
    'objectiveId',
    'titleVi',
    'titleKo',
    'metricType',
    'direction',
    'unit',
    'baselineValue',
    'currentValue',
    'targetValue',
    'minTargetValue',
    'maxTargetValue',
    'weight',
    'progress',
    'ownerId',
    'startDate',
    'dueDate',
    'status',
    'lastCheckinAt',
    'deletedAt',
  ],
  PROJECTS: [
    'projectId',
    'objectiveId',
    'departmentId',
    'nameVi',
    'nameKo',
    'descriptionVi',
    'descriptionKo',
    'ownerId',
    'status',
    'priority',
    'progress',
    'budget',
    'currency',
    'startDate',
    'dueDate',
    'driveLink',
    'deletedAt',
    'createdAt',
    'updatedAt',
  ],
  TASKS: [
    'taskId',
    'projectId',
    'objectiveId',
    'krId',
    'titleVi',
    'titleKo',
    'descriptionVi',
    'ownerId',
    'priority',
    'status',
    'dueDate',
    'estimatedHours',
    'progress',
    'driveAttachmentUrl',
    'deletedAt',
    'createdAt',
    'updatedAt',
  ],
  CHECKINS: [
    'checkInId',
    'krId',
    'objectiveId',
    'cycleId',
    'currentValue',
    'calculatedProgress',
    'confidenceScore',
    'status',
    'winsVi',
    'winsKo',
    'blockersVi',
    'nextStepsVi',
    'evidenceUrl',
    'ownerId',
    'createdAt',
  ],
  NOTIFICATIONS: [
    'notificationId',
    'userId',
    'type',
    'titleVi',
    'titleKo',
    'messageVi',
    'messageKo',
    'isRead',
    'createdAt',
  ],
  COMMENTS: ['commentId', 'entityType', 'entityId', 'userId', 'bodyVi', 'bodyKo', 'createdAt'],
  AUDIT_LOGS: ['logId', 'userId', 'action', 'entityType', 'entityId', 'newValue', 'timestamp'],
  APPROVAL_LOGS: [
    'approvalId',
    'userId',
    'action',
    'previousStatus',
    'newStatus',
    'departmentId',
    'teamId',
    'managerId',
    'assignedRole',
    'approvedBy',
    'reason',
    'createdAt',
  ],
  ORGANIZATION_HISTORY: [
    'historyId',
    'userId',
    'previousDepartmentId',
    'newDepartmentId',
    'previousTeamId',
    'newTeamId',
    'previousManagerId',
    'newManagerId',
    'previousJobTitle',
    'newJobTitle',
    'changedBy',
    'effectiveDate',
    'reason',
    'createdAt',
  ],
  SETTINGS: ['key', 'value'],
};

const NUMERIC_FIELDS = new Set([
  'weight',
  'progress',
  'confidence',
  'version',
  'baselineValue',
  'currentValue',
  'targetValue',
  'budget',
  'estimatedHours',
  'calculatedProgress',
  'confidenceScore',
  'onTrackThreshold',
  'atRiskThreshold',
  'sortOrder',
]);

const BOOLEAN_FIELDS = new Set(['isRead', 'emailVerified']);

function rowsToObjects<T>(values: unknown[][] | undefined, schemaCols: string[]): T[] {
  if (!values || values.length < 2) return [];
  const headers = values[0].map((h) => String(h || '').trim());
  const result: T[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row || row.every((cell) => cell === '' || cell === null || cell === undefined)) continue;
    const obj: Record<string, unknown> = {};
    const cols = headers.length > 0 ? headers : schemaCols;
    cols.forEach((col, idx) => {
      const raw = row[idx] !== undefined ? row[idx] : '';
      if (NUMERIC_FIELDS.has(col)) {
        obj[col] = raw === '' ? 0 : Number(raw);
      } else if (BOOLEAN_FIELDS.has(col)) {
        obj[col] = String(raw).toLowerCase() === 'true';
      } else {
        obj[col] = String(raw);
      }
    });
    result.push(obj as T);
  }
  return result;
}

function objectsToRows(items: Record<string, unknown>[], cols: string[]): (string | number | boolean)[][] {
  const headerRow = [...cols];
  const dataRows = items.map((item) =>
    cols.map((col) => {
      const val = item[col];
      if (val === undefined || val === null) return '';
      if (typeof val === 'boolean' || typeof val === 'number') return val;
      return String(val);
    })
  );
  return [headerRow, ...dataRows];
}

function normalizeUserRecord(raw: Partial<OkrUser> & { status?: string }): OkrUser {
  const rawStatus = String(raw.accountStatus || raw.status || 'PENDING').toUpperCase();
  let accountStatus: AccountStatus = 'PENDING';
  if (rawStatus === 'ACTIVE' || rawStatus === 'APPROVED') accountStatus = 'APPROVED';
  else if (rawStatus === 'REJECTED') accountStatus = 'REJECTED';
  else if (rawStatus === 'SUSPENDED') accountStatus = 'SUSPENDED';
  else if (rawStatus === 'INACTIVE') accountStatus = 'INACTIVE';

  const validRoles: UserRole[] = ['ADMIN', 'OKR_ADMIN', 'EXECUTIVE', 'MANAGER', 'MEMBER', 'VIEWER'];
  const roleUpper = String(raw.role || 'MEMBER').toUpperCase() as UserRole;
  const role: UserRole = validRoles.includes(roleUpper) ? roleUpper : 'MEMBER';

  return {
    userId: String(raw.userId || ''),
    googleSub: String(raw.googleSub || ''),
    email: String(raw.email || '').trim().toLowerCase(),
    emailVerified: Boolean(raw.emailVerified),
    displayNameVi: String(raw.displayNameVi || raw.email || ''),
    displayNameKo: String(raw.displayNameKo || raw.displayNameVi || raw.email || ''),
    avatarUrl: String(raw.avatarUrl || ''),
    employeeCode: String(raw.employeeCode || ''),
    jobTitleVi: String(raw.jobTitleVi || ''),
    jobTitleKo: String(raw.jobTitleKo || ''),
    startDate: String(raw.startDate || ''),
    departmentId: String(raw.departmentId || ''),
    teamId: String(raw.teamId || ''),
    managerId: String(raw.managerId || ''),
    role,
    accountStatus,
    status: accountStatus,
    requestedAt: String(raw.requestedAt || raw.createdAt || ''),
    approvedAt: String(raw.approvedAt || ''),
    approvedBy: String(raw.approvedBy || ''),
    rejectedAt: String(raw.rejectedAt || ''),
    rejectedBy: String(raw.rejectedBy || ''),
    rejectionReason: String(raw.rejectionReason || ''),
    lastLoginAt: String(raw.lastLoginAt || ''),
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
    version: Number(raw.version || 1),
  };
}

function normalizeDepartment(raw: Partial<Department>): Department {
  return {
    departmentId: String(raw.departmentId || ''),
    parentDepartmentId: String(raw.parentDepartmentId || ''),
    nameVi: String(raw.nameVi || ''),
    nameKo: String(raw.nameKo || raw.nameVi || ''),
    managerId: String(raw.managerId || ''),
    division: String(raw.division || ''),
    level: String(raw.level || 'DEPARTMENT'),
    sortOrder: Number(raw.sortOrder || 0),
    descriptionVi: String(raw.descriptionVi || ''),
    descriptionKo: String(raw.descriptionKo || ''),
    status: String(raw.status || 'ACTIVE'),
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  };
}

function normalizeTeam(raw: Partial<Team>): Team {
  return {
    teamId: String(raw.teamId || ''),
    departmentId: String(raw.departmentId || ''),
    parentTeamId: String(raw.parentTeamId || ''),
    nameVi: String(raw.nameVi || ''),
    nameKo: String(raw.nameKo || raw.nameVi || ''),
    managerId: String(raw.managerId || ''),
    level: String(raw.level || 'TEAM'),
    sortOrder: Number(raw.sortOrder || 0),
    status: String(raw.status || 'ACTIVE'),
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  };
}

export async function googleFetch(url: string, token: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const errObj = json.error as Record<string, unknown> | undefined;
    const msg = (errObj?.message as string) || `Google API error (${res.status})`;
    const error = new Error(msg) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return json;
}

export async function findOrCreateWorkspaceFolder(token: string) {
  const q = encodeURIComponent(
    `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const list = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,webViewLink,modifiedTime)&pageSize=10`,
    token
  );
  const files = (list.files as Array<Record<string, string>>) || [];
  if (files.length > 0) {
    return files[0];
  }
  const created = await googleFetch(
    'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,modifiedTime',
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: DRIVE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    }
  );
  return created as Record<string, string>;
}

export async function ensureSheetTabs(spreadsheetId: string, token: string) {
  const meta = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,spreadsheetUrl,sheets.properties`,
    token
  );
  const existingSheets = (meta.sheets as Array<{ properties: { sheetId: number; title: string } }>) || [];
  const existingNames = new Set(existingSheets.map((s) => s.properties.title));

  const requests: Record<string, unknown>[] = [];
  const missingTabs: string[] = [];

  for (const tabName of Object.keys(SHEET_SCHEMAS)) {
    if (!existingNames.has(tabName)) {
      missingTabs.push(tabName);
      requests.push({ addSheet: { properties: { title: tabName } } });
    }
  }

  const defaultSheet = existingSheets.find(
    (s) => s.properties.title === 'Sheet1' || s.properties.title === 'Trang tính1'
  );
  if (defaultSheet && existingSheets.length + requests.length > 1) {
    requests.push({ deleteSheet: { sheetId: defaultSheet.properties.sheetId } });
  }

  if (requests.length > 0) {
    await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    });
  }

  if (missingTabs.length > 0) {
    const data = missingTabs.map((tab) => ({
      range: `'${tab}'!A1`,
      values: [SHEET_SCHEMAS[tab]],
    }));
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data,
        }),
      }
    );
  }

  return meta;
}

export async function readAllTabs(
  spreadsheetId: string,
  token: string
): Promise<{
  title: string;
  spreadsheetUrl: string;
  data: DatabaseState;
}> {
  const meta = await ensureSheetTabs(spreadsheetId, token);
  const props = (meta.properties as Record<string, string>) || {};
  const tabNames = Object.keys(SHEET_SCHEMAS);
  const rangesParam = tabNames.map((t) => `ranges=${encodeURIComponent(`'${t}'!A1:AF5000`)}`).join('&');
  const batch = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangesParam}`,
    token
  );
  const valueRanges = (batch.valueRanges as Array<{ range: string; values?: unknown[][] }>) || [];
  const getByTab = (tab: string) => {
    const idx = tabNames.indexOf(tab);
    return idx >= 0 ? valueRanges[idx]?.values : undefined;
  };

  const settingsRows = rowsToObjects<{ key: string; value: string }>(getByTab('SETTINGS'), SHEET_SCHEMAS.SETTINGS);
  const settingsMap: Record<string, string> = {};
  settingsRows.forEach((r) => {
    if (r.key) settingsMap[r.key] = r.value;
  });

  const rawUsers = rowsToObjects<Partial<OkrUser> & { status?: string }>(getByTab('USERS'), SHEET_SCHEMAS.USERS);
  const rawDepts = rowsToObjects<Partial<Department>>(getByTab('DEPARTMENTS'), SHEET_SCHEMAS.DEPARTMENTS);
  const rawTeams = rowsToObjects<Partial<Team>>(getByTab('TEAMS'), SHEET_SCHEMAS.TEAMS);

  const data: DatabaseState = {
    cycles: rowsToObjects(getByTab('CYCLES'), SHEET_SCHEMAS.CYCLES),
    departments: rawDepts.map(normalizeDepartment),
    teams: rawTeams.map(normalizeTeam),
    users: rawUsers.map(normalizeUserRecord),
    objectives: rowsToObjects(getByTab('OBJECTIVES'), SHEET_SCHEMAS.OBJECTIVES),
    keyResults: rowsToObjects(getByTab('KEY_RESULTS'), SHEET_SCHEMAS.KEY_RESULTS),
    projects: rowsToObjects(getByTab('PROJECTS'), SHEET_SCHEMAS.PROJECTS),
    tasks: rowsToObjects(getByTab('TASKS'), SHEET_SCHEMAS.TASKS),
    checkins: rowsToObjects(getByTab('CHECKINS'), SHEET_SCHEMAS.CHECKINS),
    notifications: rowsToObjects(getByTab('NOTIFICATIONS'), SHEET_SCHEMAS.NOTIFICATIONS),
    comments: rowsToObjects(getByTab('COMMENTS'), SHEET_SCHEMAS.COMMENTS),
    auditLogs: rowsToObjects(getByTab('AUDIT_LOGS'), SHEET_SCHEMAS.AUDIT_LOGS),
    approvalLogs: rowsToObjects<ApprovalLog>(getByTab('APPROVAL_LOGS'), SHEET_SCHEMAS.APPROVAL_LOGS),
    organizationHistory: rowsToObjects<OrganizationHistory>(
      getByTab('ORGANIZATION_HISTORY'),
      SHEET_SCHEMAS.ORGANIZATION_HISTORY
    ),
    settings: {
      companyName: settingsMap.companyName || 'FlowOKR Enterprise',
      checkinFrequency: settingsMap.checkinFrequency || 'WEEKLY',
      onTrackThreshold: Number(settingsMap.onTrackThreshold) || 85,
      atRiskThreshold: Number(settingsMap.atRiskThreshold) || 60,
    },
  };

  return {
    title: props.title || 'FlowOKR_Enterprise_DB',
    spreadsheetUrl:
      (meta.spreadsheetUrl as string) || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    data,
  };
}

export async function writeStateToSheet(spreadsheetId: string, state: DatabaseState, token: string) {
  await ensureSheetTabs(spreadsheetId, token);

  const settingsArr = [
    { key: 'companyName', value: state.settings.companyName },
    { key: 'checkinFrequency', value: state.settings.checkinFrequency },
    { key: 'onTrackThreshold', value: String(state.settings.onTrackThreshold) },
    { key: 'atRiskThreshold', value: String(state.settings.atRiskThreshold) },
  ];

  // Ensure no Google Access Token / ID Token / password leaks into USERS rows
  const sanitizedUsers = state.users.map((u) => ({
    ...normalizeUserRecord(u),
  }));

  const tabDataMap: Array<{ tab: string; rows: (string | number | boolean)[][] }> = [
    { tab: 'CYCLES', rows: objectsToRows(state.cycles as unknown as Record<string, unknown>[], SHEET_SCHEMAS.CYCLES) },
    {
      tab: 'DEPARTMENTS',
      rows: objectsToRows(
        state.departments.map(normalizeDepartment) as unknown as Record<string, unknown>[],
        SHEET_SCHEMAS.DEPARTMENTS
      ),
    },
    {
      tab: 'TEAMS',
      rows: objectsToRows(
        (state.teams || []).map(normalizeTeam) as unknown as Record<string, unknown>[],
        SHEET_SCHEMAS.TEAMS
      ),
    },
    { tab: 'USERS', rows: objectsToRows(sanitizedUsers as unknown as Record<string, unknown>[], SHEET_SCHEMAS.USERS) },
    {
      tab: 'OBJECTIVES',
      rows: objectsToRows(state.objectives as unknown as Record<string, unknown>[], SHEET_SCHEMAS.OBJECTIVES),
    },
    {
      tab: 'KEY_RESULTS',
      rows: objectsToRows(state.keyResults as unknown as Record<string, unknown>[], SHEET_SCHEMAS.KEY_RESULTS),
    },
    {
      tab: 'PROJECTS',
      rows: objectsToRows(state.projects as unknown as Record<string, unknown>[], SHEET_SCHEMAS.PROJECTS),
    },
    { tab: 'TASKS', rows: objectsToRows(state.tasks as unknown as Record<string, unknown>[], SHEET_SCHEMAS.TASKS) },
    {
      tab: 'CHECKINS',
      rows: objectsToRows(state.checkins as unknown as Record<string, unknown>[], SHEET_SCHEMAS.CHECKINS),
    },
    {
      tab: 'NOTIFICATIONS',
      rows: objectsToRows(state.notifications as unknown as Record<string, unknown>[], SHEET_SCHEMAS.NOTIFICATIONS),
    },
    {
      tab: 'COMMENTS',
      rows: objectsToRows(state.comments as unknown as Record<string, unknown>[], SHEET_SCHEMAS.COMMENTS),
    },
    {
      tab: 'AUDIT_LOGS',
      rows: objectsToRows(
        state.auditLogs.slice(0, 300) as unknown as Record<string, unknown>[],
        SHEET_SCHEMAS.AUDIT_LOGS
      ),
    },
    {
      tab: 'APPROVAL_LOGS',
      rows: objectsToRows(
        (state.approvalLogs || []).slice(0, 300) as unknown as Record<string, unknown>[],
        SHEET_SCHEMAS.APPROVAL_LOGS
      ),
    },
    {
      tab: 'ORGANIZATION_HISTORY',
      rows: objectsToRows(
        (state.organizationHistory || []).slice(0, 300) as unknown as Record<string, unknown>[],
        SHEET_SCHEMAS.ORGANIZATION_HISTORY
      ),
    },
    { tab: 'SETTINGS', rows: objectsToRows(settingsArr, SHEET_SCHEMAS.SETTINGS) },
  ];

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ranges: tabDataMap.map((t) => `'${t.tab}'!A1:AF5000`),
      }),
    }
  );

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: tabDataMap.map((t) => ({
          range: `'${t.tab}'!A1`,
          values: t.rows,
        })),
      }),
    }
  );
}
