'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  Target,
  ShieldCheck,
  Clock,
  XCircle,
  Lock,
  PauseCircle,
  RefreshCw,
  LogOut,
  Sun,
  Moon,
  FolderKanban,
  HardDrive,
  ChevronDown,
  ChevronUp,
  UserCheck,
  AlertTriangle,
  Monitor,
} from 'lucide-react';
import { motion } from 'motion/react';
import GoogleSignInButton from './GoogleSignInButton';
import { formatLocaleDate } from '@/lib/okr-engine';
import type { AccountStatus, Lang, OkrUser, ThemeMode } from '@/types/okr';

interface AccountGateViewProps {
  mode: 'LOGIN' | 'STATUS_GATE';
  lang: Lang;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onSwitchLang: (lang: Lang) => void;
  // Login props
  onGoogleLogin: () => void;
  isLoggingIn: boolean;
  authError: string;
  customSpreadsheetInput: string;
  setCustomSpreadsheetInput: (val: string) => void;
  // User / Status Gate props
  signedInEmail?: string;
  signedInName?: string;
  signedInAvatar?: string;
  accountStatus?: AccountStatus | 'UNREGISTERED' | 'NO_SHEET';
  userRecord?: OkrUser | null;
  canOwnerBootstrap?: boolean;
  onBootstrapOwnerAdmin?: () => void;
  onRefreshStatus?: () => void;
  onLogout: () => void;
  isBusy?: boolean;
}

