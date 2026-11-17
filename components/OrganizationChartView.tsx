'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  Building2,
  Users,
  Network,
  LayoutGrid,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Search,
  Plus,
  Edit3,
  Trash2,
  ArrowRightLeft,
  Target,
  CheckCircle2,
  AlertTriangle,
  History,
  X,
  Layers,
  UserCheck,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';
import { formatLocaleDate } from '@/lib/okr-engine';
import type {
  DatabaseState,
  Department,
  Lang,
  OkrUser,
  Team,
} from '@/types/okr';

type OrgSubTab = 'org-chart' | 'directory' | 'departments' | 'teams' | 'history';

interface OrganizationChartViewProps {
  lang: Lang;
  db: DatabaseState;
  currentUser: OkrUser;
  onOrgAction: (payload: Record<string, unknown>, successMsg: string) => Promise<void>;
  onOpenObjectiveDetail?: (objectiveId: string) => void;
}

interface PendingTransferConfirm {
  userId: string;
  departmentId: string;
  teamId: string;
  managerId: string;
  jobTitleVi: string;
  jobTitleKo: string;
  effectiveDate: string;
  reason: string;
  summary: string;
}

export default function OrganizationChartView({
  lang,
  db,
  currentUser,
  onOrgAction,
  onOpenObjectiveDetail,
}: OrganizationChartViewProps) {
  const isKo = lang === 'ko';
  const isAdmin = currentUser.role === 'ADMIN';

  const [subTab, setSubTab] = useState<OrgSubTab>('org-chart');
  const [chartViewMode, setChartViewMode] = useState<'tree' | 'cards'>('tree');
  const [zoom, setZoom] = useState<number>(100);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDeptId, setFilterDeptId] = useState('ALL');
  const [filterTeamId, setFilterTeamId] = useState('ALL');
  const [filterManagerId, setFilterManagerId] = useState('ALL');
  const [filterTitle, setFilterTitle] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('APPROVED');
  const [focusUserId, setFocusUserId] = useState<string>('ALL');

  // Interactive Drawers (Employee Profile / Department OKR Detail)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);

  // Drag & Drop Confirmation Modal (D5)
  const [draggingUserId, setDraggingUserId] = useState<string | null>(null);
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransferConfirm | null>(null);
  const [transferError, setTransferError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Department & Team Form Modals
  const [deptForm, setDeptForm] = useState<Partial<Department> | null>(null);
  const [teamForm, setTeamForm] = useState<Partial<Team> | null>(null);
  const [deptDeleteConfirm, setDeptDeleteConfirm] = useState<Department | null>(null);

  const activeDepartments = useMemo(
    () =>
      db.departments
        .filter((d) => d.status !== 'DELETED')
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [db.departments]
  );

  const activeTeams = useMemo(
    () =>
      (db.teams || [])
        .filter((t) => t.status !== 'DELETED')
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [db.teams]
  );

  const uniqueTitles = useMemo(() => {
    const set = new Set<string>();
    db.users.forEach((u) => {
      const title = isKo ? u.jobTitleKo || u.jobTitleVi : u.jobTitleVi;
      if (title) set.add(title);
    });
    return Array.from(set);
  }, [db.users, isKo]);

  const managerUsers = useMemo(
    () =>
      db.users.filter(
        (u) =>
          u.accountStatus === 'APPROVED' &&
          ['ADMIN', 'OKR_ADMIN', 'EXECUTIVE', 'MANAGER'].includes(u.role)
      ),
    [db.users]
  );

  const visibleUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // If focusing on a specific employee & reporting chain
    let focusAllowedIds: Set<string> | null = null;
    if (focusUserId !== 'ALL') {
      focusAllowedIds = new Set<string>([focusUserId]);
      // Walk up managers
      let cursor = db.users.find((u) => u.userId === focusUserId)?.managerId;
      let guard = 0;
      while (cursor && guard < 50) {
        focusAllowedIds.add(cursor);
        cursor = db.users.find((u) => u.userId === cursor)?.managerId;
        guard++;
      }
      // Walk down direct/recursive reports
      const queue = [focusUserId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        db.users.forEach((u) => {
          if (u.managerId === curr && !focusAllowedIds!.has(u.userId)) {
            focusAllowedIds!.add(u.userId);
            queue.push(u.userId);
          }
        });
      }
    }

    return db.users.filter((u) => {
      if (filterStatus !== 'ALL' && u.accountStatus !== filterStatus) return false;
      if (filterDeptId !== 'ALL' && u.departmentId !== filterDeptId) return false;
      if (filterTeamId !== 'ALL' && u.teamId !== filterTeamId) return false;
      if (filterManagerId !== 'ALL' && u.managerId !== filterManagerId) return false;
      if (focusAllowedIds && !focusAllowedIds.has(u.userId)) return false;
      const title = isKo ? u.jobTitleKo || u.jobTitleVi : u.jobTitleVi;
      if (filterTitle !== 'ALL' && title !== filterTitle) return false;
      if (q) {
        const dept = activeDepartments.find((d) => d.departmentId === u.departmentId);
        const matchesUser =
          (u.displayNameVi || '').toLowerCase().includes(q) ||
          (u.displayNameKo || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.jobTitleVi || '').toLowerCase().includes(q) ||
          (u.employeeCode || '').toLowerCase().includes(q);
        const matchesDept =
          dept &&
          ((dept.nameVi || '').toLowerCase().includes(q) ||
            (dept.nameKo || '').toLowerCase().includes(q));
        if (!matchesUser && !matchesDept) return false;
      }
      return true;
    });
  }, [
    db.users,
    filterStatus,
    filterDeptId,
    filterTeamId,
    filterManagerId,
    filterTitle,
    focusUserId,
    searchQuery,
    activeDepartments,
    isKo,
  ]);

  const visibleDepartments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeDepartments.filter((d) => {
      if (filterDeptId !== 'ALL' && d.departmentId !== filterDeptId) return false;
      if (q) {
        const deptMatch =
          (d.nameVi || '').toLowerCase().includes(q) ||
          (d.nameKo || '').toLowerCase().includes(q) ||
          (d.division || '').toLowerCase().includes(q);
        const hasMatchingUser = visibleUsers.some((u) => u.departmentId === d.departmentId);
        return deptMatch || hasMatchingUser;
      }
      return true;
    });
  }, [activeDepartments, filterDeptId, searchQuery, visibleUsers]);

  const toggleNodeCollapse = (nodeId: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const expandAll = () => setCollapsedNodes({});

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    activeDepartments.forEach((d) => {
      next[`DEPT-${d.departmentId}`] = true;
    });
    activeTeams.forEach((t) => {
      next[`TEAM-${t.teamId}`] = true;
    });
    setCollapsedNodes(next);
  };

  // Helper: Check-in compliance & OKR metrics for a department or user
  const getDepartmentMetrics = (deptId: string) => {
    const members = db.users.filter(
      (u) => u.departmentId === deptId && u.accountStatus === 'APPROVED'
    );
    const teams = activeTeams.filter((t) => t.departmentId === deptId);
    const objs = db.objectives.filter((o) => !o.deletedAt && o.departmentId === deptId);
    const objIds = new Set(objs.map((o) => o.objectiveId));
    const krs = db.keyResults.filter((k) => !k.deletedAt && objIds.has(k.objectiveId));
    const avgProgress =
      objs.length > 0
        ? Math.round(objs.reduce((s, o) => s + (Number(o.progress) || 0), 0) / objs.length)
        : 0;
    const atRisk = objs.filter((o) => o.status === 'AT_RISK' || o.status === 'BEHIND').length;
    const checkedKrs = krs.filter((k) => Boolean(k.lastCheckinAt)).length;
    const checkinRate = krs.length > 0 ? Math.round((checkedKrs / krs.length) * 100) : 0;
    return { members, teams, objs, krs, avgProgress, atRisk, checkinRate };
  };

  const getUserName = (userId?: string) => {
    if (!userId) return '--';
    const u = db.users.find((x) => x.userId === userId);
    if (!u) return userId;
    return isKo ? u.displayNameKo || u.displayNameVi : u.displayNameVi;
  };

  const getDeptName = (deptId?: string) => {
    if (!deptId) return '--';
    const d = activeDepartments.find((x) => x.departmentId === deptId);
    if (!d) return deptId;
    return isKo ? d.nameKo || d.nameVi : d.nameVi;
  };

  const getTeamName = (teamId?: string) => {
    if (!teamId) return '--';
    const tm = activeTeams.find((x) => x.teamId === teamId);
    if (!tm) return teamId;
    return isKo ? tm.nameKo || tm.nameVi : tm.nameVi;
  };

  // Drag & Drop Handlers (D5)
  const prepareTransferModal = (
    empId: string,
    target: { departmentId?: string; teamId?: string; managerId?: string; summary: string }
  ) => {
    const emp = db.users.find((u) => u.userId === empId);
    if (!emp) return;
    setTransferError('');
    setPendingTransfer({
      userId: emp.userId,
      departmentId: target.departmentId ?? emp.departmentId,
      teamId: target.teamId ?? (target.departmentId && target.departmentId !== emp.departmentId ? '' : emp.teamId),
      managerId: target.managerId !== undefined ? target.managerId : emp.managerId,
      jobTitleVi: emp.jobTitleVi,
      jobTitleKo: emp.jobTitleKo,
      effectiveDate: new Date().toISOString().slice(0, 10),
      reason: target.summary,
      summary: target.summary,
    });
  };

  const confirmTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingTransfer) return;
    setTransferError('');
    setSubmitting(true);
    try {
      await onOrgAction(
        {
          action: 'transferEmployee',
          ...pendingTransfer,
        },
        isKo
          ? '인사 이동 및 보고 체계가 Google Sheets에 저장되었습니다.'
          : 'Đã cập nhật cơ cấu nhân sự & lưu lịch sử điều chuyển lên Google Sheets!'
      );
      setPendingTransfer(null);
    } catch (err: unknown) {
      const er = err as Error;
      setTransferError(er.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Render an Employee Node Card (D3)
  const renderEmployeeCard = (emp: OkrUser, nestedCount = 0) => {
    const empObjs = db.objectives.filter((o) => !o.deletedAt && o.ownerId === emp.userId);
    const avgObjProg =
      empObjs.length > 0
        ? Math.round(empObjs.reduce((s, o) => s + (Number(o.progress) || 0), 0) / empObjs.length)
        : 0;
    const isSelected = selectedEmployeeId === emp.userId;

    return (
      <div
        key={emp.userId}
        draggable={isAdmin}
        onDragStart={(e) => {
          if (!isAdmin) return;
          e.stopPropagation();
          setDraggingUserId(emp.userId);
        }}
        onDragEnd={() => setDraggingUserId(null)}
        onDragOver={(e) => {
          if (isAdmin && draggingUserId && draggingUserId !== emp.userId) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          if (!isAdmin || !draggingUserId || draggingUserId === emp.userId) return;
          e.preventDefault();
          e.stopPropagation();
          const dragged = db.users.find((u) => u.userId === draggingUserId);
          if (!dragged) return;
          prepareTransferModal(dragged.userId, {
            departmentId: emp.departmentId || dragged.departmentId,
            managerId: emp.userId,
            summary: `${getUserName(dragged.userId)} → Báo cáo trực tiếp cho ${getUserName(emp.userId)}`,
          });
          setDraggingUserId(null);
        }}
        onClick={() => setSelectedEmployeeId(emp.userId)}
        className={`group cursor-pointer p-3.5 rounded-[12px] glass-surface hover:-translate-y-0.5 hover:shadow-md transition-all min-w-[230px] max-w-[270px] ${
          isSelected
            ? 'ring-2 ring-indigo-500/40 border-indigo-500'
            : ''
        } ${draggingUserId === emp.userId ? 'opacity-50' : ''}`}
      >
        <div className="flex items-start gap-2.5">
          {emp.avatarUrl ? (
            <Image
              src={emp.avatarUrl}
              alt={emp.displayNameVi}
              width={36}
              height={36}
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-[12px] object-cover border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-[12px] bg-gradient-to-tr from-indigo-600 to-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {(emp.displayNameVi || emp.email).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {isKo ? emp.displayNameKo || emp.displayNameVi : emp.displayNameVi}
            </p>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold truncate">
              {(isKo ? emp.jobTitleKo || emp.jobTitleVi : emp.jobTitleVi) || emp.role}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{emp.email}</p>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{getDeptName(emp.departmentId)}</span>
            <span className="font-bold text-slate-800 dark:text-slate-100 shrink-0">{emp.role}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
            <span className="truncate">
              {emp.teamId ? getTeamName(emp.teamId) : isKo ? '팀 미배정' : 'Chưa gán nhóm'}
            </span>
            <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
              {empObjs.length} OKR · {avgObjProg}%
            </span>
          </div>
          {emp.managerId && (
            <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
              {isKo ? '직속 관리자: ' : 'Quản lý: '}
              {getUserName(emp.managerId)}
            </p>
          )}
          {nestedCount > 0 && (
            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
              {nestedCount} {isKo ? '명 직속 구성원' : 'nhân sự trực thuộc'}
            </p>
          )}
        </div>
      </div>
    );
  };

  // Recursive team & employee subtree inside a department
  const renderDepartmentTreeBranch = (dept: Department) => {
    const nodeKey = `DEPT-${dept.departmentId}`;
    const isCollapsed = Boolean(collapsedNodes[nodeKey]);
    const deptMembers = visibleUsers.filter((u) => u.departmentId === dept.departmentId);
    const deptTeams = activeTeams.filter((t) => t.departmentId === dept.departmentId);
    const metrics = getDepartmentMetrics(dept.departmentId);
    const headUser = db.users.find((u) => u.userId === dept.managerId);

    // Members in dept not belonging to any team in this dept
    const directDeptMembers = deptMembers.filter(
      (u) => !u.teamId || !deptTeams.some((t) => t.teamId === u.teamId)
    );

    // Sub-departments belonging to this department
    const childDepts = visibleDepartments.filter((d) => d.parentDepartmentId === dept.departmentId);

    return (
      <div key={dept.departmentId} className="pl-4 sm:pl-6 border-l border-slate-300 dark:border-slate-700 space-y-3">
        {/* Department Node Header */}
        <div
          onDragOver={(e) => {
            if (isAdmin && draggingUserId) e.preventDefault();
          }}
          onDrop={(e) => {
            if (!isAdmin || !draggingUserId) return;
            e.preventDefault();
            e.stopPropagation();
            prepareTransferModal(draggingUserId, {
              departmentId: dept.departmentId,
              teamId: '',
              summary: `${getUserName(draggingUserId)} → Điều chuyển sang Phòng ${getDeptName(
                dept.departmentId
              )}`,
            });
            setDraggingUserId(null);
          }}
          className="flex flex-wrap items-center gap-2.5 p-3.5 rounded-[12px] glass-surface glass-tint-blue shadow-xs"
        >
          <button
            type="button"
            onClick={() => toggleNodeCollapse(nodeKey)}
            className="p-1.5 rounded-[999px] hover:bg-white/70 dark:hover:bg-slate-800/70 text-slate-600 dark:text-slate-300"
            aria-label="Toggle department branch"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <div
            onClick={() => setSelectedDepartmentId(dept.departmentId)}
            className="flex-1 min-w-[200px] cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {isKo ? dept.nameKo || dept.nameVi : dept.nameVi}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {dept.level} {dept.division ? `· ${dept.division}` : ''}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300 mt-1 tabular-nums">
              <span>
                {isKo ? '부서장' : 'Trưởng phòng'}:{' '}
                <strong>{headUser ? getUserName(headUser.userId) : '--'}</strong>
              </span>
              <span>·</span>
              <span>
                {metrics.members.length} {isKo ? '명' : 'nhân sự'}
              </span>
              <span>·</span>
              <span>
                {metrics.objs.length} Objectives · {metrics.avgProgress}%
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedDepartmentId(dept.departmentId)}
            className="px-3.5 py-1.5 rounded-[999px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold whitespace-nowrap shadow-xs"
          >
            {isKo ? 'OKR · 부서 상세' : 'OKR & Chi tiết'}
          </button>
        </div>

        {/* Department Children: Direct Members, Teams, Sub-departments */}
        {!isCollapsed && (
          <div className="space-y-3 pl-2 sm:pl-4">
            {directDeptMembers.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {directDeptMembers.map((emp) =>
                  renderEmployeeCard(
                    emp,
                    db.users.filter((sub) => sub.managerId === emp.userId && sub.accountStatus === 'APPROVED').length
                  )
                )}
              </div>
            )}

            {deptTeams.map((tm) => {
              const teamKey = `TEAM-${tm.teamId}`;
              const teamCollapsed = Boolean(collapsedNodes[teamKey]);
              const teamMembers = deptMembers.filter((u) => u.teamId === tm.teamId);
              const teamLead = db.users.find((u) => u.userId === tm.managerId);
              return (
                <div
                  key={tm.teamId}
                  className="pl-4 border-l border-indigo-200 dark:border-indigo-900 space-y-2.5"
                >
                  <div
                    onDragOver={(e) => {
                      if (isAdmin && draggingUserId) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (!isAdmin || !draggingUserId) return;
                      e.preventDefault();
                      e.stopPropagation();
                      prepareTransferModal(draggingUserId, {
                        departmentId: dept.departmentId,
                        teamId: tm.teamId,
                        managerId: tm.managerId || undefined,
                        summary: `${getUserName(draggingUserId)} → Chuyển vào Nhóm ${getTeamName(
                          tm.teamId
                        )} (${getDeptName(dept.departmentId)})`,
                      });
                      setDraggingUserId(null);
                    }}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-[12px] glass-surface glass-tint-violet"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleNodeCollapse(teamKey)}
                        className="p-1.5 rounded-[999px] hover:bg-white/80 dark:hover:bg-slate-800"
                      >
                        {teamCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {isKo ? tm.nameKo || tm.nameVi : tm.nameVi}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        · {isKo ? '팀장' : 'Trưởng nhóm'}:{' '}
                        {teamLead ? getUserName(teamLead.userId) : '--'} ({teamMembers.length})
                      </span>
                    </div>
                  </div>

                  {!teamCollapsed && (
                    <div className="flex flex-wrap gap-3 pl-2">
                      {teamMembers.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
                          {isKo ? '소속 구성원이 없습니다.' : 'Chưa có nhân sự trong nhóm.'}
                        </p>
                      ) : (
                        teamMembers.map((emp) =>
                          renderEmployeeCard(
                            emp,
                            db.users.filter(
                              (sub) => sub.managerId === emp.userId && sub.accountStatus === 'APPROVED'
                            ).length
                          )
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {childDepts.map((child) => renderDepartmentTreeBranch(child))}
          </div>
        )}
      </div>
    );
  };

  // Group root departments by Division (Khối) cleanly
  const rootDepartments = useMemo(() => {
    const deptIds = new Set(visibleDepartments.map((d) => d.departmentId));
    return visibleDepartments.filter(
      (d) => !d.parentDepartmentId || !deptIds.has(d.parentDepartmentId)
    );
  }, [visibleDepartments]);

  const divisions = useMemo(() => {
    const groups: Record<string, Department[]> = {};
    rootDepartments.forEach((d) => {
      const divKey = d.division?.trim() || (isKo ? '전사 직속 부서' : 'Khối Chức năng Trực thuộc');
      if (!groups[divKey]) groups[divKey] = [];
      groups[divKey].push(d);
    });
    return Object.entries(groups);
  }, [rootDepartments, isKo]);

  // Selected Employee Profile & OKR Metrics (D3 & D6)
  const selectedEmployee = useMemo(
    () => db.users.find((u) => u.userId === selectedEmployeeId) || null,
    [db.users, selectedEmployeeId]
  );

  // Selected Department OKR Detail (D6)
  const selectedDepartment = useMemo(
    () => activeDepartments.find((d) => d.departmentId === selectedDepartmentId) || null,
    [activeDepartments, selectedDepartmentId]
  );

  const inputCls =
    'w-full px-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500';
  const labelCls = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';

  return (
    <div className="space-y-5">
      {/* Page Title & Submenu Navigation (Section F: Danh sách nhân sự, Phòng ban, Nhóm, Sơ đồ tổ chức) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">
              {isKo ? '팀 · 부서 및 조직도 (조직도)' : 'Đội ngũ, Phòng ban & Sơ đồ Tổ chức'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
            {isKo
              ? 'Google Sheets 기반 실시간 조직 계층 구조, 부서·팀 관리 및 OKR 성과 연계를 제공합니다.'
              : 'Dữ liệu nhân sự, phòng ban, nhóm và liên kết OKR đồng bộ trực tiếp 100% từ Google Sheets.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 glass-surface p-1.5 rounded-[999px]">
          {(
            [
              { key: 'org-chart', labelVi: 'Sơ đồ tổ chức', labelKo: '조직도', Icon: Network },
              { key: 'directory', labelVi: 'Danh sách nhân sự', labelKo: '구성원 목록', Icon: Users },
              { key: 'departments', labelVi: 'Phòng ban', labelKo: '부서 관리', Icon: Building2 },
              { key: 'teams', labelVi: 'Nhóm', labelKo: '팀 관리', Icon: Layers },
              { key: 'history', labelVi: 'Lịch sử điều chuyển', labelKo: '변경 이력', Icon: History },
            ] as const
          ).map((tab) => {
            const IconComp = tab.Icon;
            const active = subTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setSubTab(tab.key)}
                className={`px-3.5 py-1.5 rounded-[999px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{isKo ? tab.labelKo : tab.labelVi}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* SUBTAB 1: SƠ ĐỒ TỔ CHỨC (VIEW 1: TREE & VIEW 2: DEPARTMENT CARDS) */}
      {/* ================================================================= */}
      {subTab === 'org-chart' && (
        <div className="space-y-4">
          {/* Interactive Controls Toolbar (D4) */}
          <div className="glass-surface p-4 rounded-[12px] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* View Mode Switch */}
              <div className="flex items-center gap-1 bg-white/65 dark:bg-slate-800/75 border border-slate-200/70 dark:border-slate-700 p-1 rounded-[999px]">
                <button
                  type="button"
                  onClick={() => setChartViewMode('tree')}
                  className={`px-3.5 py-1.5 rounded-[999px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    chartViewMode === 'tree'
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <Network className="w-3.5 h-3.5" />
                  <span>{isKo ? 'VIEW 1 · 조직 트리' : 'VIEW 1 · Cây Tổ chức'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChartViewMode('cards')}
                  className={`px-3.5 py-1.5 rounded-[999px] text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    chartViewMode === 'cards'
                      ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{isKo ? 'VIEW 2 · 부서 카드' : 'VIEW 2 · Thẻ Phòng ban'}</span>
                </button>
              </div>

              {/* Tree Controls: Expand All, Collapse All, Zoom In/Out/Reset */}
              {chartViewMode === 'tree' && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="px-3.5 py-1.5 rounded-[999px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1 hover:bg-white dark:hover:bg-slate-700"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5" />
                    <span>Expand All</span>
                  </button>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="px-3.5 py-1.5 rounded-[999px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1 hover:bg-white dark:hover:bg-slate-700"
                  >
                    <ChevronsDownUp className="w-3.5 h-3.5" />
                    <span>Collapse All</span>
                  </button>
                  <div className="flex items-center gap-1 bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700 rounded-[999px] px-2 py-1">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(60, z - 10))}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-[999px]"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-mono font-bold tabular-nums w-10 text-center">
                      {zoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(130, z + 10))}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-[999px]"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom(100)}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-[999px]"
                      title="Reset Zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Search & Multi-Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs">
              <div className="relative lg:col-span-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isKo ? '직원 또는 부서 검색...' : 'Tìm nhân viên hoặc phòng ban...'}
                  className="w-full pl-8 pr-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700 outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={filterDeptId}
                onChange={(e) => {
                  setFilterDeptId(e.target.value);
                  setFilterTeamId('ALL');
                }}
                className="px-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700"
              >
                <option value="ALL">{isKo ? '전체 기업 / 부서' : 'Toàn doanh nghiệp (Phòng ban)'}</option>
                {activeDepartments.map((d) => (
                  <option key={d.departmentId} value={d.departmentId}>
                    {isKo ? d.nameKo || d.nameVi : d.nameVi}
                  </option>
                ))}
              </select>

              <select
                value={filterTeamId}
                onChange={(e) => setFilterTeamId(e.target.value)}
                className="px-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700"
              >
                <option value="ALL">{isKo ? '모든 팀' : 'Tất cả Nhóm'}</option>
                {activeTeams
                  .filter((t) => filterDeptId === 'ALL' || t.departmentId === filterDeptId)
                  .map((t) => (
                    <option key={t.teamId} value={t.teamId}>
                      {isKo ? t.nameKo || t.nameVi : t.nameVi}
                    </option>
                  ))}
              </select>

              <select
                value={filterManagerId}
                onChange={(e) => setFilterManagerId(e.target.value)}
                className="px-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700"
              >
                <option value="ALL">{isKo ? '모든 관리자' : 'Tất cả Quản lý'}</option>
                {managerUsers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {getUserName(m.userId)}
                  </option>
                ))}
              </select>

              <select
                value={focusUserId}
                onChange={(e) => setFocusUserId(e.target.value)}
                className="px-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700"
              >
                <option value="ALL">{isKo ? '특정 직원 / 라인 필터' : 'Xem 1 nhân viên & quản lý'}</option>
                {db.users
                  .filter((u) => u.accountStatus === 'APPROVED')
                  .map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {getUserName(u.userId)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filterTitle}
                  onChange={(e) => setFilterTitle(e.target.value)}
                  className="px-2.5 py-1 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700"
                >
                  <option value="ALL">{isKo ? '모든 직함' : 'Tất cả chức danh'}</option>
                  {uniqueTitles.map((tt) => (
                    <option key={tt} value={tt}>
                      {tt}
                    </option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-2.5 py-1 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700"
                >
                  <option value="APPROVED">{isKo ? '승인 완료 (APPROVED)' : 'Đang hoạt động (APPROVED)'}</option>
                  <option value="ALL">{isKo ? '모든 상태' : 'Tất cả trạng thái'}</option>
                  <option value="PENDING">PENDING</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              {isAdmin && chartViewMode === 'tree' && (
                <span>
                  {isKo
                    ? '팁: 관리자 권한으로 직원 카드를 다른 관리자나 부서/팀에 드래그하여 보고 체계를 변경할 수 있습니다.'
                    : 'Mẹo Admin: Kéo thả thẻ nhân viên vào thẻ Quản lý hoặc Phòng ban/Nhóm để điều chuyển (có xác nhận).'}
                </span>
              )}
            </div>
          </div>

          {/* VIEW 1: ORGANIZATION TREE */}
          {chartViewMode === 'tree' && (
            <div className="glass-surface p-4 sm:p-6 rounded-[12px] overflow-auto max-h-[680px]">
              <div
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top left',
                  width: `${10000 / zoom}%`,
                }}
                className="space-y-5 transition-transform duration-150"
              >
                {/* Root Company Banner */}
                <div className="p-4 rounded-[12px] bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 text-white flex flex-wrap items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[12px] bg-white/20 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold">{db.settings.companyName}</h2>
                      <p className="text-xs text-white/85">
                        {activeDepartments.length} {isKo ? '개 부서' : 'Phòng ban'} ·{' '}
                        {activeTeams.length} {isKo ? '개 팀' : 'Nhóm'} · {visibleUsers.length}{' '}
                        {isKo ? '명 인원' : 'nhân sự hiển thị'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Top Leadership (Board / Executives without parent or ADMIN/EXECUTIVE) */}
                {(() => {
                  const boardUsers = visibleUsers.filter(
                    (u) => !u.managerId && (u.role === 'ADMIN' || u.role === 'EXECUTIVE')
                  );
                  if (boardUsers.length === 0) return null;
                  return (
                    <div className="pl-4 sm:pl-6 border-l border-slate-300 dark:border-slate-700 space-y-2.5">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {isKo ? '이사회 / 경영진 (BOARD & EXECUTIVE)' : 'Ban Lãnh đạo & Điều hành (BOARD)'}
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {boardUsers.map((emp) =>
                          renderEmployeeCard(
                            emp,
                            db.users.filter(
                              (sub) => sub.managerId === emp.userId && sub.accountStatus === 'APPROVED'
                            ).length
                          )
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Divisions & Departments Hierarchy */}
                {divisions.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
                    {isKo
                      ? '등록된 부서가 없습니다. 부서 관리 탭에서 부서를 추가해 주세요.'
                      : 'Chưa có phòng ban nào. Vui lòng tạo Phòng ban trong tab Quản lý Phòng ban.'}
                  </p>
                ) : (
                  divisions.map(([divName, depts]) => (
                    <div key={divName} className="space-y-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[12px] glass-surface text-xs font-bold text-slate-700 dark:text-slate-200">
                        <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{divName}</span>
                      </div>
                      <div className="space-y-4">
                        {depts.map((dept) => renderDepartmentTreeBranch(dept))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: DEPARTMENT CARDS */}
          {chartViewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleDepartments.map((dept, idx) => {
                const metrics = getDepartmentMetrics(dept.departmentId);
                const head = db.users.find((u) => u.userId === dept.managerId);
                const tints = [
                  'glass-tint-blue',
                  'glass-tint-emerald',
                  'glass-tint-violet',
                  'glass-tint-cyan',
                  'glass-tint-amber',
                  'glass-tint-pink',
                ];
                return (
                  <button
                    key={dept.departmentId}
                    type="button"
                    onClick={() => setSelectedDepartmentId(dept.departmentId)}
                    className={`text-left glass-surface ${tints[idx % tints.length]} p-5 rounded-[12px] hover:-translate-y-0.5 hover:shadow-md transition-all space-y-3`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 truncate">
                          {dept.division || dept.level}
                        </p>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                          {isKo ? dept.nameKo || dept.nameVi : dept.nameVi}
                        </h3>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {dept.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <p className="truncate">
                        {isKo ? '부서장' : 'Trưởng phòng'}:{' '}
                        <strong>{head ? getUserName(head.userId) : '--'}</strong>
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          {metrics.members.length} {isKo ? '명' : 'nhân viên'}
                        </span>
                        <span>·</span>
                        <span>
                          {metrics.teams.length} {isKo ? '팀' : 'nhóm'}
                        </span>
                        <span>·</span>
                        <span>{metrics.objs.length} Objectives</span>
                        <span>·</span>
                        <span>{metrics.krs.length} KRs</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="text-slate-500 dark:text-slate-400">
                          {isKo ? '평균 OKR 진행률' : 'Tiến độ OKR trung bình'}
                        </span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {metrics.avgProgress}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${Math.min(100, metrics.avgProgress)}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* SUBTAB 2: EMPLOYEE DIRECTORY                                      */}
      {/* ================================================================= */}
      {subTab === 'directory' && (
        <div className="glass-surface p-5 rounded-[12px] overflow-x-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-bold text-base text-slate-900 dark:text-white">
              {isKo ? '전체 구성원 목록' : 'Danh sách Nhân sự trong Tổ chức'} ({visibleUsers.length})
            </h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isKo ? '이름, 이메일 검색...' : 'Tìm kiếm nhân sự...'}
                className="w-full pl-9 pr-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200 dark:border-slate-700 text-xs outline-none"
              />
            </div>
          </div>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="p-3 font-bold">{isKo ? '직원' : 'Nhân sự'}</th>
                <th className="p-3 font-bold">{isKo ? '사번 / 직함' : 'Mã NV / Chức danh'}</th>
                <th className="p-3 font-bold">{isKo ? '부서 / 팀' : 'Phòng ban / Nhóm'}</th>
                <th className="p-3 font-bold">{isKo ? '직속 관리자' : 'Quản lý trực tiếp'}</th>
                <th className="p-3 font-bold">{isKo ? '역할 / 상태' : 'Vai trò / Trạng thái'}</th>
                <th className="p-3 font-bold text-right">{isKo ? '작업' : 'Thao tác'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {visibleUsers.map((u) => (
                <tr key={u.userId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeId(u.userId)}
                      className="flex items-center gap-2.5 text-left"
                    >
                      {u.avatarUrl ? (
                        <Image
                          src={u.avatarUrl}
                          alt={u.displayNameVi}
                          width={32}
                          height={32}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {(u.displayNameVi || u.email).slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{getUserName(u.userId)}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </div>
                    </button>
                  </td>
                  <td className="p-3">
                    <p className="font-mono font-bold">{u.employeeCode || '--'}</p>
                    <p className="text-[11px] text-slate-500">
                      {(isKo ? u.jobTitleKo || u.jobTitleVi : u.jobTitleVi) || '--'}
                    </p>
                  </td>
                  <td className="p-3">
                    <p className="font-semibold">{getDeptName(u.departmentId)}</p>
                    <p className="text-[11px] text-slate-500">{getTeamName(u.teamId)}</p>
                  </td>
                  <td className="p-3">{getUserName(u.managerId)}</td>
                  <td className="p-3">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{u.role}</span> ·{' '}
                    <span>{u.accountStatus}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedEmployeeId(u.userId)}
                        className="px-3 py-1 rounded-[999px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold"
                      >
                        {isKo ? '프로필 · OKR' : 'Hồ sơ & OKR'}
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() =>
                            prepareTransferModal(u.userId, {
                              summary: `${isKo ? '인사 발령' : 'Điều chuyển nhân sự'}: ${getUserName(
                                u.userId
                              )}`,
                            })
                          }
                          className="px-3 py-1 rounded-[999px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold"
                        >
                          {isKo ? '이동' : 'Điều chuyển'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUBTAB 3: DEPARTMENTS MANAGEMENT                                  */}
      {/* ================================================================= */}
      {subTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-base text-slate-900 dark:text-white">
              {isKo ? '부서 관리 (DEPARTMENTS)' : 'Quản lý Phòng ban (DEPARTMENTS)'}
            </h2>
            {isAdmin && (
              <button
                type="button"
                onClick={() =>
                  setDeptForm({
                    departmentId: '',
                    parentDepartmentId: '',
                    nameVi: '',
                    nameKo: '',
                    managerId: '',
                    division: 'Khối Vận hành',
                    level: 'DEPARTMENT',
                    sortOrder: activeDepartments.length + 1,
                    descriptionVi: '',
                    descriptionKo: '',
                    status: 'ACTIVE',
                  })
                }
                className="px-4 py-2 rounded-[999px] bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{isKo ? '부서 생성' : 'Tạo Phòng ban'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeDepartments.map((d, idx) => {
              const m = getDepartmentMetrics(d.departmentId);
              const tints = ['glass-tint-blue', 'glass-tint-emerald', 'glass-tint-violet', 'glass-tint-cyan', 'glass-tint-amber', 'glass-tint-pink'];
              return (
                <div key={d.departmentId} className={`glass-surface ${tints[idx % tints.length]} p-5 rounded-[12px] space-y-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                        {d.division || d.level} · #{d.sortOrder || 1}
                      </p>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {isKo ? d.nameKo || d.nameVi : d.nameVi}
                      </h3>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDeptForm({ ...d })}
                          className="p-2 rounded-[999px] hover:bg-white/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                          title="Chỉnh sửa"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeptDeleteConfirm(d)}
                          className="p-2 rounded-[999px] hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600"
                          title="Xóa mềm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                    <p>
                      {isKo ? '부서장' : 'Trưởng phòng'}: <strong>{getUserName(d.managerId)}</strong>
                    </p>
                    <p>
                      {m.members.length} {isKo ? '명' : 'nhân sự'} · {m.teams.length}{' '}
                      {isKo ? '팀' : 'nhóm'} · {m.objs.length} OKR ({m.avgProgress}%)
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUBTAB 4: TEAMS MANAGEMENT                                        */}
      {/* ================================================================= */}
      {subTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-base text-slate-900 dark:text-white">
              {isKo ? '팀 관리 (TEAMS)' : 'Quản lý Nhóm (TEAMS)'}
            </h2>
            {isAdmin && (
              <button
                type="button"
                onClick={() =>
                  setTeamForm({
                    teamId: '',
                    departmentId: activeDepartments[0]?.departmentId || '',
                    parentTeamId: '',
                    nameVi: '',
                    nameKo: '',
                    managerId: '',
                    level: 'TEAM',
                    sortOrder: activeTeams.length + 1,
                    status: 'ACTIVE',
                  })
                }
                className="px-4 py-2 rounded-[999px] bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{isKo ? '팀 생성' : 'Tạo Nhóm mới'}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTeams.length === 0 ? (
              <div className="col-span-full glass-surface p-8 rounded-[12px] text-center text-xs text-slate-500">
                {isKo ? '등록된 팀이 없습니다.' : 'Chưa có nhóm nào được tạo.'}
              </div>
            ) : (
              activeTeams.map((tm, idx) => {
                const count = db.users.filter(
                  (u) => u.teamId === tm.teamId && u.accountStatus === 'APPROVED'
                ).length;
                const tints = ['glass-tint-violet', 'glass-tint-cyan', 'glass-tint-emerald', 'glass-tint-blue', 'glass-tint-amber', 'glass-tint-pink'];
                return (
                  <div key={tm.teamId} className={`glass-surface ${tints[idx % tints.length]} p-5 rounded-[12px] space-y-2.5`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          {getDeptName(tm.departmentId)}
                        </p>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {isKo ? tm.nameKo || tm.nameVi : tm.nameVi}
                        </h3>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setTeamForm({ ...tm })}
                          className="p-2 rounded-[999px] hover:bg-white/70 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                          title="Chỉnh sửa / Chuyển phòng ban"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                      <p>
                        {isKo ? '팀장' : 'Trưởng nhóm'}: <strong>{getUserName(tm.managerId)}</strong>
                      </p>
                      <p>
                        {count} {isKo ? '명 구성원' : 'thành viên'} · {tm.status}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* SUBTAB 5: ORGANIZATION HISTORY                                    */}
      {/* ================================================================= */}
      {subTab === 'history' && (
        <div className="glass-surface p-5 rounded-[12px] overflow-x-auto">
          <h2 className="font-bold text-base text-slate-900 dark:text-white mb-3">
            {isKo
              ? '인사 발령 및 조직 변경 이력 (ORGANIZATION_HISTORY)'
              : 'Lịch sử Điều chuyển & Thay đổi Tổ chức (ORGANIZATION_HISTORY)'}
          </h2>
          <table className="w-full text-left text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="p-2.5 font-bold">{isKo ? '적용일' : 'Ngày hiệu lực'}</th>
                <th className="p-2.5 font-bold">{isKo ? '직원' : 'Nhân sự'}</th>
                <th className="p-2.5 font-bold">{isKo ? '부서 변경' : 'Phòng ban'}</th>
                <th className="p-2.5 font-bold">{isKo ? '직속 관리자 변경' : 'Quản lý trực tiếp'}</th>
                <th className="p-2.5 font-bold">{isKo ? '직함 변경' : 'Chức danh'}</th>
                <th className="p-2.5 font-bold">{isKo ? '사유' : 'Lý do'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {(db.organizationHistory || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    {isKo ? '아직 조직 변경 이력이 없습니다.' : 'Chưa có lịch sử điều chuyển.'}
                  </td>
                </tr>
              ) : (
                (db.organizationHistory || []).map((h) => (
                  <tr key={h.historyId}>
                    <td className="p-2.5 whitespace-nowrap">{formatLocaleDate(h.effectiveDate || h.createdAt, lang)}</td>
                    <td className="p-2.5 font-bold">{getUserName(h.userId)}</td>
                    <td className="p-2.5">
                      {getDeptName(h.previousDepartmentId)} → <strong>{getDeptName(h.newDepartmentId)}</strong>
                    </td>
                    <td className="p-2.5">
                      {getUserName(h.previousManagerId)} → <strong>{getUserName(h.newManagerId)}</strong>
                    </td>
                    <td className="p-2.5">
                      {h.previousJobTitle || '--'} → <strong>{h.newJobTitle || '--'}</strong>
                    </td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300 break-words max-w-xs">
                      {h.reason}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ================================================================= */}
      {/* DRAWER: EMPLOYEE PROFILE & OKR / MANAGER DIRECT REPORTS (D3 & D6) */}
      {/* ================================================================= */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-surface rounded-l-[12px] rounded-r-none h-full overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                {selectedEmployee.avatarUrl ? (
                  <Image
                    src={selectedEmployee.avatarUrl}
                    alt={selectedEmployee.displayNameVi}
                    width={48}
                    height={48}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-[12px] object-cover shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-[12px] bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0">
                    {(selectedEmployee.displayNameVi || selectedEmployee.email).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {getUserName(selectedEmployee.userId)}
                  </h2>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                    {(isKo
                      ? selectedEmployee.jobTitleKo || selectedEmployee.jobTitleVi
                      : selectedEmployee.jobTitleVi) || selectedEmployee.role}{' '}
                    · {selectedEmployee.employeeCode || selectedEmployee.userId}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{selectedEmployee.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployeeId(null)}
                className="p-2 rounded-[999px] hover:bg-white/70 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reporting & Work Info */}
            <div className="grid grid-cols-2 gap-3 text-xs p-4 rounded-[12px] glass-surface">
              <div>
                <span className="text-slate-500 block">{isKo ? '부서' : 'Phòng ban'}</span>
                <span className="font-bold">{getDeptName(selectedEmployee.departmentId)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isKo ? '팀' : 'Nhóm'}</span>
                <span className="font-bold">{getTeamName(selectedEmployee.teamId)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isKo ? '직속 관리자' : 'Quản lý trực tiếp'}</span>
                <span className="font-bold">{getUserName(selectedEmployee.managerId)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">{isKo ? '역할 / 상태' : 'Vai trò / Trạng thái'}</span>
                <span className="font-bold">
                  {selectedEmployee.role} · {selectedEmployee.accountStatus}
                </span>
              </div>
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() =>
                  prepareTransferModal(selectedEmployee.userId, {
                    summary: `Cập nhật vị trí / quản lý trực tiếp cho ${getUserName(
                      selectedEmployee.userId
                    )}`,
                  })
                }
                className="w-full py-2.5 px-4 rounded-[999px] bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>
                  {isKo
                    ? '부서 이동 / 직속 관리자 · 직함 변경'
                    : 'Điều chuyển Phòng ban / Đổi Quản lý / Chức danh'}
                </span>
              </button>
            )}

            {/* Personal OKR Summary (D3 & D6) */}
            {(() => {
              const empObjs = db.objectives.filter(
                (o) => !o.deletedAt && o.ownerId === selectedEmployee.userId
              );
              const empKrs = db.keyResults.filter(
                (k) => !k.deletedAt && k.ownerId === selectedEmployee.userId
              );
              const empTasks = db.tasks.filter(
                (tk) => !tk.deletedAt && tk.ownerId === selectedEmployee.userId
              );
              const empCheckins = db.checkins.filter(
                (c) => c.ownerId === selectedEmployee.userId
              );
              const avgProg =
                empObjs.length > 0
                  ? Math.round(
                      empObjs.reduce((s, o) => s + (Number(o.progress) || 0), 0) / empObjs.length
                    )
                  : 0;
              const missingCheckins = empKrs.filter((k) => !k.lastCheckinAt).length;

              const directReports = db.users.filter(
                (u) => u.managerId === selectedEmployee.userId && u.accountStatus === 'APPROVED'
              );

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center tabular-nums">
                    <div className="p-3 rounded-[12px] glass-surface glass-tint-violet">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Objectives</p>
                      <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                        {empObjs.length}
                      </p>
                    </div>
                    <div className="p-3 rounded-[12px] glass-surface glass-tint-emerald">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{isKo ? '개인 진척도' : 'Tiến độ OKR'}</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        {avgProg}%
                      </p>
                    </div>
                    <div className="p-3 rounded-[12px] glass-surface glass-tint-blue">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Tasks</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {empTasks.length}
                      </p>
                    </div>
                    <div className="p-3 rounded-[12px] glass-surface glass-tint-amber">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Check-ins</p>
                      <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                        {empCheckins.length}
                        {missingCheckins > 0 ? ` (-${missingCheckins})` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Assigned Objectives */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-indigo-600" />
                      <span>{isKo ? '담당 목표 (Objectives)' : 'Mục tiêu được giao (Objectives)'}</span>
                    </h3>
                    {empObjs.length === 0 ? (
                      <p className="text-xs text-slate-500">{isKo ? '배정된 목표가 없습니다.' : 'Chưa có Objective nào.'}</p>
                    ) : (
                      empObjs.map((o) => (
                        <div
                          key={o.objectiveId}
                          onClick={() => onOpenObjectiveDetail && onOpenObjectiveDetail(o.objectiveId)}
                          className="p-3 rounded-[12px] bg-white/75 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:border-indigo-400"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {isKo ? o.titleKo || o.titleVi : o.titleVi}
                            </span>
                            <span className="font-bold tabular-nums text-indigo-600 dark:text-indigo-400 shrink-0">
                              {o.progress}%
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Assigned KRs */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>{isKo ? '담당 핵심결과 (KRs)' : 'Key Results phụ trách'}</span>
                    </h3>
                    {empKrs.length === 0 ? (
                      <p className="text-xs text-slate-500">{isKo ? '담당 KR이 없습니다.' : 'Chưa có KR nào.'}</p>
                    ) : (
                      empKrs.map((kr) => (
                        <div
                          key={kr.krId}
                          className="p-2.5 rounded-[12px] bg-white/75 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate">{isKo ? kr.titleKo || kr.titleVi : kr.titleVi}</span>
                          <span className="font-bold tabular-nums shrink-0">{kr.progress}%</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Direct Reports Drill-down (Manager View D6) */}
                  {directReports.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        <span>
                          {isKo
                            ? `직속 구성원 및 OKR 현황 (${directReports.length}명)`
                            : `Nhân viên trực thuộc & Tiến độ OKR (${directReports.length})`}
                        </span>
                      </h3>
                      <div className="space-y-2">
                        {directReports.map((sub) => {
                          const subObjs = db.objectives.filter(
                            (o) => !o.deletedAt && o.ownerId === sub.userId
                          );
                          const subKrs = db.keyResults.filter(
                            (k) => !k.deletedAt && k.ownerId === sub.userId
                          );
                          const subMissing = subKrs.filter((k) => !k.lastCheckinAt).length;
                          const subProg =
                            subObjs.length > 0
                              ? Math.round(
                                  subObjs.reduce((s, o) => s + (Number(o.progress) || 0), 0) /
                                    subObjs.length
                                )
                              : 0;
                          return (
                            <button
                              key={sub.userId}
                              type="button"
                              onClick={() => setSelectedEmployeeId(sub.userId)}
                              className="w-full text-left p-3 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 dark:text-white truncate">
                                  {getUserName(sub.userId)}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {subObjs.length} OKR · {subKrs.length} KR
                                  {subMissing > 0
                                    ? ` · ${subMissing} ${isKo ? '건 체크인 누락' : 'KR chưa check-in'}`
                                    : ''}
                                </p>
                              </div>
                              <span className="font-bold tabular-nums text-indigo-600 dark:text-indigo-400 shrink-0">
                                {subProg}%
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* DRAWER: DEPARTMENT DETAIL & OKR LINKING (D2 View2 & D6)           */}
      {/* ================================================================= */}
      {selectedDepartment && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-surface rounded-l-[12px] rounded-r-none h-full overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-5">
            {(() => {
              const m = getDepartmentMetrics(selectedDepartment.departmentId);
              return (
                <>
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {selectedDepartment.division || selectedDepartment.level}
                      </p>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        {isKo
                          ? selectedDepartment.nameKo || selectedDepartment.nameVi
                          : selectedDepartment.nameVi}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {isKo ? '부서장' : 'Trưởng phòng'}:{' '}
                        <strong>{getUserName(selectedDepartment.managerId)}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedDepartmentId(null)}
                      className="p-2 rounded-[999px] hover:bg-white/70 dark:hover:bg-slate-800"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center tabular-nums">
                    <div className="p-3 rounded-[12px] glass-surface glass-tint-violet">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Objectives</p>
                      <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{m.objs.length}</p>
                    </div>
                    <div className="p-3 rounded-[12px] glass-surface glass-tint-emerald">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{isKo ? '진행률' : 'Tiến độ'}</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{m.avgProgress}%</p>
                    </div>
                    <div className="p-3 rounded-[12px] glass-surface glass-tint-blue">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Check-in</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{m.checkinRate}%</p>
                    </div>
                    <div className="p-3 rounded-[12px] glass-surface glass-tint-pink">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{isKo ? '위험 OKR' : 'OKR rủi ro'}</p>
                      <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{m.atRisk}</p>
                    </div>
                  </div>

                  {/* Department Objectives & KRs */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isKo ? '부서 OKR 및 담당자' : 'Objectives & KR của Phòng ban'}
                    </h3>
                    {m.objs.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        {isKo ? '등록된 부서 OKR이 없습니다.' : 'Phòng ban chưa có Objective nào.'}
                      </p>
                    ) : (
                      m.objs.map((o) => (
                        <div
                          key={o.objectiveId}
                          onClick={() => onOpenObjectiveDetail && onOpenObjectiveDetail(o.objectiveId)}
                          className="p-3 rounded-[12px] bg-white/75 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700 cursor-pointer hover:border-indigo-400 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {isKo ? o.titleKo || o.titleVi : o.titleVi}
                            </span>
                            <span className="font-bold tabular-nums text-indigo-600 shrink-0">
                              {o.progress}%
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {isKo ? '담당자' : 'Phụ trách'}: {getUserName(o.ownerId)} · {o.status}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Department Employees */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {isKo ? '소속 구성원' : 'Nhân sự thuộc Phòng ban'} ({m.members.length})
                    </h3>
                    <div className="space-y-2">
                      {m.members.map((emp) => (
                        <button
                          key={emp.userId}
                          type="button"
                          onClick={() => {
                            setSelectedDepartmentId(null);
                            setSelectedEmployeeId(emp.userId);
                          }}
                          className="w-full text-left p-2.5 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {getUserName(emp.userId)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {(isKo ? emp.jobTitleKo || emp.jobTitleVi : emp.jobTitleVi) || emp.role} ·{' '}
                              {getTeamName(emp.teamId)}
                            </p>
                          </div>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{emp.role}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* CONFIRMATION MODAL: TRANSFER / REPORTING LINE CHANGE (D5)         */}
      {/* ================================================================= */}
      {pendingTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="glass-surface rounded-[12px] max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {isKo ? '인사 발령 및 보고 체계 변경 확인' : 'Xác nhận Điều chuyển & Đổi Quản lý'}
              </h3>
              <button
                type="button"
                onClick={() => setPendingTransfer(null)}
                className="p-2 rounded-[999px] hover:bg-white/70 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 rounded-[12px] bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{transferError}</span>
              </div>
            )}

            <form onSubmit={confirmTransferSubmit} className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {isKo ? '대상 직원' : 'Nhân sự'}:{' '}
                <strong>{getUserName(pendingTransfer.userId)}</strong> —{' '}
                {isKo
                  ? '기존 OKR 및 체크인 이력은 그대로 보존됩니다.'
                  : 'toàn bộ lịch sử OKR và Check-in trước đây sẽ được giữ nguyên.'}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isKo ? '새 부서' : 'Phòng ban'}</label>
                  <select
                    value={pendingTransfer.departmentId}
                    onChange={(e) =>
                      setPendingTransfer((p) =>
                        p ? { ...p, departmentId: e.target.value, teamId: '' } : p
                      )
                    }
                    className={inputCls}
                  >
                    {activeDepartments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {isKo ? d.nameKo || d.nameVi : d.nameVi}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{isKo ? '새 팀' : 'Nhóm'}</label>
                  <select
                    value={pendingTransfer.teamId}
                    onChange={(e) =>
                      setPendingTransfer((p) => (p ? { ...p, teamId: e.target.value } : p))
                    }
                    className={inputCls}
                  >
                    <option value="">{isKo ? '-- 없음 --' : '-- Không chọn --'}</option>
                    {activeTeams
                      .filter((t) => t.departmentId === pendingTransfer.departmentId)
                      .map((t) => (
                        <option key={t.teamId} value={t.teamId}>
                          {isKo ? t.nameKo || t.nameVi : t.nameVi}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>{isKo ? '직속 관리자' : 'Người quản lý trực tiếp'}</label>
                <select
                  value={pendingTransfer.managerId}
                  onChange={(e) =>
                    setPendingTransfer((p) => (p ? { ...p, managerId: e.target.value } : p))
                  }
                  className={inputCls}
                >
                  <option value="">{isKo ? '-- 없음 --' : '-- Không có --'}</option>
                  {managerUsers
                    .filter((m) => m.userId !== pendingTransfer.userId)
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {getUserName(m.userId)} ({m.role} · {getDeptName(m.departmentId)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isKo ? '새 직함 (VI)' : 'Chức danh mới'}</label>
                  <input
                    value={pendingTransfer.jobTitleVi}
                    onChange={(e) =>
                      setPendingTransfer((p) => (p ? { ...p, jobTitleVi: e.target.value } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>{isKo ? '적용일' : 'Ngày hiệu lực'}</label>
                  <input
                    type="date"
                    value={pendingTransfer.effectiveDate}
                    onChange={(e) =>
                      setPendingTransfer((p) => (p ? { ...p, effectiveDate: e.target.value } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>{isKo ? '변경 사유' : 'Lý do điều chuyển'}</label>
                <input
                  required
                  value={pendingTransfer.reason}
                  onChange={(e) =>
                    setPendingTransfer((p) => (p ? { ...p, reason: e.target.value } : p))
                  }
                  className={inputCls}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingTransfer(null)}
                  className="px-4 py-2 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  {isKo ? '취소' : 'Hủy'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-[999px] bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-bold disabled:opacity-60 shadow-xs"
                >
                  {isKo ? '저장 확정' : 'Xác nhận Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: CREATE / EDIT DEPARTMENT                                   */}
      {/* ================================================================= */}
      {deptForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="glass-surface rounded-[12px] max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800">
              <h3 className="font-bold text-base">
                {deptForm.departmentId
                  ? isKo
                    ? '부서 수정'
                    : 'Chỉnh sửa Phòng ban'
                  : isKo
                  ? '새 부서 생성'
                  : 'Tạo Phòng ban mới'}
              </h3>
              <button type="button" onClick={() => setDeptForm(null)} className="p-2 rounded-[999px] hover:bg-white/70 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onOrgAction(
                  {
                    action: deptForm.departmentId ? 'updateDepartment' : 'createDepartment',
                    ...deptForm,
                  },
                  isKo ? '부서 정보가 저장되었습니다.' : 'Đã lưu thông tin Phòng ban lên Google Sheets!'
                );
                setDeptForm(null);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tên Phòng ban (VI) *</label>
                  <input
                    required
                    value={deptForm.nameVi || ''}
                    onChange={(e) => setDeptForm((p) => (p ? { ...p, nameVi: e.target.value } : p))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tên Phòng ban (KO)</label>
                  <input
                    value={deptForm.nameKo || ''}
                    onChange={(e) => setDeptForm((p) => (p ? { ...p, nameKo: e.target.value } : p))}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Khối (Division)</label>
                  <input
                    value={deptForm.division || ''}
                    onChange={(e) => setDeptForm((p) => (p ? { ...p, division: e.target.value } : p))}
                    placeholder="VD: Khối Kinh doanh"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Trưởng phòng (Manager)</label>
                  <select
                    value={deptForm.managerId || ''}
                    onChange={(e) => setDeptForm((p) => (p ? { ...p, managerId: e.target.value } : p))}
                    className={inputCls}
                  >
                    <option value="">-- Chưa bổ nhiệm --</option>
                    {db.users
                      .filter((u) => u.accountStatus === 'APPROVED')
                      .map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {getUserName(u.userId)} ({u.role})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Phòng ban cha</label>
                  <select
                    value={deptForm.parentDepartmentId || ''}
                    onChange={(e) =>
                      setDeptForm((p) => (p ? { ...p, parentDepartmentId: e.target.value } : p))
                    }
                    className={inputCls}
                  >
                    <option value="">-- Cấp gốc --</option>
                    {activeDepartments
                      .filter((d) => d.departmentId !== deptForm.departmentId)
                      .map((d) => (
                        <option key={d.departmentId} value={d.departmentId}>
                          {getDeptName(d.departmentId)}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Thứ tự hiển thị</label>
                  <input
                    type="number"
                    value={deptForm.sortOrder || 1}
                    onChange={(e) =>
                      setDeptForm((p) => (p ? { ...p, sortOrder: Number(e.target.value) } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeptForm(null)}
                  className="px-4 py-2 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[999px] bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-bold shadow-xs"
                >
                  Lưu Phòng ban
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: CREATE / EDIT TEAM                                         */}
      {/* ================================================================= */}
      {teamForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="glass-surface rounded-[12px] max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/70 dark:border-slate-800">
              <h3 className="font-bold text-base">
                {teamForm.teamId ? 'Chỉnh sửa / Chuyển Nhóm' : 'Tạo Nhóm mới'}
              </h3>
              <button type="button" onClick={() => setTeamForm(null)} className="p-2 rounded-[999px] hover:bg-white/70 dark:hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onOrgAction(
                  {
                    action: teamForm.teamId ? 'updateTeam' : 'createTeam',
                    ...teamForm,
                  },
                  'Đã lưu thông tin Nhóm lên Google Sheets!'
                );
                setTeamForm(null);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tên Nhóm (VI) *</label>
                  <input
                    required
                    value={teamForm.nameVi || ''}
                    onChange={(e) => setTeamForm((p) => (p ? { ...p, nameVi: e.target.value } : p))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tên Nhóm (KO)</label>
                  <input
                    value={teamForm.nameKo || ''}
                    onChange={(e) => setTeamForm((p) => (p ? { ...p, nameKo: e.target.value } : p))}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Phòng ban trực thuộc *</label>
                  <select
                    required
                    value={teamForm.departmentId || ''}
                    onChange={(e) =>
                      setTeamForm((p) => (p ? { ...p, departmentId: e.target.value } : p))
                    }
                    className={inputCls}
                  >
                    {activeDepartments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {getDeptName(d.departmentId)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Trưởng nhóm (Team Lead)</label>
                  <select
                    value={teamForm.managerId || ''}
                    onChange={(e) => setTeamForm((p) => (p ? { ...p, managerId: e.target.value } : p))}
                    className={inputCls}
                  >
                    <option value="">-- Chưa bổ nhiệm --</option>
                    {db.users
                      .filter((u) => u.accountStatus === 'APPROVED')
                      .map((u) => (
                        <option key={u.userId} value={u.userId}>
                          {getUserName(u.userId)} ({u.role})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTeamForm(null)}
                  className="px-4 py-2 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[999px] bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-xs font-bold shadow-xs"
                >
                  Lưu Nhóm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: SOFT DELETE DEPARTMENT CONFIRMATION                        */}
      {/* ================================================================= */}
      {deptDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="glass-surface rounded-[12px] max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-rose-600">Xác nhận xóa mềm Phòng ban</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Bạn có chắc chắn muốn ngừng hoạt động / xóa mềm phòng ban{' '}
              <strong>{getDeptName(deptDeleteConfirm.departmentId)}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeptDeleteConfirm(null)}
                className="px-4 py-2 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await onOrgAction(
                      { action: 'deleteDepartment', departmentId: deptDeleteConfirm.departmentId },
                      'Đã xóa mềm Phòng ban!'
                    );
                    setDeptDeleteConfirm(null);
                  } catch {
                    // Handled by parent toast
                  }
                }}
                className="px-5 py-2 rounded-[999px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs"
              >
                Xác nhận xóa mềm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
