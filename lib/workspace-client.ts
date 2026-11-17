import { getAccessToken } from './firebase-auth';
import type {
  AccountStatus,
  ApprovalLog,
  DatabaseState,
  Department,
  DriveFileItem,
  OkrUser,
  OrganizationHistory,
  Team,
  UserRole,
  VerifiedSessionInfo,
} from '@/types/okr';

function requireToken(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error(
      'Phiên đăng nhập Google đã hết hạn hoặc chưa cấp quyền Drive/Sheets. Vui lòng đăng nhập lại.'
    );
  }
  return token;
}

const CSRF_HEADER = { 'X-FlowOKR-CSRF': '1' };

export class ApiError extends Error {
  status: number;
  code?: string;
  accountStatus?: AccountStatus;
  user?: OkrUser | null;
  canOwnerBootstrap?: boolean;
  constructor(
    message: string,
    status: number,
    extra?: {
      code?: string;
      accountStatus?: AccountStatus;
      user?: OkrUser | null;
      canOwnerBootstrap?: boolean;
    }
  ) {
    super(message);
    this.status = status;
    this.code = extra?.code;
    this.accountStatus = extra?.accountStatus;
    this.user = extra?.user;
    this.canOwnerBootstrap = extra?.canOwnerBootstrap;
  }
}

// ============================================================================
// AUTHENTICATION API CALLS
// ============================================================================

export async function verifySessionWithBackend(
  idToken: string,
  spreadsheetId?: string
): Promise<{
  sessionUser: VerifiedSessionInfo;
  user?: OkrUser;
  accountStatus?: AccountStatus;
  canOwnerBootstrap?: boolean;
  pendingCount?: number;
}> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...CSRF_HEADER,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch('/api/auth', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action: 'signInWithGoogle',
      idToken,
      spreadsheetId,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Xác thực Google thất bại.', res.status, data);
  return data;
}

export async function fetchCurrentUserStatus(spreadsheetId: string): Promise<{
  sessionUser: VerifiedSessionInfo;
  user: OkrUser | null;
  accountStatus: AccountStatus | 'UNREGISTERED' | 'NO_SHEET';
  canOwnerBootstrap: boolean;
  pendingCount: number;
}> {
  const token = requireToken();
  const res = await fetch(
    `/api/auth?action=getCurrentUser&spreadsheetId=${encodeURIComponent(spreadsheetId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Lỗi kiểm tra tài khoản.', res.status, data);
  return data;
}

export async function bootstrapOwnerAdmin(spreadsheetId: string): Promise<{
  user: OkrUser;
  accountStatus: AccountStatus;
}> {
  const token = requireToken();
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER,
    },
    body: JSON.stringify({ action: 'bootstrapAdmin', spreadsheetId }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Không thể khởi tạo Admin.', res.status, data);
  return data;
}

export async function signOutBackendSession(): Promise<void> {
  await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...CSRF_HEADER },
    body: JSON.stringify({ action: 'signOut' }),
  }).catch(() => undefined);
}

// ============================================================================
// GOOGLE DRIVE & WORKSPACE API CALLS
// ============================================================================

export async function fetchDriveWorkspace(): Promise<{
  folder: DriveFileItem;
  spreadsheets: DriveFileItem[];
  files: DriveFileItem[];
}> {
  const token = requireToken();
  const res = await fetch('/api/workspace?action=init', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Không thể truy cập Google Drive.', res.status, data);
  return data;
}

export async function loadSpreadsheetDatabase(spreadsheetId: string): Promise<{
  title: string;
  spreadsheetUrl: string;
  data: DatabaseState;
  currentUser: OkrUser;
  pendingCount: number;
}> {
  const token = requireToken();
  const res = await fetch(
    `/api/workspace?action=load&spreadsheetId=${encodeURIComponent(spreadsheetId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Không thể đọc dữ liệu từ Google Sheets.', res.status, data);
  }
  return data;
}

export async function bootstrapNewSpreadsheet(
  spreadsheetName: string,
  initialState?: DatabaseState
): Promise<{
  folder: DriveFileItem;
  spreadsheet: DriveFileItem;
  title: string;
  spreadsheetUrl: string;
  data?: DatabaseState;
  currentUser?: OkrUser;
  user?: OkrUser;
  accountStatus?: AccountStatus;
  canOwnerBootstrap?: boolean;
}> {
  const token = requireToken();
  const res = await fetch('/api/workspace', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER,
    },
    body: JSON.stringify({
      action: 'bootstrap',
      spreadsheetName,
      state: initialState,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Không thể khởi tạo Google Sheet mới trên Drive.', res.status, data);
  }
  return data;
}

export async function syncStateToGoogleSheet(
  spreadsheetId: string,
  state: DatabaseState
): Promise<{ syncedAt: string }> {
  const token = requireToken();
  const res = await fetch('/api/workspace', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER,
    },
    body: JSON.stringify({
      action: 'syncDatabase',
      spreadsheetId,
      state,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new ApiError(data.error || 'Không thể đồng bộ dữ liệu lên Google Sheets.', res.status, data);
  }
  return data;
}

export async function uploadFileToDrive(
  file: File,
  folderId?: string,
  spreadsheetId?: string
): Promise<{ file: DriveFileItem }> {
  const token = requireToken();
  const formData = new FormData();
  formData.append('file', file);
  if (folderId) formData.append('folderId', folderId);
  if (spreadsheetId) formData.append('spreadsheetId', spreadsheetId);

  const res = await fetch('/api/workspace', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...CSRF_HEADER },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Không thể tải tệp lên Google Drive.', res.status, data);
  return data;
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = requireToken();
  const res = await fetch(`/api/workspace?fileId=${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, ...CSRF_HEADER },
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Không thể xóa tệp trên Google Drive.', res.status, data);
}

// ============================================================================
// USER APPROVAL API CALLS
// ============================================================================

export async function fetchApprovalManagementData(spreadsheetId: string): Promise<{
  users: OkrUser[];
  pendingUsers: OkrUser[];
  approvalLogs: ApprovalLog[];
  departments: Department[];
  teams: Team[];
}> {
  const token = requireToken();
  const res = await fetch(
    `/api/approval?action=getPendingUsers&spreadsheetId=${encodeURIComponent(spreadsheetId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Lỗi tải danh sách phê duyệt.', res.status, data);
  return data;
}

export async function postApprovalAction(
  spreadsheetId: string,
  payload: Record<string, unknown>
): Promise<{ user: OkrUser; db: DatabaseState }> {
  const token = requireToken();
  const res = await fetch('/api/approval', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER,
    },
    body: JSON.stringify({ spreadsheetId, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Thao tác phê duyệt thất bại.', res.status, data);
  return data;
}

// ============================================================================
// ORGANIZATION API CALLS
// ============================================================================

export async function fetchOrganizationHistoryApi(
  spreadsheetId: string
): Promise<OrganizationHistory[]> {
  const token = requireToken();
  const res = await fetch(
    `/api/organization?action=getOrganizationHistory&spreadsheetId=${encodeURIComponent(spreadsheetId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Lỗi tải lịch sử điều chuyển.', res.status, data);
  return data.history || [];
}

export async function postOrganizationAction(
  spreadsheetId: string,
  payload: Record<string, unknown>
): Promise<{ db: DatabaseState; department?: Department; team?: Team; user?: OkrUser }> {
  const token = requireToken();
  const res = await fetch('/api/organization', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...CSRF_HEADER,
    },
    body: JSON.stringify({ spreadsheetId, ...payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new ApiError(data.error || 'Thao tác cơ cấu tổ chức thất bại.', res.status, data);
  return data;
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}
