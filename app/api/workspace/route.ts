import { NextRequest, NextResponse } from 'next/server';
import {
  assertCsrfHeader,
  getGoogleAccessTokenFromRequest,
  validateSession,
} from '@/lib/server-google-auth';
import {
  filterDatabaseByPermissions,
  findUserBySession,
  hasAnyApprovedAdmin,
} from '@/lib/server-rbac';
import {
  ensureSheetTabs,
  findOrCreateWorkspaceFolder,
  googleFetch,
  readAllTabs,
  writeStateToSheet,
} from '@/lib/server-sheets-repo';
import { signInWithGoogleToWorkspace } from '@/lib/okr-backend-service';
import type { DatabaseState } from '@/types/okr';

export async function GET(req: NextRequest) {
  const token = getGoogleAccessTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: 'Thiếu token xác thực Google.' }, { status: 401 });
  }

  const session = validateSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Phiên đăng nhập chưa được xác thực trên máy chủ.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'init';
  const spreadsheetId = searchParams.get('spreadsheetId');

  try {
    if (action === 'load' && spreadsheetId) {
      // Register or retrieve user status strictly via verified Google sub & email
      const signInRes = await signInWithGoogleToWorkspace(spreadsheetId, token, session);
      if (signInRes.accountStatus !== 'APPROVED') {
        return NextResponse.json(
          {
            error: `Tài khoản đang ở trạng thái ${signInRes.accountStatus}, chưa được phép truy cập dữ liệu OKR.`,
            code: 'ACCOUNT_NOT_APPROVED',
            accountStatus: signInRes.accountStatus,
            user: signInRes.user,
            canOwnerBootstrap: signInRes.canOwnerBootstrap,
          },
          { status: 403 }
        );
      }

      const loaded = await readAllTabs(spreadsheetId, token);
      const scopedData = filterDatabaseByPermissions(loaded.data, signInRes.user);
      return NextResponse.json({
        success: true,
        ...loaded,
        data: scopedData,
        currentUser: signInRes.user,
        pendingCount: signInRes.pendingCount,
      });
    }

    const folder = await findOrCreateWorkspaceFolder(token);
    const filesRes = await googleFetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `trashed=false and ('${folder.id}' in parents or mimeType='application/vnd.google-apps.spreadsheet')`
      )}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=50`,
      token
    );
    const allFiles = (filesRes.files as Array<Record<string, string>>) || [];
    const spreadsheets = allFiles.filter(
      (f) => f.mimeType === 'application/vnd.google-apps.spreadsheet'
    );

    return NextResponse.json({
      success: true,
      folder,
      spreadsheets,
      files: allFiles,
    });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: e.message || 'Lỗi kết nối Google Drive/Sheets' },
      { status: e.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!assertCsrfHeader(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const token = getGoogleAccessTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: 'Thiếu token xác thực Google.' }, { status: 401 });
  }
  const session = validateSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Phiên đăng nhập chưa được xác thực trên máy chủ.' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    // Multipart File Upload to Google Drive
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const folderId = formData.get('folderId') as string | null;
      const spreadsheetId = formData.get('spreadsheetId') as string | null;

      if (spreadsheetId) {
        const loaded = await readAllTabs(spreadsheetId, token);
        const actor = findUserBySession(loaded.data.users, session.googleSub, session.email);
        if (!actor || actor.accountStatus !== 'APPROVED' || actor.role === 'VIEWER') {
          return NextResponse.json(
            { error: 'Tài khoản chưa được phê duyệt hoặc chỉ có quyền VIEWER.' },
            { status: 403 }
          );
        }
      }

      if (!file) {
        return NextResponse.json({ error: 'Không tìm thấy tệp tải lên.' }, { status: 400 });
      }

      const targetFolderId = folderId || (await findOrCreateWorkspaceFolder(token)).id;
      const metadata = {
        name: file.name,
        parents: [targetFolderId],
      };

      const boundary = '-------flowokr_drive_boundary_' + Date.now();
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const part1 = Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(
          metadata
        )}\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`
      );
      const part2 = Buffer.from(`\r\n--${boundary}--`);
      const multipartBody = Buffer.concat([part1, fileBuffer, part2]);

      const uploaded = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,modifiedTime,size',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );
      const uploadedJson = await uploaded.json();
      if (!uploaded.ok) {
        throw new Error(uploadedJson?.error?.message || 'Upload Google Drive thất bại');
      }
      return NextResponse.json({ success: true, file: uploadedJson });
    }

    const body = await req.json();
    const { action, spreadsheetId, spreadsheetName, state } = body as {
      action: string;
      spreadsheetId?: string;
      spreadsheetName?: string;
      state?: DatabaseState;
    };

    if (action === 'bootstrap') {
      const folder = await findOrCreateWorkspaceFolder(token);
      const createdFile = await googleFetch(
        'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,webViewLink,modifiedTime',
        token,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: spreadsheetName || 'FlowOKR_Enterprise_DB',
            mimeType: 'application/vnd.google-apps.spreadsheet',
            parents: [folder.id],
          }),
        }
      );
      const newSheetId = createdFile.id as string;
      if (state) {
        // Strip any client-injected ADMIN users during bootstrap so first-user admin protection holds (B5)
        const sanitizedInitial: DatabaseState = {
          ...state,
          users: [],
          approvalLogs: [],
          organizationHistory: [],
        };
        await writeStateToSheet(newSheetId, sanitizedInitial, token);
      } else {
        await ensureSheetTabs(newSheetId, token);
      }

      // Register authenticated caller cleanly via signInWithGoogleToWorkspace (PENDING unless ADMIN_BOOTSTRAP_EMAIL)
      const signInRes = await signInWithGoogleToWorkspace(newSheetId, token, session);
      if (signInRes.accountStatus !== 'APPROVED') {
        return NextResponse.json({
          success: true,
          folder,
          spreadsheet: createdFile,
          title: spreadsheetName || 'FlowOKR_Enterprise_DB',
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`,
          accountStatus: signInRes.accountStatus,
          user: signInRes.user,
          canOwnerBootstrap: signInRes.canOwnerBootstrap,
        });
      }

      const loaded = await readAllTabs(newSheetId, token);
      return NextResponse.json({
        success: true,
        folder,
        spreadsheet: createdFile,
        ...loaded,
        currentUser: signInRes.user,
        accountStatus: signInRes.accountStatus,
        canOwnerBootstrap: signInRes.canOwnerBootstrap,
      });
    }

    if (action === 'syncDatabase') {
      if (!spreadsheetId || !state) {
        return NextResponse.json({ error: 'Thiếu spreadsheetId hoặc state.' }, { status: 400 });
      }

      // Server-side verification: user must be APPROVED and non-VIEWER
      const current = await readAllTabs(spreadsheetId, token);
      const actor = findUserBySession(current.data.users, session.googleSub, session.email);
      if (!actor || actor.accountStatus !== 'APPROVED') {
        return NextResponse.json(
          { error: 'Tài khoản chưa được phê duyệt để lưu dữ liệu.' },
          { status: 403 }
        );
      }
      if (actor.role === 'VIEWER') {
        return NextResponse.json(
          { error: 'Vai trò VIEWER chỉ được phép xem, không thể chỉnh sửa dữ liệu.' },
          { status: 403 }
        );
      }

      // Protect USERS, APPROVAL_LOGS, ORGANIZATION_HISTORY, and DEPARTMENTS/TEAMS from non-ADMIN tampering
      const isAdmin = actor.role === 'ADMIN';
      const safeState: DatabaseState = isAdmin
        ? {
            ...state,
            // Ensure at least one ADMIN remains if editing users via general sync
            users: hasAnyApprovedAdmin(state.users) ? state.users : current.data.users,
          }
        : {
            ...state,
            users: current.data.users,
            departments: current.data.departments,
            teams: current.data.teams,
            approvalLogs: current.data.approvalLogs,
            organizationHistory: current.data.organizationHistory,
            // Merge non-visible OKR/Project/Task records back so scoped roles don't overwrite other departments' rows!
            objectives: mergeScopedRecords(current.data.objectives, state.objectives, 'objectiveId'),
            keyResults: mergeScopedRecords(current.data.keyResults, state.keyResults, 'krId'),
            projects: mergeScopedRecords(current.data.projects, state.projects, 'projectId'),
            tasks: mergeScopedRecords(current.data.tasks, state.tasks, 'taskId'),
            auditLogs: [
              ...(state.auditLogs || []).filter(
                (l) => !current.data.auditLogs.some((c) => c.logId === l.logId)
              ),
              ...current.data.auditLogs,
            ].slice(0, 300),
          };

      await writeStateToSheet(spreadsheetId, safeState, token);
      return NextResponse.json({ success: true, syncedAt: new Date().toISOString() });
    }

    return NextResponse.json({ error: 'Action không hợp lệ.' }, { status: 400 });
  } catch (err: unknown) {
    const e = err as Error & { status?: number };
    return NextResponse.json(
      { error: e.message || 'Lỗi xử lý Google Drive/Sheets' },
      { status: e.status || 500 }
    );
  }
}

function mergeScopedRecords<T extends object>(
  existingAll: T[],
  incomingScoped: T[],
  idKey: keyof T
): T[] {
  const incomingMap = new Map<string, T>();
  for (const item of incomingScoped) {
    incomingMap.set(String(item[idKey]), item);
  }
  const merged: T[] = [];
  const seen = new Set<string>();
  for (const existing of existingAll) {
    const id = String(existing[idKey]);
    seen.add(id);
    if (incomingMap.has(id)) {
      merged.push(incomingMap.get(id)!);
    } else {
      merged.push(existing);
    }
  }
  for (const item of incomingScoped) {
    const id = String(item[idKey]);
    if (!seen.has(id)) {
      merged.push(item);
    }
  }
  return merged;
}

export async function DELETE(req: NextRequest) {
  if (!assertCsrfHeader(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const token = getGoogleAccessTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: 'Thiếu token xác thực Google.' }, { status: 401 });
  }
  const session = validateSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Chưa xác thực phiên đăng nhập.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fileId = searchParams.get('fileId');
  if (!fileId) {
    return NextResponse.json({ error: 'Thiếu fileId.' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || 'Không thể xóa tệp trên Google Drive.');
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const e = err as Error;
    return NextResponse.json({ error: e.message || 'Lỗi xóa tệp Drive' }, { status: 500 });
  }
}
