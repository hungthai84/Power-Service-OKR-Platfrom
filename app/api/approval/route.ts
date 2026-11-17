import { NextRequest, NextResponse } from 'next/server';
import {
  assertCsrfHeader,
  getGoogleAccessTokenFromRequest,
  validateSession,
} from '@/lib/server-google-auth';
import {
  approveUser,
  getPendingUsers,
  getUserApprovalDetails,
  reactivateUser,
  rejectUser,
  saveUserDraft,
  ServiceError,
  suspendUser,
  updateUserOrganization,
  updateUserRole,
  type ApproveUserPayload,
} from '@/lib/okr-backend-service';
import type { UserRole } from '@/types/okr';

export async function GET(req: NextRequest) {
  const session = validateSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Chưa xác thực phiên đăng nhập.' }, { status: 401 });
  }
  const accessToken = getGoogleAccessTokenFromRequest(req);
  if (!accessToken) {
    return NextResponse.json({ error: 'Thiếu token truy cập Google Sheets.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'getPendingUsers';
  const spreadsheetId = searchParams.get('spreadsheetId');
  const userId = searchParams.get('userId');

  if (!spreadsheetId) {
    return NextResponse.json({ error: 'Thiếu spreadsheetId.' }, { status: 400 });
  }

  try {
    if (action === 'getUserApprovalDetails' && userId) {
      const details = await getUserApprovalDetails(spreadsheetId, accessToken, session, userId);
      return NextResponse.json({ success: true, ...details });
    }

    const res = await getPendingUsers(spreadsheetId, accessToken, session);
    return NextResponse.json({ success: true, ...res });
  } catch (err: unknown) {
    const e = err as ServiceError;
    return NextResponse.json(
      { error: e.message || 'Lỗi tải danh sách phê duyệt.', code: e.code },
      { status: e.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!assertCsrfHeader(req)) {
    return NextResponse.json({ error: 'CSRF validation failed.' }, { status: 403 });
  }
  const session = validateSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Chưa xác thực phiên đăng nhập.' }, { status: 401 });
  }
  const accessToken = getGoogleAccessTokenFromRequest(req);
  if (!accessToken) {
    return NextResponse.json({ error: 'Thiếu token truy cập Google Sheets.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, spreadsheetId } = body as { action: string; spreadsheetId?: string };
    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Thiếu spreadsheetId.' }, { status: 400 });
    }

    if (action === 'approveUser') {
      const res = await approveUser(spreadsheetId, accessToken, session, body as ApproveUserPayload);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'saveDraft') {
      const res = await saveUserDraft(spreadsheetId, accessToken, session, body as ApproveUserPayload);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'rejectUser') {
      const res = await rejectUser(spreadsheetId, accessToken, session, body.userId, body.reason);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'suspendUser') {
      const res = await suspendUser(
        spreadsheetId,
        accessToken,
        session,
        body.userId,
        body.reason,
        body.nextStatus === 'INACTIVE' ? 'INACTIVE' : 'SUSPENDED'
      );
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'reactivateUser') {
      const res = await reactivateUser(spreadsheetId, accessToken, session, body.userId, body.reason);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'updateUserRole') {
      const res = await updateUserRole(
        spreadsheetId,
        accessToken,
        session,
        body.userId,
        body.role as UserRole,
        body.reason
      );
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'updateUserOrganization') {
      const res = await updateUserOrganization(spreadsheetId, accessToken, session, body);
      return NextResponse.json({ success: true, ...res });
    }

    return NextResponse.json({ error: 'Action phê duyệt không hợp lệ.' }, { status: 400 });
  } catch (err: unknown) {
    const e = err as ServiceError;
    return NextResponse.json(
      { error: e.message || 'Lỗi xử lý phê duyệt tài khoản.', code: e.code },
      { status: e.status || 500 }
    );
  }
}
