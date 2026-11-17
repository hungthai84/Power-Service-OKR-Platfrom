'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  UserCheck,
  Search,
  CheckCircle2,
  XCircle,
  Save,
  Lock,
  PlayCircle,
  History,
  X,
  AlertTriangle,
} from 'lucide-react';
import { formatLocaleDate } from '@/lib/okr-engine';
import type {
  AccountStatus,
  DatabaseState,
  Lang,
  OkrUser,
  UserRole,
} from '@/types/okr';

interface UserApprovalViewProps {
  lang: Lang;
  db: DatabaseState;
  currentUser: OkrUser;
  onApproveUser: (payload: Record<string, unknown>) => Promise<void>;
  onSaveDraft: (payload: Record<string, unknown>) => Promise<void>;
  onRejectUser: (userId: string, reason: string) => Promise<void>;
  onSuspendUser: (userId: string, reason: string, nextStatus: 'SUSPENDED' | 'INACTIVE') => Promise<void>;
  onReactivateUser: (userId: string, reason: string) => Promise<void>;
}

const ROLE_OPTIONS: UserRole[] = ['ADMIN', 'OKR_ADMIN', 'EXECUTIVE', 'MANAGER', 'MEMBER', 'VIEWER'];

export default function UserApprovalView({
  lang,
  db,
  currentUser,
  onApproveUser,
  onSaveDraft,
  onRejectUser,
  onSuspendUser,
  onReactivateUser,
}: UserApprovalViewProps) {
  const isKo = lang === 'ko';
  const [statusFilter, setStatusFilter] = useState<'ALL' | AccountStatus>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [form, setForm] = useState<{
    displayNameVi: string;
    displayNameKo: string;
    employeeCode: string;
    jobTitleVi: string;
    jobTitleKo: string;
    role: UserRole;
    departmentId: string;
    teamId: string;
    managerId: string;
    startDate: string;
    accountStatus: AccountStatus;
    reason: string;
  }>({
    displayNameVi: '',
    displayNameKo: '',
    employeeCode: '',
    jobTitleVi: '',
    jobTitleKo: '',
    role: 'MEMBER',
    departmentId: '',
    teamId: '',
    managerId: '',
    startDate: '',
    accountStatus: 'PENDING',
    reason: '',
  });

  const activeDepartments = useMemo(
    () => db.departments.filter((d) => d.status !== 'DELETED'),
    [db.departments]
  );
  const activeTeams = useMemo(
    () => (db.teams || []).filter((t) => t.status !== 'DELETED'),
    [db.teams]
  );

  const counts = useMemo(() => {
    return {
      ALL: db.users.length,
      PENDING: db.users.filter((u) => u.accountStatus === 'PENDING').length,
      APPROVED: db.users.filter((u) => u.accountStatus === 'APPROVED').length,
      REJECTED: db.users.filter((u) => u.accountStatus === 'REJECTED').length,
      SUSPENDED: db.users.filter((u) => u.accountStatus === 'SUSPENDED').length,
      INACTIVE: db.users.filter((u) => u.accountStatus === 'INACTIVE').length,
    };
  }, [db.users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return db.users
      .filter((u) => {
        if (statusFilter !== 'ALL' && u.accountStatus !== statusFilter) return false;
        if (
          q &&
          !(u.displayNameVi || '').toLowerCase().includes(q) &&
          !(u.displayNameKo || '').toLowerCase().includes(q) &&
          !(u.email || '').toLowerCase().includes(q) &&
          !(u.employeeCode || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.accountStatus === 'PENDING' && b.accountStatus !== 'PENDING') return -1;
        if (b.accountStatus === 'PENDING' && a.accountStatus !== 'PENDING') return 1;
        return String(b.requestedAt || b.createdAt || '').localeCompare(
          String(a.requestedAt || a.createdAt || '')
        );
      });
  }, [db.users, statusFilter, searchQuery]);

  const selectedUser = useMemo(
    () => db.users.find((u) => u.userId === selectedUserId) || null,
    [db.users, selectedUserId]
  );

  const openApprovalForm = (u: OkrUser) => {
    setSelectedUserId(u.userId);
    setFormError('');
    setRejectModalOpen(false);
    setRejectReason('');
    setForm({
      displayNameVi: u.displayNameVi || '',
      displayNameKo: u.displayNameKo || u.displayNameVi || '',
      employeeCode: u.employeeCode || '',
      jobTitleVi: u.jobTitleVi || '',
      jobTitleKo: u.jobTitleKo || u.jobTitleVi || '',
      role: u.role || 'MEMBER',
      departmentId: u.departmentId || activeDepartments[0]?.departmentId || '',
      teamId: u.teamId || '',
      managerId: u.managerId || '',
      startDate: u.startDate || new Date().toISOString().slice(0, 10),
      accountStatus: u.accountStatus,
      reason: '',
    });
  };

  // Teams strictly filtered by chosen department
  const teamsForSelectedDept = useMemo(
    () => activeTeams.filter((t) => t.departmentId === form.departmentId),
    [activeTeams, form.departmentId]
  );

  // Eligible direct managers: APPROVED with management/leadership role, not self, same/parent dept or exec
  const eligibleManagers = useMemo(() => {
    const selectedDept = activeDepartments.find((d) => d.departmentId === form.departmentId);
    return db.users.filter((u) => {
      if (u.userId === selectedUserId) return false;
      if (u.accountStatus !== 'APPROVED') return false;
      if (!['ADMIN', 'OKR_ADMIN', 'EXECUTIVE', 'MANAGER'].includes(u.role)) return false;
      if (['ADMIN', 'OKR_ADMIN', 'EXECUTIVE'].includes(u.role)) return true;
      if (u.departmentId === form.departmentId) return true;
      if (selectedDept?.parentDepartmentId && u.departmentId === selectedDept.parentDepartmentId) {
        return true;
      }
      return false;
    });
  }, [db.users, selectedUserId, form.departmentId, activeDepartments]);

  const statusLabel = (st: AccountStatus) => {
    const map: Record<AccountStatus, { vi: string; ko: string; cls: string }> = {
      PENDING: {
        vi: 'Chờ phê duyệt',
        ko: '승인 대기',
        cls: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
      },
      APPROVED: {
        vi: 'Đã phê duyệt',
        ko: '승인 완료',
        cls: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
      },
      REJECTED: {
        vi: 'Bị từ chối',
        ko: '승인 거부',
        cls: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
      },
      SUSPENDED: {
        vi: 'Đang khóa',
        ko: '정지',
        cls: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
      },
      INACTIVE: {
        vi: 'Không hoạt động',
        ko: '비활성',
        cls: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
      },
    };
    const item = map[st] || map.PENDING;
    return (
      <span className={`inline-block px-2.5 py-1 rounded-[12px] border text-[11px] font-bold whitespace-nowrap ${item.cls}`}>
        {isKo ? item.ko : item.vi}
      </span>
    );
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setFormError('');
    if (
      !form.displayNameVi.trim() ||
      !form.employeeCode.trim() ||
      !form.jobTitleVi.trim() ||
      !form.departmentId
    ) {
      setFormError(
        isKo
          ? '이름, 사번, 직함, 부서를 모두 입력해 주세요.'
          : 'Vui lòng nhập đầy đủ: Họ tên hiển thị, Mã nhân viên, Chức danh và Phòng ban.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await onApproveUser({
        userId: selectedUser.userId,
        ...form,
      });
      setSelectedUserId(null);
    } catch (err: unknown) {
      const er = err as Error;
      setFormError(er.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraftClick = async () => {
    if (!selectedUser) return;
    setFormError('');
    setSubmitting(true);
    try {
      await onSaveDraft({
        userId: selectedUser.userId,
        ...form,
      });
    } catch (err: unknown) {
      const er = err as Error;
      setFormError(er.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!selectedUser) return;
    if (!rejectReason.trim()) {
      setFormError(
        isKo ? '거부 사유를 입력해 주세요.' : 'Vui lòng nhập lý do từ chối trước khi xác nhận.'
      );
      return;
    }
    setSubmitting(true);
    try {
      await onRejectUser(selectedUser.userId, rejectReason.trim());
      setRejectModalOpen(false);
      setSelectedUserId(null);
    } catch (err: unknown) {
      const er = err as Error;
      setFormError(er.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500';
  const labelCls = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">
              {isKo ? '인사 및 계정 승인 관리' : 'Quản lý Nhân sự & Phê duyệt Tài khoản'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
            {isKo
              ? '신규 Google 가입자의 부서·팀·직속 관리자·역할을 배정하고 계정 상태를 승인/관리합니다.'
              : 'Xem xét yêu cầu đăng ký Google mới, gán phòng ban, nhóm, quản lý trực tiếp và vai trò trước khi kích hoạt.'}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="glass-surface glass-tint-violet p-4 rounded-[12px] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: 'ALL', labelVi: 'Tất cả', labelKo: '전체' },
              { key: 'PENDING', labelVi: 'Chờ duyệt', labelKo: '승인 대기' },
              { key: 'APPROVED', labelVi: 'Đã phê duyệt', labelKo: '승인 완료' },
              { key: 'REJECTED', labelVi: 'Đã từ chối', labelKo: '승인 거부' },
              { key: 'SUSPENDED', labelVi: 'Đang khóa', labelKo: '정지' },
              { key: 'INACTIVE', labelVi: 'Ngừng hoạt động', labelKo: '비활성' },
            ] as const
          ).map((f) => {
            const active = statusFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setStatusFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-[999px] text-xs font-bold whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                    : 'bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'
                }`}
              >
                {isKo ? f.labelKo : f.labelVi} ({counts[f.key]})
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isKo ? '이름 또는 이메일 검색...' : 'Tìm theo họ tên, email, mã NV...'}
            className="w-full pl-9 pr-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200/80 dark:border-slate-700 text-xs outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Main Layout: Table + Detail Form */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div
          className={`${
            selectedUser ? 'xl:col-span-6' : 'xl:col-span-12'
          } glass-surface p-5 rounded-[12px] overflow-x-auto`}
        >
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <th className="p-3 font-bold">{isKo ? 'Google 계정' : 'Nhân sự Google'}</th>
                <th className="p-3 font-bold">{isKo ? '등록 일시' : 'Thời điểm đăng ký'}</th>
                <th className="p-3 font-bold">{isKo ? '부서 / 역할' : 'Phòng ban / Vai trò'}</th>
                <th className="p-3 font-bold">{isKo ? '상태' : 'Trạng thái'}</th>
                <th className="p-3 font-bold text-right">{isKo ? '작업' : 'Thao tác'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 dark:text-slate-400">
                    {isKo ? '해당 조건의 사용자가 없습니다.' : 'Không có hồ sơ nào phù hợp với bộ lọc.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const dept = db.departments.find((d) => d.departmentId === u.departmentId);
                  const regTime = u.requestedAt || u.createdAt || '';
                  return (
                    <tr
                      key={u.userId}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        selectedUserId === u.userId ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                      }`}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {u.avatarUrl ? (
                            <Image
                              src={u.avatarUrl}
                              alt={u.displayNameVi}
                              width={34}
                              height={34}
                              referrerPolicy="no-referrer"
                              className="w-8.5 h-8.5 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <span className="w-8.5 h-8.5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {(u.displayNameVi || u.email).slice(0, 2).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">
                              {isKo ? u.displayNameKo || u.displayNameVi : u.displayNameVi}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">
                        {regTime ? (
                          <div>
                            <p className="font-medium">{formatLocaleDate(regTime, lang)}</p>
                            <p className="text-[11px] text-slate-400">
                              {new Date(regTime).toLocaleTimeString(isKo ? 'ko-KR' : 'vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">{u.role}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                          {dept ? (isKo ? dept.nameKo || dept.nameVi : dept.nameVi) : 'Chưa gán'}
                        </p>
                      </td>
                      <td className="p-3">{statusLabel(u.accountStatus)}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => openApprovalForm(u)}
                          className="px-3.5 py-1.5 rounded-[999px] bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-bold text-xs whitespace-nowrap shadow-xs"
                        >
                          {u.accountStatus === 'PENDING'
                            ? isKo
                              ? '검토 및 승인'
                              : 'Phê duyệt'
                            : isKo
                            ? '상세 관리'
                            : 'Chi tiết'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Approval Detail & Configuration Panel (B2 & B3) */}
        {selectedUser && (
          <div className="xl:col-span-6 glass-surface glass-tint-blue p-5 sm:p-6 rounded-[12px] space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-slate-700">
              <div className="flex items-center gap-3 min-w-0">
                {selectedUser.avatarUrl ? (
                  <Image
                    src={selectedUser.avatarUrl}
                    alt={selectedUser.displayNameVi}
                    width={44}
                    height={44}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-[12px] object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-[12px] bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0">
                    {(selectedUser.displayNameVi || selectedUser.email).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {isKo ? '직원 계정 승인 및 조직 배정' : 'Hồ sơ Phê duyệt & Phân bổ Tổ chức'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Google Sub: <span className="font-mono">{selectedUser.googleSub || '--'}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="p-2 rounded-[999px] text-slate-500 hover:bg-white/70 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-[12px] bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleApproveSubmit} className="space-y-3.5">
              {/* 1 & 2: Display Name + Google Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    1. {isKo ? '표시 이름 (VI) *' : 'Họ tên hiển thị (VI) *'}
                  </label>
                  <input
                    required
                    value={form.displayNameVi}
                    onChange={(e) => setForm((p) => ({ ...p, displayNameVi: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {isKo ? '표시 이름 (KO)' : 'Họ tên hiển thị (KO)'}
                  </label>
                  <input
                    value={form.displayNameKo}
                    onChange={(e) => setForm((p) => ({ ...p, displayNameKo: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    2. {isKo ? 'Google 이메일 (검증됨)' : 'Email Google (Đã xác thực)'}
                  </label>
                  <input
                    readOnly
                    value={selectedUser.email}
                    className={`${inputCls} opacity-75 cursor-not-allowed`}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    3. {isKo ? '사번 *' : 'Mã nhân viên *'}
                  </label>
                  <input
                    required
                    placeholder="VD: EMP-012"
                    value={form.employeeCode}
                    onChange={(e) => setForm((p) => ({ ...p, employeeCode: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* 4: Job Title */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    4. {isKo ? '직함 (VI) *' : 'Chức danh (VI) *'}
                  </label>
                  <input
                    required
                    placeholder="VD: Chuyên viên Kinh doanh"
                    value={form.jobTitleVi}
                    onChange={(e) => setForm((p) => ({ ...p, jobTitleVi: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    {isKo ? '직함 (KO)' : 'Chức danh (KO)'}
                  </label>
                  <input
                    placeholder="예: 영업 매니저"
                    value={form.jobTitleKo}
                    onChange={(e) => setForm((p) => ({ ...p, jobTitleKo: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* 5 & 6: Role + Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    5. {isKo ? '시스템 역할 *' : 'Vai trò trong hệ thống *'}
                  </label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                    className={inputCls}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    6. {isKo ? '소속 부서 *' : 'Phòng ban *'}
                  </label>
                  <select
                    required
                    value={form.departmentId}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        departmentId: e.target.value,
                        teamId: '',
                      }))
                    }
                    className={inputCls}
                  >
                    <option value="">{isKo ? '-- 부서 선택 --' : '-- Chọn Phòng ban --'}</option>
                    {activeDepartments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {isKo ? d.nameKo || d.nameVi : d.nameVi}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 7 & 8: Team (filtered by department) + Direct Manager */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    7. {isKo ? '소속 팀 (부서 연동)' : 'Nhóm (Theo phòng ban đã chọn)'}
                  </label>
                  <select
                    value={form.teamId}
                    onChange={(e) => setForm((p) => ({ ...p, teamId: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">
                      {teamsForSelectedDept.length === 0
                        ? isKo
                          ? '-- 등록된 팀 없음 --'
                          : '-- Chưa có nhóm trực thuộc --'
                        : isKo
                        ? '-- 팀 선택 (선택 사항) --'
                        : '-- Chọn Nhóm --'}
                    </option>
                    {teamsForSelectedDept.map((tm) => (
                      <option key={tm.teamId} value={tm.teamId}>
                        {isKo ? tm.nameKo || tm.nameVi : tm.nameVi}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>
                    8. {isKo ? '직속 관리자' : 'Người quản lý trực tiếp'}
                  </label>
                  <select
                    value={form.managerId}
                    onChange={(e) => setForm((p) => ({ ...p, managerId: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="">
                      {isKo ? '-- 최상위 / 없음 --' : '-- Không có / Báo cáo cấp cao nhất --'}
                    </option>
                    {eligibleManagers.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {(isKo ? m.displayNameKo || m.displayNameVi : m.displayNameVi)} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 9 & 10: Start Date + Account Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    9. {isKo ? '입사 / 시작일' : 'Ngày bắt đầu làm việc'}
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    10. {isKo ? '현재 계정 상태' : 'Trạng thái tài khoản hiện tại'}
                  </label>
                  <div className="py-2">{statusLabel(selectedUser.accountStatus)}</div>
                </div>
              </div>

              <div>
                <label className={labelCls}>
                  {isKo ? '승인 / 변경 메모' : 'Ghi chú phê duyệt / điều chuyển'}
                </label>
                <input
                  value={form.reason}
                  onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder={isKo ? '예: 4분기 신규 입사 승인' : 'VD: Phê duyệt nhân sự mới Q4'}
                  className={inputCls}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-700">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-[999px] bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isKo ? 'Approve · 승인' : 'Approve · Phê duyệt'}</span>
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveDraftClick}
                  className="px-4 py-2 rounded-[999px] bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isKo ? 'Save Draft · 임시 저장' : 'Save Draft · Lưu cấu hình'}</span>
                </button>

                {selectedUser.userId !== currentUser.userId && (
                  <>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setRejectModalOpen((v) => !v)}
                      className="px-4 py-2 rounded-[999px] bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{isKo ? 'Reject · 거부' : 'Reject · Từ chối'}</span>
                    </button>

                    {selectedUser.accountStatus === 'APPROVED' ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          onSuspendUser(
                            selectedUser.userId,
                            form.reason || 'Suspended by Admin',
                            'SUSPENDED'
                          ).then(() => setSelectedUserId(null))
                        }
                        className="px-4 py-2 rounded-[999px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{isKo ? '계정 정지' : 'Khóa tài khoản'}</span>
                      </button>
                    ) : selectedUser.accountStatus === 'SUSPENDED' ||
                      selectedUser.accountStatus === 'INACTIVE' ||
                      selectedUser.accountStatus === 'REJECTED' ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() =>
                          onReactivateUser(
                            selectedUser.userId,
                            form.reason || 'Reactivated by Admin'
                          ).then(() => setSelectedUserId(null))
                        }
                        className="px-4 py-2 rounded-[999px] bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>{isKo ? '재활성화' : 'Kích hoạt lại'}</span>
                      </button>
                    ) : null}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="px-4 py-2 rounded-[999px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  {isKo ? 'Cancel · 취소' : 'Cancel · Hủy'}
                </button>
              </div>
            </form>

            {/* Rejection Reason Confirmation Panel */}
            {rejectModalOpen && (
              <div className="p-4 rounded-[12px] glass-surface glass-tint-pink space-y-2.5">
                <p className="text-xs font-bold text-rose-800 dark:text-rose-200">
                  {isKo ? '계정 거부 사유 입력 (필수)' : 'Nhập lý do từ chối tài khoản (Bắt buộc)'}
                </p>
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={
                    isKo
                      ? '예: 사내 도메인 계정이 아니거나 등록 정보가 불일치합니다.'
                      : 'VD: Email không thuộc nhân sự công ty hoặc chưa xác minh thông tin.'
                  }
                  className={inputCls}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleRejectConfirm}
                    className="px-4 py-1.5 rounded-[999px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                  >
                    {isKo ? '거부 확정' : 'Xác nhận Từ chối'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectModalOpen(false)}
                    className="px-4 py-1.5 rounded-[999px] bg-white/85 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  >
                    {isKo ? '닫기' : 'Đóng'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* APPROVAL_LOGS History */}
      <div className="glass-surface p-5 rounded-[12px] overflow-x-auto">
        <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>
            {isKo ? '계정 승인 이력 (APPROVAL_LOGS)' : 'Lịch sử Phê duyệt Tài khoản (APPROVAL_LOGS)'}
          </span>
        </h2>
        <table className="w-full text-left text-xs tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="p-2.5 font-bold">{isKo ? '시간' : 'Thời gian'}</th>
              <th className="p-2.5 font-bold">{isKo ? '대상자' : 'Nhân sự'}</th>
              <th className="p-2.5 font-bold">{isKo ? '작업' : 'Hành động'}</th>
              <th className="p-2.5 font-bold">{isKo ? '상태 변경' : 'Chuyển trạng thái'}</th>
              <th className="p-2.5 font-bold">{isKo ? '역할' : 'Vai trò'}</th>
              <th className="p-2.5 font-bold">{isKo ? '사유' : 'Lý do / Ghi chú'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
            {(db.approvalLogs || []).length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500 dark:text-slate-400">
                  {isKo ? '아직 기록된 승인 이력이 없습니다.' : 'Chưa có lịch sử phê duyệt.'}
                </td>
              </tr>
            ) : (
              (db.approvalLogs || []).slice(0, 30).map((log) => {
                const targetU = db.users.find((u) => u.userId === log.userId);
                return (
                  <tr key={log.approvalId}>
                    <td className="p-2.5 text-slate-500 whitespace-nowrap">
                      {formatLocaleDate(log.createdAt, lang)}
                    </td>
                    <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                      {targetU
                        ? isKo
                          ? targetU.displayNameKo || targetU.displayNameVi
                          : targetU.displayNameVi
                        : log.userId}
                    </td>
                    <td className="p-2.5 font-bold text-indigo-600 dark:text-indigo-400">{log.action}</td>
                    <td className="p-2.5 whitespace-nowrap">
                      {log.previousStatus} → <strong>{log.newStatus}</strong>
                    </td>
                    <td className="p-2.5 font-bold">{log.assignedRole}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300 break-words max-w-xs">
                      {log.reason || '--'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