export default function AccountGateView({
  mode,
  lang,
  theme,
  onToggleTheme,
  onSwitchLang,
  onGoogleLogin,
  isLoggingIn,
  authError,
  customSpreadsheetInput,
  setCustomSpreadsheetInput,
  signedInEmail,
  signedInName,
  signedInAvatar,
  accountStatus,
  userRecord,
  canOwnerBootstrap,
  onBootstrapOwnerAdmin,
  onRefreshStatus,
  onLogout,
  isBusy = false,
}: AccountGateViewProps) {
  const [showOrgSheetInput, setShowOrgSheetInput] = useState(Boolean(customSpreadsheetInput));
  const [avatarErr, setAvatarErr] = useState(false);

  const isKo = lang === 'ko';

  const statusMeta: Record<
    string,
    {
      title: string;
      desc: string;
      badgeText: string;
      toneCls: string;
      Icon: React.ComponentType<{ className?: string }>;
    }
  > = {
    PENDING: {
      title: isKo ? '관리자 승인을 기다리고 있습니다' : 'Tài khoản đang chờ Quản trị viên phê duyệt',
      desc: isKo
        ? 'Google 계정이 안전하게 인증되어 승인 대기(PENDING) 상태로 등록되었습니다. 관리자가 부서, 팀, 직속 관리자 및 역할을 배정하고 승인할 때까지 대시보드 접근이 제한됩니다.'
        : 'Tài khoản Google của bạn đã được xác thực hợp lệ và ghi nhận ở trạng thái Chờ phê duyệt (PENDING). Bạn chưa thể truy cập Dashboard hay dữ liệu OKR cho đến khi Quản trị viên phân công phòng ban, nhóm và phê duyệt.',
      badgeText: isKo ? '승인 대기 (PENDING)' : 'Chờ phê duyệt (PENDING)',
      toneCls: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
      Icon: Clock,
    },
    REJECTED: {
      title: isKo ? '계정 승인이 거부되었습니다' : 'Yêu cầu kích hoạt tài khoản đã bị từ chối',
      desc: isKo
        ? '관리자가 귀하의 액세스 요청을 거부했습니다. 아래 사유를 확인하고 관리자에게 문의해 주세요.'
        : 'Quản trị viên đã từ chối yêu cầu truy cập của tài khoản này. Hệ thống không tự động tạo lại hồ sơ mới; vui lòng xem lý do bên dưới và liên hệ Quản trị viên.',
      badgeText: isKo ? '승인 거부 (REJECTED)' : 'Bị từ chối (REJECTED)',
      toneCls: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
      Icon: XCircle,
    },
    SUSPENDED: {
      title: isKo ? '계정이 정지되었습니다' : 'Tài khoản đang bị tạm khóa',
      desc: isKo
        ? '보안 또는 인사 정책에 의해 계정 사용이 정지되었습니다. 관리자에게 재활성화를 요청해 주세요.'
        : 'Tài khoản của bạn hiện đang bị khóa (SUSPENDED) và từ chối truy cập dữ liệu doanh nghiệp. Vui lòng liên hệ Quản trị viên để được hỗ trợ.',
      badgeText: isKo ? '정지 (SUSPENDED)' : 'Đang khóa (SUSPENDED)',
      toneCls: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
      Icon: Lock,
    },
    INACTIVE: {
      title: isKo ? '계정이 비활성 상태입니다' : 'Tài khoản đang ngừng hoạt động',
      desc: isKo
        ? '관리자에 의해 다시 활성화될 때까지 시스템을 사용할 수 없습니다.'
        : 'Tài khoản hiện ở trạng thái Không hoạt động (INACTIVE) và không thể sử dụng hệ thống cho đến khi Quản trị viên kích hoạt lại.',
      badgeText: isKo ? '비활성 (INACTIVE)' : 'Không hoạt động (INACTIVE)',
      toneCls: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
      Icon: PauseCircle,
    },
  };

  const themeLabel =
    theme === 'system'
      ? isKo
        ? '시스템'
        : 'Hệ thống'
      : theme === 'dark'
      ? isKo
        ? '다크'
        : 'Tối'
      : isKo
      ? '라이트'
      : 'Sáng';

  return (
    <div className="min-h-screen glass-canvas text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-8 transition-colors">
      {/* Top Minimal Utility Bar */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-[12px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
            Flow<span className="text-indigo-600 dark:text-indigo-400">OKR</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 glass-surface rounded-[999px] p-1">
            <button
              type="button"
              onClick={() => onSwitchLang('vi')}
              className={`px-3 py-1 rounded-[999px] text-xs font-bold whitespace-nowrap transition-colors ${
                lang === 'vi'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              Tiếng Việt
            </button>
            <button
              type="button"
              onClick={() => onSwitchLang('ko')}
              className={`px-3 py-1 rounded-[999px] text-xs font-bold whitespace-nowrap transition-colors ${
                lang === 'ko'
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
              }`}
            >
              한국어
            </button>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            className="px-3 py-2 rounded-[999px] glass-surface text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/90 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
            aria-label="Chuyển chế độ giao diện Hệ thống / Sáng / Tối"
            title={themeLabel}
          >
            {theme === 'system' ? (
              <Monitor className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            ) : theme === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-cyan-400" />
            )}
            <span className="hidden sm:inline">{themeLabel}</span>
          </button>
        </div>
      </div>

      {mode === 'LOGIN' ? (
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="max-w-5xl w-full mx-auto my-6 glass-surface rounded-[12px] p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
        >
          <div className="lg:col-span-7 space-y-4 min-w-0">
            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              {isKo
                ? 'Google 계정 보안 인증 · 승인 워크플로우 · 동적 조직도'
                : 'Xác thực Google Identity · Phê duyệt Nhân sự · Sơ đồ Tổ chức'}
            </p>
            <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
              {isKo
                ? 'Google 계정으로 로그인하여 FlowOKR 기업 워크스페이스에 접속하세요'
                : 'Đăng nhập bằng tài khoản Google để truy cập Hệ thống Quản trị FlowOKR'}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              {isKo
                ? 'Google 계정의 고유 식별자(sub)와 이메일 검증을 통해 안전하게 인증됩니다. 신규 직원은 관리자 승인 후 부서 및 직속 관리자가 배정되어 OKR·프로젝트·조직도에 즉시 반영됩니다.'
                : 'Hệ thống chỉ sử dụng xác thực Google chính thức (Google Identity Services). Nhân sự đăng ký mới sẽ đi qua quy trình phê duyệt, phân bổ phòng ban, nhóm và quản lý trực tiếp trước khi truy cập dữ liệu OKR.'}
            </p>

            {/* Optional Organization Shared Spreadsheet ID / URL */}
            <div className="rounded-[12px] glass-surface p-3.5 space-y-2">
              <button
                type="button"
                onClick={() => setShowOrgSheetInput((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-[999px] hover:bg-white/60 dark:hover:bg-slate-800/60 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span className="text-left">
                  {isKo
                    ? '회사 공용 Google Sheet ID 연결 (선택 사항 · 팀원 접속용)'
                    : 'Kết nối Google Sheet chung của Doanh nghiệp (Tùy chọn cho nhân viên)'}
                </span>
                {showOrgSheetInput ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
              </button>
              {showOrgSheetInput && (
                <div className="space-y-1.5 pt-1">
                  <input
                    type="text"
                    value={customSpreadsheetInput}
                    onChange={(e) => setCustomSpreadsheetInput(e.target.value)}
                    placeholder={
                      isKo
                        ? 'Google Sheets URL 또는 Spreadsheet ID를 입력하세요'
                        : 'Dán link Google Sheets hoặc Spreadsheet ID của công ty (nếu có)'
                    }
                    className="w-full px-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-900/85 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isKo
                      ? '비워 두면 내 Google Drive의 FlowOKR_Workspace 폴더에서 자동으로 시트를 찾습니다.'
                      : 'Nếu để trống, hệ thống sẽ tự tìm bảng tính trong thư mục FlowOKR_Workspace trên Google Drive của bạn.'}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-4">
              <GoogleSignInButton
                onClick={onGoogleLogin}
                disabled={isLoggingIn}
                label={
                  isLoggingIn
                    ? isKo
                      ? 'Google 인증 확인 중...'
                      : 'Đang xác thực Google...'
                    : 'Sign in with Google'
                }
              />
            </div>

            {signedInEmail && (
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {isKo ? '이전 로그인 계정: ' : 'Tài khoản vừa đăng nhập: '}
                <strong>{signedInEmail}</strong> —{' '}
                {isKo
                  ? '위 버튼을 눌러 Google Drive 및 Sheets 액세스 세션을 갱신하세요.'
                  : 'nhấn Sign in with Google để xác thực lại phiên làm việc.'}
              </p>
            )}

            {authError && (
              <div className="p-3.5 rounded-[12px] bg-rose-50/90 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words">{authError}</span>
              </div>
            )}

            {/* Login Instructions & Security Notice */}
            <div className="p-4 rounded-[12px] glass-surface glass-tint-cyan space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-800 dark:text-cyan-300">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  {isKo ? '보안 및 로그인 안내' : 'Hướng dẫn đăng nhập & Cam kết bảo mật'}
                </span>
              </div>
              <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-disc list-inside">
                <li>
                  {isKo
                    ? 'ID Token은 HTTPS를 통해 서버에서 암호화 서명, 발급자(Issuer), 대상(Audience), 만료 시간 및 이메일 인증 여부를 검증합니다.'
                    : 'ID Token được gửi qua HTTPS về máy chủ để xác minh chữ ký số, Issuer, Audience, thời hạn và email đã xác minh.'}
                </li>
                <li>
                  {isKo
                    ? 'Google Access Token 및 ID Token은 Google Sheets에 절대 저장되지 않습니다.'
                    : 'Hệ thống tuyệt đối không lưu Google Access Token, ID Token hay mật khẩu vào Google Sheets.'}
                </li>
                <li>
                  {isKo
                    ? '최초 가입 사용자는 승인 대기(PENDING) 상태로 등록되며, 관리자 승인 후 권한이 부여됩니다.'
                    : 'Người dùng mới mặc định ở trạng thái PENDING và chỉ được truy cập Dashboard sau khi Admin phê duyệt.'}
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3 min-w-0">
            <div className="p-4 rounded-[12px] glass-surface glass-tint-violet space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[12px] bg-violet-500/15 dark:bg-violet-400/20 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4 text-violet-600 dark:text-violet-300" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isKo ? 'Google 인증 및 승인 워크플로우' : 'Xác thực Google & Phê duyệt Tài khoản'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {isKo
                  ? 'Google sub 기반 고정 식별자, 승인 대기 화면, 거절/정지 제어 및 모든 권한 부여 감사 로그를 제공합니다.'
                  : 'Định danh ổn định bằng Google sub, quy trình Admin duyệt & gán Phòng ban/Nhóm/Quản lý trước khi kích hoạt.'}
              </p>
            </div>
            <div className="p-4 rounded-[12px] glass-surface glass-tint-emerald space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[12px] bg-emerald-500/15 dark:bg-emerald-400/20 flex items-center justify-center shrink-0">
                  <FolderKanban className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isKo ? '동적 조직도 및 OKR 연계' : 'Sơ đồ Tổ chức Động & Liên kết OKR'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {isKo
                  ? '회사 → 본부 → 부서 → 팀 → 구성원 계층 트리와 부서 카드에서 OKR 진행률 및 체크인 상태를 실시간 탐색합니다.'
                  : 'Trực quan hóa cây Công ty → Khối → Phòng ban → Nhóm → Nhân sự, liên kết trực tiếp Objective, KR và Check-in.'}
              </p>
            </div>
            <div className="p-4 rounded-[12px] glass-surface glass-tint-blue space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[12px] bg-blue-500/15 dark:bg-blue-400/20 flex items-center justify-center shrink-0">
                  <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-300" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {isKo ? 'Google Drive & Sheets 실시간 DB' : 'Lưu trữ Google Drive & Google Sheets'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {isKo
                  ? 'USERS, APPROVAL_LOGS, ORGANIZATION_HISTORY, DEPARTMENTS, TEAMS 및 OKR 시트가 실시간 동기화됩니다.'
                  : 'Đồng bộ 15 tab dữ liệu chuẩn doanh nghiệp trên Google Sheets thuộc toàn quyền sở hữu của bạn.'}
              </p>
            </div>
          </div>
        </motion.main>
      ) : (
        /* STATUS GATE (PENDING / REJECTED / SUSPENDED / INACTIVE) */
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full mx-auto my-8 glass-surface rounded-[12px] p-6 sm:p-8 space-y-6"
        >
          {(() => {
            const st = String(accountStatus || 'PENDING');
            const meta = statusMeta[st] || statusMeta.PENDING;
            const IconComp = meta.Icon;
            const avatar = userRecord?.avatarUrl || signedInAvatar;
            const displayName = userRecord?.displayNameVi || signedInName || signedInEmail || 'Google User';
            const displayEmail = userRecord?.email || signedInEmail || '';

            return (
              <>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {avatar && !avatarErr ? (
                      <Image
                        src={avatar}
                        alt={displayName}
                        width={52}
                        height={52}
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarErr(true)}
                        className="w-13 h-13 rounded-[12px] object-cover border border-white/70 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-13 h-13 rounded-[12px] bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shrink-0">
                        {displayName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {displayName}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {displayEmail}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1.5 rounded-[12px] border text-xs font-bold whitespace-nowrap ${meta.toneCls}`}>
                    {meta.badgeText}
                  </span>
                </div>

                <div className={`p-5 rounded-[12px] border space-y-2 ${meta.toneCls}`}>
                  <div className="flex items-center gap-2.5">
                    <IconComp className="w-5 h-5 shrink-0" />
                    <h1 className="text-lg font-bold">{meta.title}</h1>
                  </div>
                  <p className="text-xs sm:text-sm leading-relaxed opacity-90">{meta.desc}</p>
                </div>

                {userRecord && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-4 rounded-[12px] glass-surface">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">
                        {isKo ? '등록 일시' : 'Thời điểm đăng ký'}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {userRecord.requestedAt
                          ? `${formatLocaleDate(userRecord.requestedAt, lang)} · ${new Date(
                              userRecord.requestedAt
                            ).toLocaleTimeString(isKo ? 'ko-KR' : 'vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">
                        {isKo ? '계정 식별자 (User ID)' : 'Mã hồ sơ (User ID)'}
                      </span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        {userRecord.userId}
                      </span>
                    </div>
                  </div>
                )}

                {st === 'REJECTED' && userRecord?.rejectionReason && (
                  <div className="p-4 rounded-[12px] glass-surface glass-tint-pink space-y-1">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                      {isKo ? '거부 사유' : 'Lý do từ chối từ Quản trị viên'}:
                    </p>
                    <p className="text-sm text-rose-900 dark:text-rose-100 break-words">
                      {userRecord.rejectionReason}
                    </p>
                    <p className="text-xs text-rose-600 dark:text-rose-400 pt-1">
                      {isKo
                        ? '재검토가 필요한 경우 사내 인사팀 또는 시스템 관리자에게 직접 연락해 주세요.'
                        : 'Nếu có nhầm lẫn, vui lòng liên hệ Quản trị viên hoặc Phòng Nhân sự để được xem xét mở lại.'}
                    </p>
                  </div>
                )}

                {/* Verified Drive Owner Bootstrap Admin Option (Section B5) */}
                {st === 'PENDING' && canOwnerBootstrap && onBootstrapOwnerAdmin && (
                  <div className="p-4 rounded-[12px] glass-surface glass-tint-blue space-y-3">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                      <div className="space-y-1 min-w-0">
                        <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
                          {isKo
                            ? '워크스페이스 소유자 최초 관리자(ADMIN) 초기화'
                            : 'Xác minh Chủ sở hữu & Khởi tạo Quản trị viên Đầu tiên'}
                        </h3>
                        <p className="text-xs text-indigo-800 dark:text-indigo-200 leading-relaxed">
                          {isKo
                            ? '현재 데이터베이스에 승인된 ADMIN이 없으며, 귀하가 이 Google Sheets 파일의 Google Drive 실제 소유자로 확인되었습니다. 초기 관리자 계정을 활성화할 수 있습니다.'
                            : 'Hệ thống phát hiện bảng tính này chưa có Quản trị viên (ADMIN) nào và tài khoản của bạn đã được xác minh là Chủ sở hữu trực tiếp trên Google Drive. Nhấn nút dưới đây để hoàn tất kích hoạt Quản trị viên đầu tiên.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={onBootstrapOwnerAdmin}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-[999px] bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {isKo
                          ? '소유자 검증 및 초기 ADMIN 활성화'
                          : 'Xác minh Chủ sở hữu & Kích hoạt ADMIN'}
                      </span>
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                  {onRefreshStatus && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={onRefreshStatus}
                      className="px-5 py-2.5 rounded-[999px] bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-2 shadow-sm"
                    >
                      <RefreshCw className={`w-4 h-4 ${isBusy ? 'animate-spin' : ''}`} />
                      <span>
                        {isKo ? '승인 상태 다시 확인' : 'Kiểm tra trạng thái phê duyệt'}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onLogout}
                    className="px-5 py-2.5 rounded-[999px] glass-surface text-slate-700 dark:text-slate-200 hover:bg-white/90 dark:hover:bg-slate-800/90 text-xs font-bold flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{isKo ? 'Google 로그아웃' : 'Đăng xuất Google'}</span>
                  </button>
                </div>
              </>
            );
          })()}
        </motion.main>
      )}

      <footer className="max-w-5xl w-full mx-auto text-center text-xs text-slate-500 dark:text-slate-400">
        FlowOKR Enterprise ·{' '}
        {isKo
          ? 'Google 인증 및 Google Drive 개인/기업 시트 기반 보안 운영'
          : 'Bảo mật bằng Google Identity Services & Lưu trữ Google Drive'}
      </footer>
    </div>
  );
}
