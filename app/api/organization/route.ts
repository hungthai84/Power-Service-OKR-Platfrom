import { NextRequest, NextResponse } from 'next/server';
import {
  assertCsrfHeader,
  getGoogleAccessTokenFromRequest,
  validateSession,
} from '@/lib/server-google-auth';
import {
  assignManager,
  createDepartment,
  createTeam,
  deleteDepartment,
  getDepartments,
  getEmployeeProfile,
  getManagerHierarchy,
  getOrganizationHistory,
  getOrganizationTree,
  getTeams,
  ServiceError,
  transferEmployee,
  updateDepartment,
  updateReportingLine,
  updateTeam,
} from '@/lib/okr-backend-service';

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
  const action = searchParams.get('action') || 'getOrganizationTree';
  const spreadsheetId = searchParams.get('spreadsheetId');
  const userId = searchParams.get('userId') || '';
  const managerId = searchParams.get('managerId') || '';

  if (!spreadsheetId) {
    return NextResponse.json({ error: 'Thiếu spreadsheetId.' }, { status: 400 });
  }

  try {
    if (action === 'getDepartments') {
      const departments = await getDepartments(spreadsheetId, accessToken, session);
      return NextResponse.json({ success: true, departments });
    }
    if (action === 'getTeams') {
      const teams = await getTeams(spreadsheetId, accessToken, session);
      return NextResponse.json({ success: true, teams });
    }
    if (action === 'getEmployeeProfile' && userId) {
      const profile = await getEmployeeProfile(spreadsheetId, accessToken, session, userId);
      return NextResponse.json({ success: true, ...profile });
    }
    if (action === 'getManagerHierarchy' && managerId) {
      const hierarchy = await getManagerHierarchy(spreadsheetId, accessToken, session, managerId);
      return NextResponse.json({ success: true, ...hierarchy });
    }
    if (action === 'getOrganizationHistory') {
      const history = await getOrganizationHistory(spreadsheetId, accessToken, session);
      return NextResponse.json({ success: true, history });
    }

    const tree = await getOrganizationTree(spreadsheetId, accessToken, session);
    return NextResponse.json({ success: true, ...tree });
  } catch (err: unknown) {
    const e = err as ServiceError;
    return NextResponse.json(
      { error: e.message || 'Lỗi tải dữ liệu sơ đồ tổ chức.', code: e.code },
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

    if (action === 'createDepartment') {
      const res = await createDepartment(spreadsheetId, accessToken, session, body);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'updateDepartment') {
      const res = await updateDepartment(spreadsheetId, accessToken, session, body);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'deleteDepartment') {
      const res = await deleteDepartment(spreadsheetId, accessToken, session, body.departmentId);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'createTeam') {
      const res = await createTeam(spreadsheetId, accessToken, session, body);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'updateTeam') {
      const res = await updateTeam(spreadsheetId, accessToken, session, body);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'assignManager') {
      const res = await assignManager(spreadsheetId, accessToken, session, body.userId, body.managerId, body.reason);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'transferEmployee') {
      const res = await transferEmployee(spreadsheetId, accessToken, session, body);
      return NextResponse.json({ success: true, ...res });
    }
    if (action === 'updateReportingLine') {
      const res = await updateReportingLine(
        spreadsheetId,
        accessToken,
        session,
        body.userId,
        body.newManagerId,
        body.reason
      );
      return NextResponse.json({ success: true, ...res });
    }

    return NextResponse.json({ error: 'Action tổ chức không hợp lệ.' }, { status: 400 });
  } catch (err: unknown) {
    const e = err as ServiceError;
    return NextResponse.json(
      { error: e.message || 'Lỗi cập nhật cơ cấu tổ chức.', code: e.code },
      { status: e.status || 500 }
    );
  }
}
