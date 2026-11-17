import { NextRequest, NextResponse } from 'next/server';
import {
  assertCsrfHeader,
  clearSessionCookie,
  getGoogleAccessTokenFromRequest,
  setSessionCookie,
  validateSession,
  verifyGoogleCredential,
} from '@/lib/server-google-auth';
import {
  bootstrapInitialAdmin,
  getAccountStatus,
  getCurrentUser,
  ServiceError,
  signInWithGoogleToWorkspace,
} from '@/lib/okr-backend-service';

function isHttpsReq(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto') || new URL(req.url).protocol;
  return proto.startsWith('https');
}

export async function GET(req: NextRequest) {
  const session = validateSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Phiên đăng nhập chưa xác thực hoặc đã hết hạn.' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'getCurrentUser';
  const spreadsheetId = searchParams.get('spreadsheetId');
  const accessToken = getGoogleAccessTokenFromRequest(req);

  if (!spreadsheetId || !accessToken) {
    return NextResponse.json({
      success: true,
      sessionUser: session,
      accountStatus: 'NO_SHEET',
      user: null,
      canOwnerBootstrap: false,
      pendingCount: 0,
    });
  }

  try {
    if (action === 'getAccountStatus') {
      const statusRes = await getAccountStatus(spreadsheetId, accessToken, session);
      return NextResponse.json({ success: true, sessionUser: session, ...statusRes });
    }

    const current = await getCurrentUser(spreadsheetId, accessToken, session);
    return NextResponse.json({ success: true, sessionUser: session, ...current });
  } catch (err: unknown) {
    const e = err as ServiceError & { status?: number };
    return NextResponse.json(
      { error: e.message || 'Lỗi kiểm tra trạng thái tài khoản.' },
      { status: e.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!assertCsrfHeader(req)) {
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ (CSRF validation failed).' }, { status: 403 });
  }

  const https = isHttpsReq(req);

  try {
    const body = (await req.json()) as {
      action: string;
      idToken?: string;
      spreadsheetId?: string;
    };

    if (body.action === 'signOut') {
      const res = NextResponse.json({ success: true });
      clearSessionCookie(res, https);
      return res;
    }

    if (body.action === 'signInWithGoogle') {
      if (!body.idToken) {
        return NextResponse.json({ error: 'Thiếu Google ID Token.' }, { status: 400 });
      }
      const verified = await verifyGoogleCredential(body.idToken);
      const accessToken = getGoogleAccessTokenFromRequest(req);

      let workspaceAuth: Awaited<ReturnType<typeof signInWithGoogleToWorkspace>> | null = null;
      if (body.spreadsheetId && accessToken) {
        workspaceAuth = await signInWithGoogleToWorkspace(body.spreadsheetId, accessToken, verified);
      }

      const res = NextResponse.json({
        success: true,
        sessionUser: verified,
        ...(workspaceAuth || {}),
      });
      setSessionCookie(res, verified, https);
      return res;
    }

    if (body.action === 'bootstrapAdmin') {
      const session = validateSession(req);
      if (!session) {
        return NextResponse.json({ error: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });
      }
      const accessToken = getGoogleAccessTokenFromRequest(req);
      if (!body.spreadsheetId || !accessToken) {
        return NextResponse.json({ error: 'Thiếu spreadsheetId hoặc Google Access Token.' }, { status: 400 });
      }
      const adminUser = await bootstrapInitialAdmin(body.spreadsheetId, accessToken, session);
      return NextResponse.json({
        success: true,
        user: adminUser,
        accountStatus: adminUser.accountStatus,
      });
    }

    return NextResponse.json({ error: 'Action xác thực không hợp lệ.' }, { status: 400 });
  } catch (err: unknown) {
    const e = err as ServiceError & { status?: number };
    return NextResponse.json(
      { error: e.message || 'Xác thực Google thất bại.' },
      { status: e.status || 401 }
    );
  }
}
