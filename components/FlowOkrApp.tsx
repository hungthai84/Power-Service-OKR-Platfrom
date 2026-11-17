'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import type { User } from 'firebase/auth';
import {
  Target,
  LayoutDashboard,
  Compass,
  CheckCircle2,
  FolderKanban,
  Activity,
  Kanban,
  GitFork,
  HardDrive,
  BarChart3,
  Users,
  CalendarDays,
  BookOpen,
  Repeat,
  Settings,
  HelpCircle,
  Database,
  RefreshCw,
  Search,
  Globe,
  Monitor,
  Sun,
  Moon,
  LogOut,
  Bell,
  Menu,
  X,
  Plus,
  Filter,
  Building2,
  Calendar,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Eye,
  Copy,
  Edit3,
  Trash2,
  Download,
  Printer,
  Layers,
  BookOpenCheck,
  Table2,
  DatabaseZap,
  Upload,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  UserCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  getFreshIdToken,
  logout,
} from '@/lib/firebase-auth';
import {
  fetchDriveWorkspace,
  loadSpreadsheetDatabase,
  bootstrapNewSpreadsheet,
  syncStateToGoogleSheet,
  uploadFileToDrive,
  deleteDriveFile,
  verifySessionWithBackend,
  fetchCurrentUserStatus,
  bootstrapOwnerAdmin,
  signOutBackendSession,
  postApprovalAction,
  postOrganizationAction,
  extractSpreadsheetId,
  ApiError,
} from '@/lib/workspace-client';
import {
  recalculateDatabaseScores,
  formatLocaleDate,
  formatLocaleNumber,
} from '@/lib/okr-engine';
import { I18N, OKR_TEMPLATES_LIBRARY, GUIDE_MODULES_DATA } from '@/lib/i18n';
import ConfirmModal from './ConfirmModal';
import Modals, { ObjectiveFormState, CheckInFormState } from './Modals';
import AccountGateView from './AccountGateView';
import UserApprovalView from './UserApprovalView';
import OrganizationChartView from './OrganizationChartView';
import type {
  AccountStatus,
  DatabaseState,
  DriveFileItem,
  KeyResult,
  Lang,
  Objective,
  OkrUser,
  ProjectItem,
  TaskItem,
  TaskStatus,
  ThemeMode,
  UserRole,
} from '@/types/okr';

type NavTab =
  | 'dashboard'
  | 'objectives'
  | 'key-results'
  | 'projects'
  | 'kanban'
  | 'checkins'
  | 'alignment'
  | 'drive-files'
  | 'reports'
  | 'team'
  | 'approval'
  | 'calendar'
  | 'templates'
  | 'cycles'
  | 'settings'
  | 'guide'
  | 'notifications';

const EMPTY_DB: DatabaseState = {
  users: [],
  departments: [],
  teams: [],
  cycles: [],
  objectives: [],
  keyResults: [],
  projects: [],
  tasks: [],
  checkins: [],
  notifications: [],
  comments: [],
  auditLogs: [],
  approvalLogs: [],
  organizationHistory: [],
  settings: {
    companyName: 'FlowOKR Enterprise',
    checkinFrequency: 'WEEKLY',
    onTrackThreshold: 85,
    atRiskThreshold: 60,
  },
};

function buildInitialSeedState(
  ownerUserId: string,
  existingUsers: OkrUser[] = []
): DatabaseState {
  const now = new Date().toISOString();

  const base: DatabaseState = {
    cycles: [
      {
        cycleId: 'CYC-2026-Q4',
        nameVi: 'Quý 4 / 2026',
        nameKo: '2026년 4분기',
        cycleType: 'QUARTERLY',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        status: 'ACTIVE',
        createdAt: now,
      },
    ],
    departments: [
      {
        departmentId: 'DEPT-PROD',
        parentDepartmentId: '',
        nameVi: 'Phòng Sản phẩm',
        nameKo: '제품팀',
        managerId: ownerUserId,
        division: 'Khối Công nghệ & Sản phẩm',
        level: 'DEPARTMENT',
        sortOrder: 1,
        descriptionVi: 'Nghiên cứu và phát triển sản phẩm cốt lõi',
        descriptionKo: '핵심 제품 기획 및 개발',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        departmentId: 'DEPT-TECH',
        parentDepartmentId: '',
        nameVi: 'Phòng Kỹ thuật',
        nameKo: '기술개발부',
        managerId: '',
        division: 'Khối Công nghệ & Sản phẩm',
        level: 'DEPARTMENT',
        sortOrder: 2,
        descriptionVi: 'Kiến trúc hệ thống, Cloud & Google Workspace',
        descriptionKo: '시스템 아키텍처 및 클라우드 개발',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        departmentId: 'DEPT-SALES',
        parentDepartmentId: '',
        nameVi: 'Phòng Kinh doanh',
        nameKo: '영업부',
        managerId: '',
        division: 'Khối Kinh doanh',
        level: 'DEPARTMENT',
        sortOrder: 3,
        descriptionVi: 'Phát triển thị trường và khách hàng doanh nghiệp',
        descriptionKo: 'B2B 시장 확대 및 고객 확보',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        departmentId: 'DEPT-HR',
        parentDepartmentId: '',
        nameVi: 'Phòng Nhân sự & Vận hành',
        nameKo: '인사운영부',
        managerId: '',
        division: 'Khối Vận hành',
        level: 'DEPARTMENT',
        sortOrder: 4,
        descriptionVi: 'Quản trị nhân sự, phê duyệt và phát triển tổ chức',
        descriptionKo: '인사 관리 및 조직 문화 육성',
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    ],
    teams: [
      {
        teamId: 'TEAM-CORE',
        departmentId: 'DEPT-PROD',
        parentTeamId: '',
        nameVi: 'Nhóm Nền tảng OKR',
        nameKo: 'OKR 플랫폼 팀',
        managerId: ownerUserId,
        level: 'TEAM',
        sortOrder: 1,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
      {
        teamId: 'TEAM-SALES-1',
        departmentId: 'DEPT-SALES',
        parentTeamId: '',
        nameVi: 'Nhóm Sales Enterprise',
        nameKo: '엔터프라이즈 영업팀',
        managerId: '',
        level: 'TEAM',
        sortOrder: 2,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      },
    ],
    // Never hardcode fake employee accounts; preserve real Google-registered users only
    users: existingUsers,
    objectives: [
      {
        objectiveId: 'OBJ-1001',
        cycleId: 'CYC-2026-Q4',
        parentObjectiveId: '',
        level: 'Company',
        titleVi: 'Chuẩn hóa quản trị OKR & Cơ cấu tổ chức trên Google Workspace',
        titleKo: 'Google Workspace 기반 OKR 및 조직 체계 표준화',
        descriptionVi: 'Minh bạch mục tiêu, dự án và phân quyền theo sơ đồ tổ chức Quý 4/2026.',
        descriptionKo: '2026년 4분기 조직도 기반 목표·프로젝트 투명성 확보.',
        ownerId: ownerUserId,
        departmentId: 'DEPT-PROD',
        priority: 'HIGH',
        status: 'ON_TRACK',
        weight: 100,
        progress: 0,
        confidence: 9,
        startDate: '2026-10-01',
        dueDate: '2026-12-31',
        createdBy: ownerUserId,
        createdAt: now,
        updatedAt: now,
        deletedAt: '',
        version: 1,
      },
      {
        objectiveId: 'OBJ-1002',
        cycleId: 'CYC-2026-Q4',
        parentObjectiveId: 'OBJ-1001',
        level: 'Department',
        titleVi: 'Vận hành quy trình Phê duyệt Nhân sự & Đồng bộ Google Sheets ổn định',
        titleKo: '신규 계정 승인 프로세스 및 Google Sheets 동기화 안정화',
        descriptionVi: 'Đảm bảo 100% tài khoản mới được xác thực Google và phân bổ đúng phòng ban.',
        descriptionKo: '신규 계정의 100% Google 인증 및 부서 배정 완료.',
        ownerId: ownerUserId,
        departmentId: 'DEPT-TECH',
        priority: 'HIGH',
        status: 'ON_TRACK',
        weight: 50,
        progress: 0,
        confidence: 8,
        startDate: '2026-10-01',
        dueDate: '2026-12-31',
        createdBy: ownerUserId,
        createdAt: now,
        updatedAt: now,
        deletedAt: '',
        version: 1,
      },
    ],
    keyResults: [
      {
        krId: 'KR-2001',
        objectiveId: 'OBJ-1001',
        titleVi: 'Đạt 95% tỷ lệ nhân sự Check-in OKR hàng tuần đúng hạn',
        titleKo: '주간 정기 OKR 체크인 준수율 95% 달성',
        metricType: 'PERCENTAGE',
        direction: 'INCREASE',
        unit: '%',
        baselineValue: 50,
        currentValue: 86,
        targetValue: 95,
        weight: 1,
        progress: 80,
        ownerId: ownerUserId,
        startDate: '2026-10-01',
        dueDate: '2026-12-31',
        status: 'ON_TRACK',
        lastCheckinAt: now,
        deletedAt: '',
      },
      {
        krId: 'KR-2002',
        objectiveId: 'OBJ-1002',
        titleVi: 'Giảm thời gian đồng bộ dữ liệu Sheets xuống dưới 1.0 giây',
        titleKo: 'Sheets 데이터 동기화 시간 1.0초 미만 달성',
        metricType: 'NUMBER',
        direction: 'DECREASE',
        unit: 'giây',
        baselineValue: 2.4,
        currentValue: 1.2,
        targetValue: 0.9,
        weight: 1,
        progress: 80,
        ownerId: ownerUserId,
        startDate: '2026-10-01',
        dueDate: '2026-12-31',
        status: 'ON_TRACK',
        lastCheckinAt: now,
        deletedAt: '',
      },
    ],
    projects: [
      {
        projectId: 'PRJ-5001',
        objectiveId: 'OBJ-1001',
        departmentId: 'DEPT-PROD',
        nameVi: 'Triển khai Cổng OKR & Sơ đồ Tổ chức Tập trung',
        nameKo: '통합 OKR 및 조직도 포털 구축',
        descriptionVi: 'Hợp nhất OKR, Dự án, Kanban và Sơ đồ tổ chức trên Google Sheets.',
        descriptionKo: 'OKR, 프로젝트, 칸반 및 조직도를 Google Sheets로 통합 관리합니다.',
        ownerId: ownerUserId,
        status: 'ACTIVE',
        priority: 'HIGH',
        progress: 65,
        budget: 120000000,
        currency: 'VND',
        startDate: '2026-10-05',
        dueDate: '2026-12-20',
        driveLink: '',
        deletedAt: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
    tasks: [
      {
        taskId: 'TSK-3001',
        projectId: 'PRJ-5001',
        objectiveId: 'OBJ-1001',
        krId: 'KR-2001',
        titleVi: 'Thiết lập cấu trúc Phòng ban & Nhóm trên Google Sheets',
        titleKo: 'Google Sheets에 부서 및 팀 구조 구성',
        ownerId: ownerUserId,
        priority: 'HIGH',
        status: 'DONE',
        dueDate: '2026-11-10',
        estimatedHours: 4,
        progress: 100,
        deletedAt: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        taskId: 'TSK-3002',
        projectId: 'PRJ-5001',
        objectiveId: 'OBJ-1002',
        krId: 'KR-2002',
        titleVi: 'Kiểm thử luồng xác thực Google & phê duyệt tài khoản mới',
        titleKo: 'Google 인증 및 신규 계정 승인 워크플로우 테스트',
        ownerId: ownerUserId,
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: '2026-11-22',
        estimatedHours: 6,
        progress: 60,
        deletedAt: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
    checkins: [
      {
        checkInId: 'CI-4001',
        krId: 'KR-2001',
        objectiveId: 'OBJ-1001',
        cycleId: 'CYC-2026-Q4',
        currentValue: 86,
        calculatedProgress: 80,
        confidenceScore: 9,
        status: 'ON_TRACK',
        winsVi: 'Hoàn tất cấu trúc 15 tab dữ liệu trên Google Sheets.',
        winsKo: 'Google Sheets 15개 데이터베이스 시트 구조 완료.',
        blockersVi: 'Không có rào cản lớn.',
        nextStepsVi: 'Phê duyệt nhân sự phòng ban tham gia Check-in.',
        evidenceUrl: '',
        ownerId: ownerUserId,
        createdAt: now,
      },
    ],
    notifications: [
      {
        notificationId: 'NOTIF-01',
        userId: ownerUserId,
        type: 'INFO',
        titleVi: 'Kết nối Google Drive & Sheets thành công',
        titleKo: 'Google Drive 및 Sheets 연결 완료',
        messageVi: 'Hệ thống OKR & Sơ đồ tổ chức đã sẵn sàng trên Google Drive.',
        messageKo: 'OKR 및 조직도 시스템이 Google Drive와 연결되었습니다.',
        isRead: false,
        createdAt: now,
      },
    ],
    comments: [],
    auditLogs: [
      {
        logId: `LOG-${Date.now()}`,
        userId: ownerUserId,
        action: 'SEED_STARTER_OKR',
        entityType: 'SYSTEM',
        entityId: 'ALL',
        newValue: 'Initialized starter Cycles, Departments, Teams, and OKRs',
        timestamp: now,
      },
    ],
    approvalLogs: [],
    organizationHistory: [],
    settings: {
      companyName: 'FlowOKR Enterprise',
      checkinFrequency: 'WEEKLY',
      onTrackThreshold: 85,
      atRiskThreshold: 60,
    },
  };

  return recalculateDatabaseScores(base);
}

export default function FlowOkrApp() {
  // Preferences (UI only — never store OAuth token or business OKR data in localStorage)
  const [lang, setLang] = useState<Lang>('vi');
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Auth & Workspace Connection State
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [avatarFailed, setAvatarFailed] = useState<boolean>(false);

  const [driveFolder, setDriveFolder] = useState<DriveFileItem | null>(null);
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<DriveFileItem[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [activeSpreadsheetId, setActiveSpreadsheetId] = useState<string>('');
  const [activeSpreadsheetName, setActiveSpreadsheetName] = useState<string>('');
  const [activeSpreadsheetUrl, setActiveSpreadsheetUrl] = useState<string>('');

  // Server-authoritative User Profile & Approval Gate (derived from backend Google sub + USERS tab)
  const [currentUserProfile, setCurrentUserProfile] = useState<OkrUser | null>(null);
  const [accountStatus, setAccountStatus] = useState<
    AccountStatus | 'UNREGISTERED' | 'NO_SHEET' | null
  >(null);
  const [canOwnerBootstrap, setCanOwnerBootstrap] = useState<boolean>(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [customSpreadsheetInput, setCustomSpreadsheetInput] = useState<string>('');
  const activeRole: UserRole = currentUserProfile?.role || 'VIEWER';

  // Loading, Sync & Toasts
  const [loadingText, setLoadingText] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<'ready' | 'syncing' | 'disconnected' | 'error'>('disconnected');
  const [lastSyncTime, setLastSyncTime] = useState<string>('--:--');
  const [referenceNow, setReferenceNow] = useState<number>(() => Date.now());
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'info' | 'error' }>>([]);

  // Authoritative Database State (Mirrored with Google Sheets)
  const [db, setDb] = useState<DatabaseState>(EMPTY_DB);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCycleId, setSelectedCycleId] = useState('ALL');
  const [dashDeptFilter, setDashDeptFilter] = useState('ALL');
  const [dashStatusFilter, setDashStatusFilter] = useState('ALL');
  const [dashChartMode, setDashChartMode] = useState<'weekly' | 'department'>('weekly');

  const [objViewMode, setObjViewMode] = useState<'card' | 'table' | 'hierarchy'>('card');
  const [selectedDeptTab, setSelectedDeptTab] = useState('ALL');
  const [objLevelFilter, setObjLevelFilter] = useState('ALL');
  const [objStatusFilter, setObjStatusFilter] = useState('ALL');
  const [showDeletedObj, setShowDeletedObj] = useState(false);

  const [krObjFilter, setKrObjFilter] = useState('ALL');
  const [krTypeFilter, setKrTypeFilter] = useState('ALL');
  const [projStatusFilter, setProjStatusFilter] = useState('ALL');
  const [kanbanProjectFilter, setKanbanProjectFilter] = useState('ALL');
  const [kanbanObjFilter, setKanbanObjFilter] = useState('ALL');
  const [reportType, setReportType] = useState('COMPANY_OKR');
  const [tplCategory, setTplCategory] = useState('ALL');
  const [guideFilter, setGuideFilter] = useState('ALL');
  const [newSheetNameInput, setNewSheetNameInput] = useState('FlowOKR_Enterprise_DB');

  // Modals
  const [okrModal, setOkrModal] = useState<{ open: boolean; data: ObjectiveFormState | null }>({
    open: false,
    data: null,
  });
  const [krModal, setKrModal] = useState<{ open: boolean; data: Partial<KeyResult> | null }>({
    open: false,
    data: null,
  });
  const [projectModal, setProjectModal] = useState<{ open: boolean; data: Partial<ProjectItem> | null }>({
    open: false,
    data: null,
  });
  const [taskModal, setTaskModal] = useState<{ open: boolean; data: Partial<TaskItem> | null }>({
    open: false,
    data: null,
  });
  const [checkinModal, setCheckinModal] = useState<CheckInFormState>({
    open: false,
    kr: null,
    currentValue: 0,
    confidence: 8,
    status: 'ON_TRACK',
    winsVi: '',
    winsKo: '',
    blockersVi: '',
    nextStepsVi: '',
    evidenceUrl: '',
  });
  const [detailModalObjId, setDetailModalObjId] = useState<string | null>(null);
  const [detailCommentInput, setDetailCommentInput] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    tone?: 'danger' | 'primary';
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const t = I18N[lang];

  const showToast = useCallback((message: string, type: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  const applyThemeToDom = useCallback((mode: ThemeMode) => {
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // Load saved UI preferences (theme default = system, language, optional org sheet link) on mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedLang = localStorage.getItem('flowokr_lang');
      if (savedLang === 'vi' || savedLang === 'ko') setLang(savedLang);
      const savedTheme = localStorage.getItem('flowokr_theme');
      const initialTheme: ThemeMode =
        savedTheme === 'dark' || savedTheme === 'light' || savedTheme === 'system'
          ? savedTheme
          : 'system';
      setTheme(initialTheme);
      applyThemeToDom(initialTheme);

      const savedOrgSheet = localStorage.getItem('flowokr_custom_sheet');
      if (savedOrgSheet) setCustomSpreadsheetInput(savedOrgSheet);
      // Also inspect ?workspace= query param if shared by Admin
      const params = new URLSearchParams(window.location.search);
      const wsParam = params.get('workspace');
      if (wsParam) {
        setCustomSpreadsheetInput(wsParam);
        localStorage.setItem('flowokr_custom_sheet', wsParam);
      }
      setReferenceNow(Date.now());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [applyThemeToDom]);

  // Listen for OS theme changes when set to 'system'
  useEffect(() => {
    applyThemeToDom(theme);
    if (theme !== 'system' || typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleOsThemeChange = () => applyThemeToDom('system');
    mediaQuery.addEventListener('change', handleOsThemeChange);
    return () => mediaQuery.removeEventListener('change', handleOsThemeChange);
  }, [theme, applyThemeToDom]);

  const toggleTheme = () => {
    const next: ThemeMode =
      theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
    setTheme(next);
    localStorage.setItem('flowokr_theme', next);
    applyThemeToDom(next);
  };

  const handleLanguageSwitch = (nextLang: Lang) => {
    setLang(nextLang);
    localStorage.setItem('flowokr_lang', nextLang);
    showToast(
      nextLang === 'ko'
        ? '언어가 한국어(KO)로 전환되었습니다.'
        : 'Đã chuyển giao diện sang Tiếng Việt (VI).'
    );
  };

  // Load workspace from Google Drive & Sheets with backend ID Token + Account Status verification
  const connectAndLoadWorkspace = useCallback(
    async (user: User, explicitIdToken?: string, overrideSheetId?: string) => {
      if (!getAccessToken()) {
        setNeedsAuth(true);
        return;
      }
      setLoadingText(t.syncing);
      setSyncStatus('syncing');
      try {
        // Ensure backend signed session cookie is established via cryptographic ID token verification
        const freshIdToken = explicitIdToken || (await getFreshIdToken());
        if (!freshIdToken) {
          setNeedsAuth(true);
          return;
        }
        await verifySessionWithBackend(freshIdToken);

        const ws = await fetchDriveWorkspace();
        setDriveFolder(ws.folder);
        setDriveSpreadsheets(ws.spreadsheets);
        setDriveFiles(ws.files);

        const customId = overrideSheetId || extractSpreadsheetId(customSpreadsheetInput);
        const savedSheetId = localStorage.getItem(`flowokr_sheet_${user.uid}`);
        const targetSheetId =
          customId ||
          ws.spreadsheets.find((s) => s.id === savedSheetId)?.id ||
          ws.spreadsheets[0]?.id ||
          '';

        if (targetSheetId) {
          setActiveSpreadsheetId(targetSheetId);
          localStorage.setItem(`flowokr_sheet_${user.uid}`, targetSheetId);
          try {
            const loaded = await loadSpreadsheetDatabase(targetSheetId);
            setActiveSpreadsheetName(loaded.title);
            setActiveSpreadsheetUrl(loaded.spreadsheetUrl);

            const normalized = recalculateDatabaseScores(loaded.data);
            setDb(normalized);
            setCurrentUserProfile(loaded.currentUser);
            setAccountStatus('APPROVED');
            setCanOwnerBootstrap(false);
            setPendingCount(loaded.pendingCount || 0);
            setSyncStatus('ready');
            setLastSyncTime(
              new Date().toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            );
          } catch (loadErr: unknown) {
            if (loadErr instanceof ApiError && loadErr.code === 'ACCOUNT_NOT_APPROVED') {
              // User is PENDING, REJECTED, SUSPENDED, or INACTIVE — block Dashboard & clear DB
              setDb(EMPTY_DB);
              setCurrentUserProfile(loadErr.user || null);
              setAccountStatus(loadErr.accountStatus || 'PENDING');
              setCanOwnerBootstrap(Boolean(loadErr.canOwnerBootstrap));
              setPendingCount(0);
              setSyncStatus('ready');
              return;
            }
            throw loadErr;
          }
        } else {
          // No spreadsheet in FlowOKR_Workspace yet (Drive owner can initialize their first Sheet)
          setActiveSpreadsheetId('');
          setActiveSpreadsheetName('');
          setActiveSpreadsheetUrl('');
          setAccountStatus('NO_SHEET');
          setCurrentUserProfile(null);
          setSyncStatus('disconnected');
        }
      } catch (err: unknown) {
        const e = err as Error;
        setSyncStatus('error');
        showToast(e.message || 'Lỗi kết nối Google Drive & Sheets', 'error');
      } finally {
        setLoadingText('');
      }
    },
    [customSpreadsheetInput, lang, showToast, t.syncing]
  );

  // Firebase Auth state listener
  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setAuthUser(user);
        setNeedsAuth(false);
        setAvatarFailed(false);
        connectAndLoadWorkspace(user);
      },
      (user) => {
        setAuthUser(user);
        setNeedsAuth(true);
        setSyncStatus('disconnected');
      }
    );
    return () => unsub();
  }, [connectAndLoadWorkspace]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      if (customSpreadsheetInput.trim()) {
        localStorage.setItem('flowokr_custom_sheet', extractSpreadsheetId(customSpreadsheetInput));
      } else {
        localStorage.removeItem('flowokr_custom_sheet');
      }
      const result = await googleSignIn();
      setAuthUser(result.user);
      setNeedsAuth(false);
      setAvatarFailed(false);
      await connectAndLoadWorkspace(
        result.user,
        result.idToken,
        customSpreadsheetInput.trim() ? extractSpreadsheetId(customSpreadsheetInput) : undefined
      );
      showToast('Xác thực tài khoản Google thành công!');
    } catch (err: unknown) {
      const e = err as Error;
      setAuthError(e.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
      showToast(e.message || 'Đăng nhập Google thất bại', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRefreshAccountStatus = async () => {
    if (!authUser || !activeSpreadsheetId) return;
    setLoadingText('Đang kiểm tra trạng thái phê duyệt...');
    try {
      const statusRes = await fetchCurrentUserStatus(activeSpreadsheetId);
      setCurrentUserProfile(statusRes.user);
      setAccountStatus(statusRes.accountStatus);
      setCanOwnerBootstrap(statusRes.canOwnerBootstrap);
      if (statusRes.accountStatus === 'APPROVED') {
        await connectAndLoadWorkspace(authUser);
        showToast('Tài khoản của bạn đã được phê duyệt! Chào mừng đến với FlowOKR.');
      } else {
        showToast(`Trạng thái hiện tại: ${statusRes.accountStatus}`);
      }
    } catch (err: unknown) {
      const e = err as Error;
      showToast(e.message, 'error');
    } finally {
      setLoadingText('');
    }
  };

  const handleBootstrapOwnerAdmin = async () => {
    if (!authUser || !activeSpreadsheetId) return;
    setLoadingText('Đang xác minh Chủ sở hữu Drive & khởi tạo Quản trị viên...');
    try {
      await bootstrapOwnerAdmin(activeSpreadsheetId);
      await connectAndLoadWorkspace(authUser);
      showToast('Đã khởi tạo Quản trị viên (ADMIN) đầu tiên thành công!');
    } catch (err: unknown) {
      const e = err as Error;
      showToast(e.message, 'error');
    } finally {
      setLoadingText('');
    }
  };

  const handleLogout = async () => {
    await signOutBackendSession();
    await logout();
    setAuthUser(null);
    setCurrentUserProfile(null);
    setAccountStatus(null);
    setCanOwnerBootstrap(false);
    setPendingCount(0);
    setNeedsAuth(true);
    setDb(EMPTY_DB);
    setActiveSpreadsheetId('');
    setDriveFolder(null);
    setDriveSpreadsheets([]);
    setDriveFiles([]);
    setSyncStatus('disconnected');
    showToast('Đã đăng xuất tài khoản Google.');
  };

  // Persist mutated DatabaseState to Google Sheets
  const commitDatabaseChange = useCallback(
    async (updater: (prev: DatabaseState) => DatabaseState, toastMessage?: string) => {
      if (!activeSpreadsheetId) {
        showToast('Vui lòng tạo hoặc chọn Google Sheet cơ sở dữ liệu trước khi lưu.', 'error');
        return;
      }
      if (!getAccessToken()) {
        setNeedsAuth(true);
        showToast('Phiên truy cập Google đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        return;
      }

      const nextState = recalculateDatabaseScores(updater(db));
      setDb(nextState);
      setSyncStatus('syncing');
      try {
        await syncStateToGoogleSheet(activeSpreadsheetId, nextState);
        setSyncStatus('ready');
        setLastSyncTime(
          new Date().toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
        if (toastMessage) showToast(toastMessage);
      } catch (err: unknown) {
        const e = err as Error;
        setSyncStatus('error');
        showToast(e.message || 'Lỗi đồng bộ Google Sheets', 'error');
      }
    },
    [activeSpreadsheetId, db, lang, showToast]
  );

  const handleApprovalAction = async (
    payload: Record<string, unknown>,
    successMsg: string
  ) => {
    if (!activeSpreadsheetId) return;
    setSyncStatus('syncing');
    try {
      const res = await postApprovalAction(activeSpreadsheetId, payload);
      const normalized = recalculateDatabaseScores(res.db);
      setDb(normalized);
      setPendingCount(normalized.users.filter((u) => u.accountStatus === 'PENDING').length);
      if (currentUserProfile && res.user.userId === currentUserProfile.userId) {
        setCurrentUserProfile(res.user);
      }
      setSyncStatus('ready');
      showToast(successMsg);
    } catch (err: unknown) {
      const e = err as Error;
      setSyncStatus('error');
      showToast(e.message, 'error');
      throw err;
    }
  };

  const handleOrgAction = async (
    payload: Record<string, unknown>,
    successMsg: string
  ) => {
    if (!activeSpreadsheetId) return;
    setSyncStatus('syncing');
    try {
      const res = await postOrganizationAction(activeSpreadsheetId, payload);
      const normalized = recalculateDatabaseScores(res.db);
      setDb(normalized);
      if (currentUserProfile) {
        const refreshedSelf = normalized.users.find((u) => u.userId === currentUserProfile.userId);
        if (refreshedSelf) setCurrentUserProfile(refreshedSelf);
      }
      setSyncStatus('ready');
      showToast(successMsg);
    } catch (err: unknown) {
      const e = err as Error;
      setSyncStatus('error');
      showToast(e.message, 'error');
      throw err;
    }
  };

  const handleCreateSpreadsheet = async (withDemoData: boolean) => {
    if (!authUser) return;
    setLoadingText('Đang tạo Google Sheet trong thư mục FlowOKR_Workspace...');
    try {
      const actorId = currentUserProfile?.userId || authUser.uid;
      const initialState = withDemoData
        ? buildInitialSeedState(actorId, [])
        : {
            ...EMPTY_DB,
            cycles: [
              {
                cycleId: 'CYC-2026-Q4',
                nameVi: 'Quý 4 / 2026',
                nameKo: '2026년 4분기',
                cycleType: 'QUARTERLY',
                startDate: '2026-10-01',
                endDate: '2026-12-31',
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
              },
            ],
            departments: [
              {
                departmentId: 'DEPT-PROD',
                parentDepartmentId: '',
                nameVi: 'Phòng Sản phẩm',
                nameKo: '제품팀',
                managerId: '',
                division: 'Khối Công nghệ & Sản phẩm',
                level: 'DEPARTMENT',
                sortOrder: 1,
                descriptionVi: '',
                descriptionKo: '',
                status: 'ACTIVE',
              },
              {
                departmentId: 'DEPT-TECH',
                parentDepartmentId: '',
                nameVi: 'Phòng Kỹ thuật',
                nameKo: '기술개발부',
                managerId: '',
                division: 'Khối Công nghệ & Sản phẩm',
                level: 'DEPARTMENT',
                sortOrder: 2,
                descriptionVi: '',
                descriptionKo: '',
                status: 'ACTIVE',
              },
              {
                departmentId: 'DEPT-SALES',
                parentDepartmentId: '',
                nameVi: 'Phòng Kinh doanh',
                nameKo: '영업부',
                managerId: '',
                division: 'Khối Kinh doanh',
                level: 'DEPARTMENT',
                sortOrder: 3,
                descriptionVi: '',
                descriptionKo: '',
                status: 'ACTIVE',
              },
            ],
            teams: [],
            users: [],
          };

      const res = await bootstrapNewSpreadsheet(
        newSheetNameInput.trim() || 'FlowOKR_Enterprise_DB',
        initialState
      );
      setDriveFolder(res.folder);
      setActiveSpreadsheetId(res.spreadsheet.id);
      setActiveSpreadsheetName(res.title);
      setActiveSpreadsheetUrl(res.spreadsheetUrl);
      localStorage.setItem(`flowokr_sheet_${authUser.uid}`, res.spreadsheet.id);
      const ws = await fetchDriveWorkspace();
      setDriveSpreadsheets(ws.spreadsheets);
      setDriveFiles(ws.files);

      if (res.accountStatus !== 'APPROVED' || !res.data) {
        setDb(EMPTY_DB);
        setCurrentUserProfile(res.user || null);
        setAccountStatus(res.accountStatus || 'PENDING');
        setCanOwnerBootstrap(Boolean(res.canOwnerBootstrap));
        setSyncStatus('ready');
        showToast('Đã tạo Google Sheet! Vui lòng xác minh Chủ sở hữu hoặc chờ phê duyệt.');
        return;
      }

      setDb(recalculateDatabaseScores(res.data));
      setCurrentUserProfile(res.currentUser || null);
      setAccountStatus('APPROVED');
      setCanOwnerBootstrap(false);
      setSyncStatus('ready');
      setLastSyncTime(
        new Date().toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      showToast('Đã tạo thành công bảng tính Google Sheets trong Google Drive!');
    } catch (err: unknown) {
      const e = err as Error;
      showToast(e.message || 'Không thể khởi tạo Google Sheet', 'error');
    } finally {
      setLoadingText('');
    }
  };

  const handleSelectSpreadsheet = async (sheetId: string) => {
    if (!authUser || !sheetId) return;
    setLoadingText('Đang tải dữ liệu từ Google Sheet...');
    try {
      await connectAndLoadWorkspace(authUser, undefined, sheetId);
    } catch (err: unknown) {
      const e = err as Error;
      showToast(e.message, 'error');
    } finally {
      setLoadingText('');
    }
  };

  const handleUploadFileToDrive = async (file: File): Promise<string | null> => {
    setLoadingText(`Đang tải "${file.name}" lên Google Drive...`);
    try {
      const res = await uploadFileToDrive(file, driveFolder?.id, activeSpreadsheetId);
      const ws = await fetchDriveWorkspace();
      setDriveFiles(ws.files);
      showToast(`Đã lưu tệp "${file.name}" vào thư mục Google Drive!`);
      return res.file.webViewLink || null;
    } catch (err: unknown) {
      const e = err as Error;
      showToast(e.message, 'error');
      return null;
    } finally {
      setLoadingText('');
    }
  };

  // Localization helpers
  const getRawLocalized = useCallback(
    (obj: unknown, fieldPrefix: string): string => {
      if (!obj || typeof obj !== 'object') return '';
      const rec = obj as Record<string, unknown>;
      const vi = String(rec[`${fieldPrefix}Vi`] || rec[fieldPrefix] || '');
      const ko = String(rec[`${fieldPrefix}Ko`] || '');
      if (lang === 'ko') return ko || vi;
      return vi || ko;
    },
    [lang]
  );

  const renderLocalized = useCallback(
    (obj: unknown, fieldPrefix: string): React.ReactNode => {
      if (!obj || typeof obj !== 'object') return '';
      const rec = obj as Record<string, unknown>;
      const vi = String(rec[`${fieldPrefix}Vi`] || rec[fieldPrefix] || '');
      const ko = String(rec[`${fieldPrefix}Ko`] || '');
      if (lang === 'ko') {
        if (ko.trim()) return ko;
        return (
          <span>
            {vi}{' '}
            <span className="text-[11px] font-normal text-amber-600 dark:text-amber-400">
              · {I18N.ko.missingTranslationBadge}
            </span>
          </span>
        );
      }
      return vi || ko;
    },
    [lang]
  );

  // ==========================================================================
  // COMPUTED METRICS & FILTERS
  // ==========================================================================
  const filteredDashboardObjectives = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return db.objectives.filter((o) => {
      if (o.deletedAt) return false;
      if (selectedCycleId !== 'ALL' && o.cycleId !== selectedCycleId) return false;
      if (dashDeptFilter !== 'ALL' && o.departmentId !== dashDeptFilter) return false;
      if (dashStatusFilter !== 'ALL' && o.status !== dashStatusFilter) return false;
      if (q && !(o.titleVi || '').toLowerCase().includes(q) && !(o.titleKo || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [db.objectives, searchQuery, selectedCycleId, dashDeptFilter, dashStatusFilter]);

  const dashboardMetrics = useMemo(() => {
    const activeObjs = filteredDashboardObjectives;
    const objIds = new Set(activeObjs.map((o) => o.objectiveId));
    const activeKrs = db.keyResults.filter(
      (k) => !k.deletedAt && (objIds.has(k.objectiveId) || db.objectives.length === 0)
    );
    const activeProjects = db.projects.filter((p) => !p.deletedAt);
    const activeTasks = db.tasks.filter((tItem) => !tItem.deletedAt);

    const completedKrs = activeKrs.filter(
      (k) => Number(k.progress) >= 100 || k.status === 'COMPLETED'
    ).length;
    const onTrackObjs = activeObjs.filter(
      (o) => o.status === 'ON_TRACK' || o.status === 'COMPLETED'
    ).length;
    const atRiskObjs = activeObjs.filter((o) => o.status === 'AT_RISK').length;
    const behindObjs = activeObjs.filter(
      (o) => o.status === 'BEHIND' || o.status === 'NOT_STARTED'
    ).length;
    const overdueTasks = activeTasks.filter(
      (tk) => tk.status !== 'DONE' && tk.dueDate && new Date(tk.dueDate) < new Date()
    ).length;

    const sevenDaysAgo = referenceNow - 7 * 86400000;
    const recentCheckedKrs = activeKrs.filter(
      (k) => k.lastCheckinAt && new Date(k.lastCheckinAt).getTime() >= sevenDaysAgo
    ).length;
    const checkinRate =
      activeKrs.length > 0 ? Math.round((recentCheckedKrs / activeKrs.length) * 100) : 0;

    const avgPct =
      activeObjs.length > 0
        ? activeObjs.reduce((s, o) => s + (Number(o.progress) || 0), 0) / activeObjs.length
        : 0;

    return {
      totalObjs: activeObjs.length,
      allActiveObjsCount: db.objectives.filter((o) => !o.deletedAt).length,
      completedKrs,
      totalKrs: activeKrs.length,
      activeProjectsCount: activeProjects.filter((p) => p.status !== 'COMPLETED').length,
      totalProjectsCount: activeProjects.length,
      doneTasksCount: activeTasks.filter((tk) => tk.status === 'DONE').length,
      totalTasksCount: activeTasks.length,
      onTrackObjs,
      atRiskObjs,
      behindObjs,
      overdueTasks,
      checkinRate,
      avgScore: (avgPct / 100).toFixed(2),
    };
  }, [filteredDashboardObjectives, db.keyResults, db.projects, db.tasks, db.objectives, referenceNow]);

  const filteredManagementObjectives = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return db.objectives.filter((o) => {
      if (showDeletedObj ? !o.deletedAt : !!o.deletedAt) return false;
      if (selectedCycleId !== 'ALL' && o.cycleId !== selectedCycleId) return false;
      if (selectedDeptTab !== 'ALL' && o.departmentId !== selectedDeptTab) return false;
      if (objLevelFilter !== 'ALL' && o.level !== objLevelFilter) return false;
      if (objStatusFilter !== 'ALL' && o.status !== objStatusFilter) return false;
      if (q && !(o.titleVi || '').toLowerCase().includes(q) && !(o.titleKo || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [db.objectives, showDeletedObj, selectedCycleId, selectedDeptTab, objLevelFilter, objStatusFilter, searchQuery]);

  const weeklyBarData = useMemo(() => {
    if (dashChartMode === 'department') {
      return db.departments.map((d) => {
        const objs = db.objectives.filter((o) => !o.deletedAt && o.departmentId === d.departmentId);
        const val = objs.length
          ? Math.round(objs.reduce((s, o) => s + (Number(o.progress) || 0), 0) / objs.length)
          : 0;
        return { label: getRawLocalized(d, 'name'), value: val, suffix: '%' };
      });
    }
    const arr: Array<{ label: string; value: number; suffix: string }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoPrefix = d.toISOString().slice(0, 10);
      const count = db.checkins.filter((c) => (c.createdAt || '').startsWith(isoPrefix)).length;
      arr.push({
        label: d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'vi-VN', { weekday: 'short' }),
        value: count,
        suffix: '',
      });
    }
    return arr;
  }, [dashChartMode, db.departments, db.objectives, db.checkins, getRawLocalized, lang]);

  // ==========================================================================
  // CRUD HANDLERS (ALL PERSIST TO GOOGLE SHEETS)
  // ==========================================================================
  const requireWritePermission = (): boolean => {
    if (activeRole === 'VIEWER') {
      showToast('Vai trò VIEWER chỉ có quyền xem dữ liệu.', 'error');
      return false;
    }
    if (!activeSpreadsheetId) {
      showToast('Hãy tạo hoặc kết nối Google Sheet cơ sở dữ liệu trước.', 'error');
      return false;
    }
    return true;
  };

  const openAddOkrModal = (prefill?: { titleVi?: string; titleKo?: string; krVi?: string }) => {
    if (!requireWritePermission()) return;
    const endDefault = new Date();
    endDefault.setDate(endDefault.getDate() + 90);
    setOkrModal({
      open: true,
      data: {
        objectiveId: '',
        version: 1,
        titleVi: prefill?.titleVi || '',
        titleKo: prefill?.titleKo || '',
        descriptionVi: '',
        descriptionKo: '',
        cycleId: db.cycles[0]?.cycleId || 'CYC-2026-Q4',
        level: 'Department',
        departmentId:
          currentUserProfile?.departmentId || db.departments[0]?.departmentId || 'DEPT-PROD',
        ownerId: currentUserProfile?.userId || authUser?.uid || 'USER',
        parentObjectiveId: '',
        weight: 100,
        startDate: new Date().toISOString().slice(0, 10),
        dueDate: endDefault.toISOString().slice(0, 10),
        initKrTitle: prefill?.krVi || '',
        initKrTarget: prefill?.krVi ? 100 : '',
        initKrUnit: '%',
      },
    });
  };

  const openEditOkrModal = (obj: Objective) => {
    if (!requireWritePermission()) return;
    setOkrModal({
      open: true,
      data: {
        objectiveId: obj.objectiveId,
        version: obj.version || 1,
        titleVi: obj.titleVi,
        titleKo: obj.titleKo || '',
        descriptionVi: obj.descriptionVi || '',
        descriptionKo: obj.descriptionKo || '',
        cycleId: obj.cycleId,
        level: obj.level,
        departmentId: obj.departmentId,
        ownerId: obj.ownerId,
        parentObjectiveId: obj.parentObjectiveId || '',
        weight: obj.weight || 100,
        startDate: (obj.startDate || '').slice(0, 10),
        dueDate: (obj.dueDate || '').slice(0, 10),
        initKrTitle: '',
        initKrTarget: '',
        initKrUnit: '%',
      },
    });
  };

  const handleSaveOkrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!okrModal.data || !requireWritePermission()) return;
    const d = okrModal.data;
    const now = new Date().toISOString();
    const actor = currentUserProfile?.userId || authUser?.uid || 'USER';

    await commitDatabaseChange(
      (prev) => {
        let nextObjs = [...prev.objectives];
        const nextKrs = [...prev.keyResults];
        let targetId = d.objectiveId;

        if (d.objectiveId) {
          nextObjs = nextObjs.map((o) =>
            o.objectiveId === d.objectiveId
              ? {
                  ...o,
                  ...d,
                  version: Number(o.version || 1) + 1,
                  updatedAt: now,
                }
              : o
          );
        } else {
          targetId = `OBJ-${Date.now()}`;
          nextObjs.unshift({
            objectiveId: targetId,
            cycleId: d.cycleId,
            parentObjectiveId: d.parentObjectiveId,
            level: d.level,
            titleVi: d.titleVi,
            titleKo: d.titleKo,
            descriptionVi: d.descriptionVi,
            descriptionKo: d.descriptionKo,
            ownerId: d.ownerId || actor,
            departmentId: d.departmentId,
            priority: 'HIGH',
            status: 'NOT_STARTED',
            weight: Number(d.weight) || 100,
            progress: 0,
            confidence: 8,
            startDate: d.startDate,
            dueDate: d.dueDate,
            createdBy: actor,
            createdAt: now,
            updatedAt: now,
            deletedAt: '',
            version: 1,
          });
          if (d.initKrTitle.trim()) {
            nextKrs.push({
              krId: `KR-${Date.now() + 1}`,
              objectiveId: targetId,
              titleVi: d.initKrTitle.trim(),
              titleKo: '',
              metricType: 'NUMBER',
              direction: 'INCREASE',
              unit: d.initKrUnit || '%',
              baselineValue: 0,
              currentValue: 0,
              targetValue: Number(d.initKrTarget) || 100,
              weight: 1,
              progress: 0,
              ownerId: d.ownerId || actor,
              startDate: d.startDate,
              dueDate: d.dueDate,
              status: 'NOT_STARTED',
              deletedAt: '',
            });
          }
        }
        return {
          ...prev,
          objectives: nextObjs,
          keyResults: nextKrs,
          auditLogs: [
            {
              logId: `LOG-${Date.now()}`,
              userId: actor,
              action: d.objectiveId ? 'UPDATE_OBJECTIVE' : 'CREATE_OBJECTIVE',
              entityType: 'OBJECTIVE',
              entityId: targetId,
              newValue: d.titleVi,
              timestamp: now,
            },
            ...prev.auditLogs,
          ],
        };
      },
      d.objectiveId ? 'Đã cập nhật Mục tiêu lên Google Sheets!' : 'Đã tạo Mục tiêu mới lên Google Sheets!'
    );
    setOkrModal({ open: false, data: null });
  };

  const handleDeleteOrRestoreObjective = (obj: Objective, isRestore: boolean) => {
    if (!requireWritePermission()) return;
    setConfirmDialog({
      open: true,
      title: isRestore ? 'Khôi phục Mục tiêu trên Google Sheets' : 'Xóa mềm Mục tiêu trên Google Sheets',
      message: isRestore
        ? `Xác nhận khôi phục mục tiêu "${getRawLocalized(obj, 'title')}" trong Google Sheet "${activeSpreadsheetName}"?`
        : `Mục tiêu "${getRawLocalized(obj, 'title')}" sẽ được đánh dấu xóa mềm trong Google Sheet "${activeSpreadsheetName}". Bạn vẫn có thể khôi phục từ Thùng rác.`,
      confirmLabel: isRestore ? 'Khôi phục' : 'Chuyển vào Thùng rác',
      tone: isRestore ? 'primary' : 'danger',
      onConfirm: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        const now = new Date().toISOString();
        await commitDatabaseChange(
          (prev) => ({
            ...prev,
            objectives: prev.objectives.map((o) =>
              o.objectiveId === obj.objectiveId ? { ...o, deletedAt: isRestore ? '' : now } : o
            ),
            auditLogs: [
              {
                logId: `LOG-${Date.now()}`,
                userId: currentUserProfile?.userId || authUser?.uid || 'USER',
                action: isRestore ? 'RESTORE_OBJECTIVE' : 'SOFT_DELETE_OBJECTIVE',
                entityType: 'OBJECTIVE',
                entityId: obj.objectiveId,
                newValue: obj.titleVi,
                timestamp: now,
              },
              ...prev.auditLogs,
            ],
          }),
          isRestore ? 'Đã khôi phục Mục tiêu!' : 'Đã chuyển Mục tiêu vào Thùng rác!'
        );
      },
    });
  };

  const openKrModal = (objectiveId = '', kr: KeyResult | null = null) => {
    if (!requireWritePermission()) return;
    const activeObjs = db.objectives.filter((o) => !o.deletedAt);
    setKrModal({
      open: true,
      data: kr
        ? { ...kr }
        : {
            krId: '',
            objectiveId: objectiveId || activeObjs[0]?.objectiveId || '',
            titleVi: '',
            titleKo: '',
            metricType: 'NUMBER',
            direction: 'INCREASE',
            unit: '%',
            weight: 1,
            baselineValue: 0,
            currentValue: 0,
            targetValue: 100,
            ownerId: currentUserProfile?.userId || authUser?.uid || 'USER',
          },
    });
  };

  const handleSaveKrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!krModal.data || !requireWritePermission()) return;
    const d = krModal.data;
    const now = new Date().toISOString();
    const krId = d.krId || `KR-${Date.now()}`;
    await commitDatabaseChange(
      (prev) => {
        const exists = prev.keyResults.some((k) => k.krId === krId);
        const nextKrs = exists
          ? prev.keyResults.map((k) => (k.krId === krId ? { ...k, ...d } : k))
          : [
              ...prev.keyResults,
              {
                krId,
                objectiveId: d.objectiveId || '',
                titleVi: d.titleVi || '',
                titleKo: d.titleKo || '',
                metricType: d.metricType || 'NUMBER',
                direction: d.direction || 'INCREASE',
                unit: d.unit || '%',
                baselineValue: Number(d.baselineValue) || 0,
                currentValue: Number(d.currentValue) || 0,
                targetValue: Number(d.targetValue) || 100,
                weight: Number(d.weight) || 1,
                progress: 0,
                ownerId: d.ownerId || currentUserProfile?.userId || authUser?.uid || 'USER',
                status: 'NOT_STARTED' as const,
                deletedAt: '',
              },
            ];
        return {
          ...prev,
          keyResults: nextKrs,
          auditLogs: [
            {
              logId: `LOG-${Date.now()}`,
              userId: currentUserProfile?.userId || authUser?.uid || 'USER',
              action: exists ? 'UPDATE_KR' : 'CREATE_KR',
              entityType: 'KEY_RESULT',
              entityId: krId,
              newValue: d.titleVi || '',
              timestamp: now,
            },
            ...prev.auditLogs,
          ],
        };
      },
      'Đã lưu Key Result & đồng bộ lên Google Sheets!'
    );
    setKrModal({ open: false, data: null });
  };

  const openProjectModal = (proj: ProjectItem | null = null) => {
    if (!requireWritePermission()) return;
    const due = new Date();
    due.setDate(due.getDate() + 45);
    setProjectModal({
      open: true,
      data: proj
        ? { ...proj }
        : {
            projectId: '',
            objectiveId: db.objectives.filter((o) => !o.deletedAt)[0]?.objectiveId || '',
            departmentId:
              currentUserProfile?.departmentId || db.departments[0]?.departmentId || 'DEPT-PROD',
            nameVi: '',
            nameKo: '',
            descriptionVi: '',
            descriptionKo: '',
            ownerId: currentUserProfile?.userId || authUser?.uid || 'USER',
            status: 'ACTIVE',
            priority: 'MEDIUM',
            progress: 0,
            budget: 0,
            currency: 'VND',
            startDate: new Date().toISOString().slice(0, 10),
            dueDate: due.toISOString().slice(0, 10),
            driveLink: '',
          },
    });
  };

  const handleSaveProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectModal.data || !requireWritePermission()) return;
    const d = projectModal.data;
    const now = new Date().toISOString();
    const projectId = d.projectId || `PRJ-${Date.now()}`;
    await commitDatabaseChange(
      (prev) => {
        const exists = prev.projects.some((p) => p.projectId === projectId);
        const nextProjects = exists
          ? prev.projects.map((p) => (p.projectId === projectId ? { ...p, ...d, updatedAt: now } : p))
          : [
              {
                projectId,
                objectiveId: d.objectiveId || '',
                departmentId: d.departmentId || 'DEPT-PROD',
                nameVi: d.nameVi || '',
                nameKo: d.nameKo || '',
                descriptionVi: d.descriptionVi || '',
                descriptionKo: d.descriptionKo || '',
                ownerId: d.ownerId || currentUserProfile?.userId || authUser?.uid || 'USER',
                status: d.status || 'ACTIVE',
                priority: d.priority || 'MEDIUM',
                progress: Number(d.progress) || 0,
                budget: Number(d.budget) || 0,
                currency: d.currency || 'VND',
                startDate: d.startDate || now.slice(0, 10),
                dueDate: d.dueDate || now.slice(0, 10),
                driveLink: d.driveLink || '',
                deletedAt: '',
                createdAt: now,
                updatedAt: now,
              },
              ...prev.projects,
            ];
        return {
          ...prev,
          projects: nextProjects,
          auditLogs: [
            {
              logId: `LOG-${Date.now()}`,
              userId: currentUserProfile?.userId || authUser?.uid || 'USER',
              action: exists ? 'UPDATE_PROJECT' : 'CREATE_PROJECT',
              entityType: 'PROJECT',
              entityId: projectId,
              newValue: d.nameVi || '',
              timestamp: now,
            },
            ...prev.auditLogs,
          ],
        };
      },
      'Đã lưu Dự án lên Google Sheets!'
    );
    setProjectModal({ open: false, data: null });
  };

  const handleDeleteProject = (proj: ProjectItem) => {
    if (!requireWritePermission()) return;
    setConfirmDialog({
      open: true,
      title: 'Xóa Dự án khỏi Google Sheets',
      message: `Xác nhận xóa dự án "${getRawLocalized(proj, 'name')}" khỏi bảng tính "${activeSpreadsheetName}"?`,
      confirmLabel: 'Xóa Dự án',
      tone: 'danger',
      onConfirm: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        const now = new Date().toISOString();
        await commitDatabaseChange(
          (prev) => ({
            ...prev,
            projects: prev.projects.map((p) =>
              p.projectId === proj.projectId ? { ...p, deletedAt: now } : p
            ),
          }),
          'Đã xóa Dự án!'
        );
      },
    });
  };

  const openAddTaskModal = (defaultStatus: TaskStatus = 'TO_DO', task: TaskItem | null = null) => {
    if (!requireWritePermission()) return;
    const due = new Date();
    due.setDate(due.getDate() + 14);
    setTaskModal({
      open: true,
      data: task
        ? { ...task }
        : {
            taskId: '',
            projectId: db.projects.filter((p) => !p.deletedAt)[0]?.projectId || '',
            objectiveId: db.objectives.filter((o) => !o.deletedAt)[0]?.objectiveId || '',
            krId: '',
            titleVi: '',
            titleKo: '',
            priority: 'MEDIUM',
            status: defaultStatus,
            dueDate: due.toISOString().slice(0, 10),
            progress: defaultStatus === 'DONE' ? 100 : 0,
          },
    });
  };

  const handleSaveTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskModal.data || !requireWritePermission()) return;
    const d = taskModal.data;
    const now = new Date().toISOString();
    const taskId = d.taskId || `TSK-${Date.now()}`;
    await commitDatabaseChange(
      (prev) => {
        const exists = prev.tasks.some((tk) => tk.taskId === taskId);
        const nextTasks = exists
          ? prev.tasks.map((tk) =>
              tk.taskId === taskId
                ? {
                    ...tk,
                    ...d,
                    progress: d.status === 'DONE' ? 100 : Number(d.progress) || 0,
                    updatedAt: now,
                  }
                : tk
            )
          : [
              ...prev.tasks,
              {
                taskId,
                projectId: d.projectId || '',
                objectiveId: d.objectiveId || '',
                krId: d.krId || '',
                titleVi: d.titleVi || '',
                titleKo: d.titleKo || '',
                ownerId: currentUserProfile?.userId || authUser?.uid || 'USER',
                priority: d.priority || 'MEDIUM',
                status: d.status || 'TO_DO',
                dueDate: d.dueDate || now.slice(0, 10),
                progress: d.status === 'DONE' ? 100 : 0,
                deletedAt: '',
                createdAt: now,
                updatedAt: now,
              },
            ];
        return { ...prev, tasks: nextTasks };
      },
      'Đã lưu Công việc vào bảng Kanban trên Google Sheets!'
    );
    setTaskModal({ open: false, data: null });
  };

  const handleUpdateTaskStatus = async (task: TaskItem, nextStatus: TaskStatus) => {
    if (!requireWritePermission()) return;
    const now = new Date().toISOString();
    await commitDatabaseChange(
      (prev) => ({
        ...prev,
        tasks: prev.tasks.map((tk) =>
          tk.taskId === task.taskId
            ? {
                ...tk,
                status: nextStatus,
                progress: nextStatus === 'DONE' ? 100 : nextStatus === 'IN_PROGRESS' ? 50 : tk.progress,
                updatedAt: now,
              }
            : tk
        ),
      }),
      `Đã chuyển Task sang trạng thái ${nextStatus}`
    );
  };

  const handleDeleteTask = (task: TaskItem) => {
    if (!requireWritePermission()) return;
    setConfirmDialog({
      open: true,
      title: 'Xóa Công việc',
      message: `Xác nhận xóa công việc "${getRawLocalized(task, 'title')}" khỏi Google Sheets?`,
      confirmLabel: 'Xóa Task',
      tone: 'danger',
      onConfirm: async () => {
        setConfirmDialog((p) => ({ ...p, open: false }));
        const now = new Date().toISOString();
        await commitDatabaseChange(
          (prev) => ({
            ...prev,
            tasks: prev.tasks.map((tk) =>
              tk.taskId === task.taskId ? { ...tk, deletedAt: now } : tk
            ),
          }),
          'Đã xóa công việc!'
        );
      },
    });
  };

  const openCheckInModal = (kr: KeyResult) => {
    if (!requireWritePermission()) return;
    setCheckinModal({
      open: true,
      kr,
      currentValue: kr.currentValue,
      confidence: 8,
      status: kr.status === 'NOT_STARTED' ? 'ON_TRACK' : kr.status || 'ON_TRACK',
      winsVi: '',
      winsKo: '',
      blockersVi: '',
      nextStepsVi: '',
      evidenceUrl: '',
    });
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkinModal.kr || !requireWritePermission()) return;
    const { kr, currentValue, confidence, status, winsVi, winsKo, blockersVi, nextStepsVi, evidenceUrl } =
      checkinModal;
    const now = new Date().toISOString();
    const actor = currentUserProfile?.userId || authUser?.uid || 'USER';

    await commitDatabaseChange((prev) => {
      const nextKrs = prev.keyResults.map((k) =>
        k.krId === kr.krId
          ? {
              ...k,
              currentValue: Number(currentValue),
              status,
              lastCheckinAt: now,
            }
          : k
      );
      const tempState = recalculateDatabaseScores({ ...prev, keyResults: nextKrs });
      const updatedKr = tempState.keyResults.find((k) => k.krId === kr.krId);
      const calcProg = updatedKr?.progress || 0;

      return {
        ...tempState,
        checkins: [
          {
            checkInId: `CI-${Date.now()}`,
            krId: kr.krId,
            objectiveId: kr.objectiveId,
            cycleId:
              selectedCycleId !== 'ALL'
                ? selectedCycleId
                : prev.cycles[0]?.cycleId || 'CYC-2026-Q4',
            currentValue: Number(currentValue),
            calculatedProgress: calcProg,
            confidenceScore: Number(confidence) || 8,
            status,
            winsVi,
            winsKo,
            blockersVi,
            nextStepsVi,
            evidenceUrl,
            ownerId: actor,
            createdAt: now,
          },
          ...prev.checkins,
        ],
        notifications: [
          {
            notificationId: `NOTIF-${Date.now()}`,
            userId: actor,
            type: 'CHECKIN',
            titleVi: `Check-in mới: ${kr.titleVi}`,
            titleKo: `새 체크인: ${kr.titleKo || kr.titleVi}`,
            messageVi: `Tiến độ cập nhật đạt ${calcProg}%`,
            messageKo: `진행률 ${calcProg}% 달성`,
            isRead: false,
            createdAt: now,
          },
          ...prev.notifications,
        ],
        auditLogs: [
          {
            logId: `LOG-${Date.now()}`,
            userId: actor,
            action: 'CHECK_IN',
            entityType: 'KEY_RESULT',
            entityId: kr.krId,
            newValue: `Value=${currentValue}, Progress=${calcProg}%`,
            timestamp: now,
          },
          ...prev.auditLogs,
        ],
      };
    }, 'Đã ghi nhận Check-in & cập nhật Google Sheets!');
    setCheckinModal((p) => ({ ...p, open: false }));
  };

  // Report dataset
  const reportDataset = useMemo(() => {
    const activeObjs = db.objectives.filter((o) => !o.deletedAt);
    const activeKrs = db.keyResults.filter((k) => !k.deletedAt);
    const activeProjects = db.projects.filter((p) => !p.deletedAt);
    const activeTasks = db.tasks.filter((tk) => !tk.deletedAt);

    if (reportType === 'DEPARTMENT_OKR') {
      return {
        headers: ['Department ID', 'Phòng ban', 'Số Objectives', 'Điểm TB (%)', 'Đúng tiến độ'],
        rows: db.departments.map((d) => {
          const objs = activeObjs.filter((o) => o.departmentId === d.departmentId);
          const avg = objs.length
            ? Math.round(objs.reduce((s, o) => s + (Number(o.progress) || 0), 0) / objs.length)
            : 0;
          const onTrack = objs.filter((o) => o.status === 'ON_TRACK' || o.status === 'COMPLETED').length;
          return [d.departmentId, getRawLocalized(d, 'name'), objs.length, `${avg}%`, onTrack];
        }),
      };
    }
    if (reportType === 'PROJECTS_REPORT') {
      return {
        headers: ['Project ID', 'Tên Dự án', 'Trạng thái', 'Tiến độ (%)', 'Ngân sách', 'Deadline'],
        rows: activeProjects.map((p) => [
          p.projectId,
          getRawLocalized(p, 'name'),
          p.status,
          `${p.progress}%`,
          `${p.budget.toLocaleString()} ${p.currency}`,
          formatLocaleDate(p.dueDate, lang),
        ]),
      };
    }
    if (reportType === 'TASKS_REPORT') {
      return {
        headers: ['Task ID', 'Công việc', 'Trạng thái', 'Ưu tiên', 'Tiến độ (%)', 'Deadline'],
        rows: activeTasks.map((tk) => [
          tk.taskId,
          getRawLocalized(tk, 'title'),
          tk.status,
          tk.priority,
          `${tk.progress}%`,
          formatLocaleDate(tk.dueDate, lang),
        ]),
      };
    }
    if (reportType === 'KR_REPORT' || reportType === 'CHECKIN_COMPLIANCE') {
      return {
        headers: ['KR ID', 'Kết quả then chốt', 'Metric', 'Baseline', 'Current', 'Target', 'Tiến độ (%)', 'Check-in cuối'],
        rows: activeKrs.map((k) => [
          k.krId,
          getRawLocalized(k, 'title'),
          k.metricType,
          k.baselineValue,
          k.currentValue,
          k.targetValue,
          `${k.progress || 0}%`,
          formatLocaleDate(k.lastCheckinAt, lang),
        ]),
      };
    }
    if (reportType === 'AT_RISK_OKR' || reportType === 'OVERDUE_REPORT') {
      return {
        headers: ['Objective ID', 'Mục tiêu rủi ro / chậm', 'Cấp độ', 'Tiến độ (%)', 'Trạng thái', 'Deadline'],
        rows: activeObjs
          .filter((o) => o.status === 'AT_RISK' || o.status === 'BEHIND')
          .map((o) => [
            o.objectiveId,
            getRawLocalized(o, 'title'),
            o.level,
            `${o.progress || 0}%`,
            o.status,
            formatLocaleDate(o.dueDate, lang),
          ]),
      };
    }
    return {
      headers: ['Objective ID', 'Tiêu đề Mục tiêu', 'Cấp độ', 'Phòng ban', 'Tiến độ (%)', 'Trạng thái', 'Deadline'],
      rows: activeObjs.map((o) => {
        const dept = db.departments.find((d) => d.departmentId === o.departmentId);
        return [
          o.objectiveId,
          getRawLocalized(o, 'title'),
          o.level,
          dept ? getRawLocalized(dept, 'name') : '',
          `${o.progress || 0}%`,
          o.status,
          formatLocaleDate(o.dueDate, lang),
        ];
      }),
    };
  }, [db, reportType, getRawLocalized, lang]);

  const exportReportCsv = (headers: string[], rows: (string | number)[][], filename: string) => {
    if (!rows.length) {
      showToast('Không có dữ liệu báo cáo để xuất CSV', 'error');
      return;
    }
    const csvLines = [
      headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất tệp CSV báo cáo thành công!');
  };

  // Status text badge paired with icon/dot semantics (accessible, clean)
  const renderStatusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      ON_TRACK: { label: 'On Track', cls: 'text-emerald-700 dark:text-emerald-400' },
      COMPLETED: { label: 'Completed', cls: 'text-blue-700 dark:text-blue-400' },
      ACTIVE: { label: 'Active', cls: 'text-emerald-700 dark:text-emerald-400' },
      PLANNING: { label: 'Planning', cls: 'text-indigo-700 dark:text-indigo-400' },
      ON_HOLD: { label: 'On Hold', cls: 'text-amber-700 dark:text-amber-400' },
      AT_RISK: { label: 'At Risk', cls: 'text-amber-700 dark:text-amber-400' },
      BEHIND: { label: 'Behind', cls: 'text-rose-700 dark:text-rose-400' },
      NOT_STARTED: { label: 'Not Started', cls: 'text-slate-500 dark:text-slate-400' },
      PAUSED: { label: 'Paused', cls: 'text-purple-700 dark:text-purple-400' },
    };
    const info = map[status] || { label: status || 'Not Started', cls: 'text-slate-600 dark:text-slate-400' };
    return <span className={`text-xs font-bold ${info.cls}`}>{info.label}</span>;
  };

  const navItems: Array<{
    key: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { key: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
    { key: 'objectives', label: t.navObjectives, icon: Compass },
    { key: 'key-results', label: t.navKeyResults, icon: CheckCircle2 },
    { key: 'checkins', label: t.navCheckins, icon: Activity },
    { key: 'projects', label: t.navProjects, icon: FolderKanban },
    { key: 'kanban', label: t.navKanban, icon: Kanban },
    { key: 'alignment', label: t.navAlignment, icon: GitFork },
    { key: 'reports', label: t.navReports, icon: BarChart3 },
    { key: 'team', label: t.navTeam, icon: Users },
    ...(activeRole === 'ADMIN'
      ? [
          {
            key: 'approval' as NavTab,
            label: t.navApproval,
            icon: UserCheck,
            badge: pendingCount > 0 ? pendingCount : undefined,
          },
        ]
      : []),
    { key: 'drive-files', label: t.navDriveFiles, icon: HardDrive },
    { key: 'calendar', label: t.navCalendar, icon: CalendarDays },
    { key: 'templates', label: t.navTemplates, icon: BookOpen },
    { key: 'cycles', label: t.navCycles, icon: Repeat },
    ...(activeRole === 'ADMIN' || activeRole === 'OKR_ADMIN'
      ? [{ key: 'settings' as NavTab, label: t.navSettings, icon: Settings }]
      : []),
    { key: 'guide', label: t.navGuide, icon: HelpCircle },
  ];

  const unreadNotifCount = db.notifications.filter((n) => !n.isRead).length;
  const detailObj = detailModalObjId
    ? db.objectives.find((o) => o.objectiveId === detailModalObjId) || null
    : null;

  const userInitials = useMemo(() => {
    const name = authUser?.displayName || authUser?.email || 'U';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [authUser]);

  // ==========================================================================
  // SIGN-IN SCREEN WHEN NOT AUTHENTICATED OR TOKEN EXPIRED
  // ==========================================================================
  if (needsAuth) {
    return (
      <AccountGateView
        mode="LOGIN"
        lang={lang}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSwitchLang={handleLanguageSwitch}
        onGoogleLogin={handleGoogleLogin}
        isLoggingIn={isLoggingIn}
        authError={authError}
        customSpreadsheetInput={customSpreadsheetInput}
        setCustomSpreadsheetInput={setCustomSpreadsheetInput}
        signedInEmail={authUser?.email || undefined}
        onLogout={handleLogout}
      />
    );
  }

  // ==========================================================================
  // STATUS GATE (PENDING / REJECTED / SUSPENDED / INACTIVE) — ZERO ACCESS TO DASHBOARD
  // ==========================================================================
  if (
    activeSpreadsheetId &&
    accountStatus &&
    accountStatus !== 'APPROVED' &&
    accountStatus !== 'NO_SHEET'
  ) {
    return (
      <AccountGateView
        mode="STATUS_GATE"
        lang={lang}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSwitchLang={handleLanguageSwitch}
        onGoogleLogin={handleGoogleLogin}
        isLoggingIn={isLoggingIn}
        authError={authError}
        customSpreadsheetInput={customSpreadsheetInput}
        setCustomSpreadsheetInput={setCustomSpreadsheetInput}
        signedInEmail={authUser?.email || undefined}
        signedInName={authUser?.displayName || undefined}
        signedInAvatar={authUser?.photoURL || undefined}
        accountStatus={accountStatus}
        userRecord={currentUserProfile}
        canOwnerBootstrap={canOwnerBootstrap}
        onBootstrapOwnerAdmin={handleBootstrapOwnerAdmin}
        onRefreshStatus={handleRefreshAccountStatus}
        onLogout={handleLogout}
        isBusy={Boolean(loadingText)}
      />
    );
  }

  // ==========================================================================
  // AUTHENTICATED MAIN WORKSPACE
  // ==========================================================================
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden glass-canvas text-slate-900 dark:text-slate-100 relative transition-colors">
      {/* Toasts */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-xs sm:max-w-sm">
        {toasts.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto glass-surface text-slate-800 dark:text-slate-100 text-xs font-bold px-4 py-3 rounded-[12px] shadow-lg flex items-center gap-2.5"
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                item.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
            <span className="break-words">{item.message}</span>
          </div>
        ))}
      </div>

      {/* Loading Overlay */}
      {loadingText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 backdrop-blur-xs">
          <div className="glass-surface px-6 py-4 rounded-[12px] flex items-center gap-3 shadow-xl">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{loadingText}</span>
          </div>
        </div>
      )}

      {/* Workspace Frame */}
      <div className="p-2 sm:p-3.5 lg:h-screen lg:overflow-hidden">
        <div className="h-full flex flex-col lg:flex-row max-w-[1680px] mx-auto glass-shell rounded-[12px] overflow-hidden">
          {mobileSidebarOpen && (
            <div
              onClick={() => setMobileSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs z-30 lg:hidden"
            />
          )}

          {/* Left Sidebar */}
          <aside
            className={`fixed lg:static inset-y-0 left-0 z-40 w-64 h-full bg-white/65 dark:bg-slate-900/75 backdrop-blur-2xl border-r border-white/55 dark:border-white/10 flex flex-col justify-between overflow-y-auto transform transition-transform duration-200 shrink-0 ${
              mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
            }`}
          >
            <div>
              {/* Brand */}
              <div className="h-16 px-4 flex items-center justify-between border-b border-white/50 dark:border-white/10 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-[12px] bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-sm shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white block leading-none">
                      Flow<span className="text-indigo-600 dark:text-indigo-400">OKR</span>
                    </span>
                    <span
                      className={`text-[11px] font-bold block mt-0.5 truncate ${
                        syncStatus === 'ready'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : syncStatus === 'error'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {syncStatus === 'ready'
                        ? t.syncReady
                        : syncStatus === 'syncing'
                        ? t.syncing
                        : syncStatus === 'error'
                        ? t.syncError
                        : t.syncDisconnected}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="lg:hidden p-2 rounded-[999px] text-slate-500 hover:bg-white/70 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation */}
              <nav className="p-2.5 space-y-1">
                {navItems.map((item) => {
                  const IconComp = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.key);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-[999px] text-xs font-bold transition-all text-left ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600 via-blue-600 to-violet-600 text-white shadow-sm'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <IconComp className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge !== undefined && (
                        <span
                          className={`px-2 py-0.5 rounded-[999px] text-[10px] font-bold tabular-nums shrink-0 ${
                            isActive
                              ? 'bg-white text-indigo-700'
                              : 'bg-amber-500 text-white'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Google Drive & Sheets Sync Card */}
            <div className="p-3 shrink-0">
              <div className="rounded-[12px] bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-3.5 text-white shadow-md border border-white/25">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="w-7 h-7 rounded-[12px] bg-white/20 flex items-center justify-center">
                    <Database className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums">{lastSyncTime}</span>
                </div>
                <h4 className="font-bold text-xs mb-0.5 truncate">{activeSpreadsheetName || t.dbCardTitle}</h4>
                <p className="text-[11px] text-white/85 leading-snug mb-2.5">{t.dbCardDesc}</p>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => authUser && connectAndLoadWorkspace(authUser)}
                    className="flex-1 py-1.5 px-3 bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs rounded-[999px] flex items-center justify-center gap-1 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t.syncNowBtn}</span>
                  </button>
                  {activeSpreadsheetUrl && (
                    <a
                      href={activeSpreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 px-2.5 bg-white/20 hover:bg-white/30 rounded-[999px] flex items-center justify-center"
                      title="Mở Google Sheet"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Workspace Column */}
          <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden">
            {/* Top Header */}
            <header className="h-16 border-b border-white/50 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-20">
              <div className="flex items-center gap-2.5 flex-1 min-w-0 max-w-md">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-[999px] bg-white/75 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 shrink-0"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    type="text"
                    placeholder={t.searchPlaceholder}
                    className="w-full pl-9 pr-3 py-2 bg-white/75 dark:bg-slate-800/75 border border-white/70 dark:border-slate-700 focus:border-indigo-500 rounded-[12px] text-xs sm:text-sm outline-none text-slate-900 dark:text-slate-100 backdrop-blur-md"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Language Switcher */}
                <div className="flex items-center gap-0.5 bg-white/75 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 rounded-[999px] p-1 backdrop-blur-md">
                  <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 mx-1.5 hidden sm:block" />
                  <button
                    type="button"
                    onClick={() => handleLanguageSwitch('vi')}
                    className={`px-2.5 py-1 rounded-[999px] text-xs font-bold whitespace-nowrap transition-colors ${
                      lang === 'vi'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700'
                    }`}
                  >
                    VI
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLanguageSwitch('ko')}
                    className={`px-2.5 py-1 rounded-[999px] text-xs font-bold whitespace-nowrap transition-colors ${
                      lang === 'ko'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-700'
                    }`}
                  >
                    KO
                  </button>
                </div>

                {/* System / Light / Dark Mode Switch */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-3 py-2 rounded-[999px] bg-white/75 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 flex items-center gap-1.5 text-xs font-bold backdrop-blur-md"
                  aria-label="Chuyển giao diện Hệ thống / Sáng / Tối"
                  title={
                    theme === 'system'
                      ? lang === 'ko'
                        ? '시스템 기본 테마'
                        : 'Giao diện mặc định Hệ thống'
                      : theme === 'light'
                      ? lang === 'ko'
                        ? '라이트 모드'
                        : 'Giao diện Sáng'
                      : lang === 'ko'
                      ? '다크 모드'
                      : 'Giao diện Tối'
                  }
                >
                  {theme === 'system' ? (
                    <Monitor className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  ) : theme === 'light' ? (
                    <Sun className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Moon className="w-4 h-4 text-cyan-400" />
                  )}
                  <span className="hidden md:inline whitespace-nowrap">
                    {theme === 'system'
                      ? lang === 'ko'
                        ? '시스템'
                        : 'Hệ thống'
                      : theme === 'light'
                      ? lang === 'ko'
                        ? '라이트'
                        : 'Sáng'
                      : lang === 'ko'
                      ? '다크'
                      : 'Tối'}
                  </span>
                </button>

                {/* Primary Create CTA */}
                {activeRole !== 'VIEWER' && activeSpreadsheetId && (
                  <button
                    type="button"
                    onClick={() => openAddOkrModal()}
                    className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold whitespace-nowrap px-4 py-2 rounded-[999px] shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t.createOkrBtn}</span>
                  </button>
                )}

                {/* Notifications */}
                <button
                  type="button"
                  onClick={() => setActiveTab('notifications')}
                  className="relative p-2.5 rounded-[999px] bg-white/75 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 text-slate-700 dark:text-slate-200 backdrop-blur-md"
                  aria-label="Thông báo"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
                  )}
                </button>

                {/* Google User Profile & Logout */}
                <div className="flex items-center gap-2 pl-2 border-l border-white/60 dark:border-slate-700">
                  {authUser?.photoURL && !avatarFailed ? (
                    <Image
                      src={authUser.photoURL}
                      alt={authUser.displayName || 'Google Avatar'}
                      width={32}
                      height={32}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                      className="w-8 h-8 rounded-full object-cover border border-white/80 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                      {userInitials}
                    </span>
                  )}
                  <div className="hidden md:block min-w-0 max-w-[140px]">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {authUser?.displayName || authUser?.email}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {activeRole}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="Đăng xuất Google"
                    className="p-2 rounded-[999px] text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </header>

            {/* Spreadsheet Onboarding Banner when connected to Drive but no Sheet yet */}
            {!activeSpreadsheetId && (
              <div className="m-4 sm:m-6 glass-surface glass-tint-blue p-6 rounded-[12px] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-[12px] bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">
                        Khởi tạo Google Sheet lưu trữ dữ liệu trong Google Drive
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                        Thư mục <strong>FlowOKR_Workspace</strong> đã sẵn sàng trên Google Drive của bạn ({authUser?.email}). Hãy tạo bảng tính cơ sở dữ liệu đầu tiên để lưu toàn bộ OKR, Dự án & Công việc.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    value={newSheetNameInput}
                    onChange={(e) => setNewSheetNameInput(e.target.value)}
                    placeholder="Tên file Google Sheet (VD: FlowOKR_Enterprise_DB)"
                    className="flex-1 px-3.5 py-2.5 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 text-xs sm:text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleCreateSpreadsheet(false)}
                    className="px-4 py-2.5 rounded-[999px] bg-white/85 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 whitespace-nowrap"
                  >
                    Tạo Sheet Trống
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDialog({
                        open: true,
                        title: 'Tạo Google Sheet & Nạp Dữ Liệu Mẫu',
                        message: `Ứng dụng sẽ tạo tệp Google Sheet "${newSheetNameInput}" trong thư mục FlowOKR_Workspace trên Google Drive và ghi sẵn bộ dữ liệu OKR, Dự án & Công việc mẫu.`,
                        confirmLabel: 'Tạo & Nạp Mẫu',
                        tone: 'primary',
                        onConfirm: () => {
                          setConfirmDialog((p) => ({ ...p, open: false }));
                          handleCreateSpreadsheet(true);
                        },
                      })
                    }
                    className="px-4 py-2.5 rounded-[999px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold whitespace-nowrap"
                  >
                    Tạo Sheet + Dữ Liệu Mẫu
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================== */}
            {/* MAIN SCROLLABLE WORKSPACE VIEWS                                */}
            {/* ============================================================== */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
              <AnimatePresence mode="wait">
                {/* 01. DASHBOARD */}
                {activeTab === 'dashboard' && (
                  <motion.div
                    key="dashboard"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.16 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          {t.dashGreeting}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                          {t.dashSubtitle}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="glass-surface rounded-[12px] px-3 py-1.5 flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                          <select
                            value={selectedCycleId}
                            onChange={(e) => setSelectedCycleId(e.target.value)}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent outline-none cursor-pointer"
                          >
                            <option value="ALL">{t.allCycles}</option>
                            {db.cycles.map((c) => (
                              <option key={c.cycleId} value={c.cycleId}>
                                {getRawLocalized(c, 'name')}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="glass-surface rounded-[12px] px-3 py-1.5 flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-fuchsia-600 dark:text-fuchsia-400" />
                          <select
                            value={dashDeptFilter}
                            onChange={(e) => setDashDeptFilter(e.target.value)}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent outline-none cursor-pointer"
                          >
                            <option value="ALL">{t.allDepartments}</option>
                            {db.departments.map((d) => (
                              <option key={d.departmentId} value={d.departmentId}>
                                {getRawLocalized(d, 'name')}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="glass-surface rounded-[12px] px-3 py-1.5 flex items-center gap-2">
                          <Filter className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <select
                            value={dashStatusFilter}
                            onChange={(e) => setDashStatusFilter(e.target.value)}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-transparent outline-none cursor-pointer"
                          >
                            <option value="ALL">{t.allStatuses}</option>
                            <option value="ON_TRACK">On Track</option>
                            <option value="AT_RISK">At Risk</option>
                            <option value="BEHIND">Behind</option>
                            <option value="COMPLETED">Completed</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Empty Prompt */}
                    {activeSpreadsheetId && dashboardMetrics.allActiveObjsCount === 0 && (
                      <div className="glass-surface glass-tint-violet p-5 rounded-[12px] flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-11 h-11 rounded-[12px] bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <DatabaseZap className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.emptyDbTitle}</h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{t.emptyDbDesc}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => openAddOkrModal()}
                            className="px-4 py-2 rounded-[999px] bg-white/85 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                          >
                            {t.createFirstOkr}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                title: 'Nạp dữ liệu mẫu lên Google Sheet',
                                message: `Thao tác này sẽ ghi dữ liệu mẫu OKR, Dự án & Công việc vào bảng tính "${activeSpreadsheetName}".`,
                                confirmLabel: 'Nạp dữ liệu mẫu',
                                tone: 'primary',
                                onConfirm: async () => {
                                  setConfirmDialog((p) => ({ ...p, open: false }));
                                  if (authUser) {
                                    const ownerId = currentUserProfile?.userId || authUser.uid;
                                    await commitDatabaseChange(
                                      (prev) => buildInitialSeedState(ownerId, prev.users),
                                      'Đã nạp dữ liệu mẫu lên Google Sheets!'
                                    );
                                  }
                                },
                              })
                            }
                            className="px-4 py-2 rounded-[999px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                          >
                            {t.seedDemoBtn}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4 KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                      <div className="glass-surface glass-tint-blue p-5 rounded-[12px] flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-[12px] bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center shrink-0">
                          <Target className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">
                            {t.kpiActiveObjectives}
                          </p>
                          <div className="flex items-baseline gap-2 mt-0.5 tabular-nums">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                              {dashboardMetrics.totalObjs}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              / {dashboardMetrics.allActiveObjsCount} tổng
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            {dashboardMetrics.onTrackObjs} On Track
                          </p>
                        </div>
                      </div>

                      <div className="glass-surface glass-tint-emerald p-5 rounded-[12px] flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-[12px] bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shrink-0">
                          <CheckCircle className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">
                            {t.kpiCompletedKrs}
                          </p>
                          <div className="flex items-baseline gap-2 mt-0.5 tabular-nums">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                              {dashboardMetrics.completedKrs}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              / {dashboardMetrics.totalKrs} KRs
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            {dashboardMetrics.checkinRate}% check-in 7 ngày
                          </p>
                        </div>
                      </div>

                      <div className="glass-surface glass-tint-violet p-5 rounded-[12px] flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-[12px] bg-gradient-to-tr from-indigo-600 to-purple-500 text-white flex items-center justify-center shrink-0">
                          <FolderKanban className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">
                            {t.kpiActiveProjects}
                          </p>
                          <div className="flex items-baseline gap-2 mt-0.5 tabular-nums">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                              {dashboardMetrics.activeProjectsCount}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              / {dashboardMetrics.totalProjectsCount} dự án
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            {dashboardMetrics.doneTasksCount}/{dashboardMetrics.totalTasksCount} tasks hoàn thành
                          </p>
                        </div>
                      </div>

                      <div className="glass-surface glass-tint-amber p-5 rounded-[12px] flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-[12px] bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-600 dark:text-slate-400 truncate">
                            {t.kpiAtRiskOkrs}
                          </p>
                          <div className="flex items-baseline gap-2 mt-0.5 tabular-nums">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                              {dashboardMetrics.atRiskObjs + dashboardMetrics.behindObjs}
                            </span>
                            <span className="text-xs text-rose-600 dark:text-rose-400 font-bold">
                              {dashboardMetrics.overdueTasks} quá hạn
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {t.kpiNeedsAttention}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Middle Bento Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      {/* Objectives Progress */}
                      <div className="lg:col-span-5 glass-surface glass-tint-blue p-5 rounded-[12px] flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="min-w-0">
                              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                                {t.dashObjProgressTitle}
                              </h2>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {t.dashObjProgressSub}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveTab('objectives')}
                              className="px-3 py-1 rounded-[999px] bg-white/70 dark:bg-slate-800/70 border border-white/70 dark:border-slate-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 flex items-center gap-1 shrink-0"
                            >
                              <span>{t.viewAll}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="space-y-3 max-h-[290px] overflow-y-auto pr-1">
                            {filteredDashboardObjectives.length === 0 ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
                                Chưa có Mục tiêu OKR nào trong bộ lọc này.
                              </p>
                            ) : (
                              filteredDashboardObjectives.slice(0, 6).map((obj) => {
                                const dept = db.departments.find((d) => d.departmentId === obj.departmentId);
                                const barColor =
                                  obj.progress >= 70
                                    ? 'from-blue-600 to-cyan-500'
                                    : obj.progress >= 40
                                    ? 'from-amber-500 to-orange-500'
                                    : 'from-rose-500 to-fuchsia-500';
                                return (
                                  <button
                                    type="button"
                                    key={obj.objectiveId}
                                    onClick={() => setDetailModalObjId(obj.objectiveId)}
                                    className="w-full text-left group p-3 rounded-[12px] bg-white/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 border border-white/70 dark:border-slate-700 transition-colors"
                                  >
                                    <div className="flex items-start justify-between gap-3 mb-1.5">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                            {obj.level}
                                          </span>
                                          <span>·</span>
                                          <span className="truncate">
                                            {dept ? getRawLocalized(dept, 'name') : ''}
                                          </span>
                                        </div>
                                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                          {renderLocalized(obj, 'title')}
                                        </h3>
                                      </div>
                                      <span className="text-xs font-bold text-slate-900 dark:text-white shrink-0 tabular-nums">
                                        {obj.progress || 0}%
                                      </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div
                                        className={`bg-gradient-to-r ${barColor} h-full rounded-full transition-all duration-300`}
                                        style={{ width: `${obj.progress || 0}%` }}
                                      />
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      {/* OKR Score Ring */}
                      <div className="lg:col-span-3 glass-surface glass-tint-violet p-5 rounded-[12px] flex flex-col justify-between min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="font-bold text-base text-slate-900 dark:text-white">
                            {t.dashOkrScoreTitle}
                          </h2>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">OKR</span>
                        </div>

                        {(() => {
                          const total =
                            dashboardMetrics.onTrackObjs +
                            dashboardMetrics.atRiskObjs +
                            dashboardMetrics.behindObjs;
                          const onPct = total > 0 ? (dashboardMetrics.onTrackObjs / total) * 100 : 0;
                          const riskPct = total > 0 ? (dashboardMetrics.atRiskObjs / total) * 100 : 0;
                          const r = 56;
                          const circ = 2 * Math.PI * r;
                          return (
                            <div className="relative w-40 h-40 mx-auto my-2 flex items-center justify-center">
                              <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                                <circle
                                  cx="70"
                                  cy="70"
                                  r={r}
                                  fill="none"
                                  className="stroke-slate-200 dark:stroke-slate-700"
                                  strokeWidth="14"
                                />
                                {total > 0 && (
                                  <>
                                    <circle
                                      cx="70"
                                      cy="70"
                                      r={r}
                                      fill="none"
                                      stroke="#4f46e5"
                                      strokeWidth="14"
                                      strokeDasharray={`${(onPct / 100) * circ} ${circ}`}
                                      strokeLinecap="round"
                                    />
                                    <circle
                                      cx="70"
                                      cy="70"
                                      r={r}
                                      fill="none"
                                      stroke="#f59e0b"
                                      strokeWidth="14"
                                      strokeDasharray={`${(riskPct / 100) * circ} ${circ}`}
                                      strokeDashoffset={-((onPct / 100) * circ)}
                                    />
                                  </>
                                )}
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                                  {dashboardMetrics.avgScore}
                                </span>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {t.avgScore}
                                </span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="space-y-2 mt-2 pt-2.5 border-t border-slate-200/70 dark:border-slate-700 text-xs tabular-nums">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-300">On Track</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {dashboardMetrics.onTrackObjs}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-300">At Risk</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              {dashboardMetrics.atRiskObjs}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-300">Behind / Not Started</span>
                            <span className="font-bold text-rose-600 dark:text-rose-400">
                              {dashboardMetrics.behindObjs}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Schedule */}
                      <div className="lg:col-span-4 glass-surface glass-tint-cyan p-5 rounded-[12px] flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-base text-slate-900 dark:text-white">
                              {t.dashCheckinSchedTitle}
                            </h2>
                            <button
                              type="button"
                              onClick={() => setActiveTab('calendar')}
                              className="px-3 py-1 rounded-[999px] bg-white/70 dark:bg-slate-800/70 border border-white/70 dark:border-slate-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 flex items-center gap-1"
                            >
                              <span>{t.viewCalendar}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-7 gap-1 text-center mb-4">
                            {[-2, -1, 0, 1, 2, 3, 4].map((offset) => {
                              const d = new Date();
                              d.setDate(d.getDate() + offset);
                              const isToday = offset === 0;
                              const dayLabels =
                                lang === 'ko'
                                  ? ['일', '월', '화', '수', '목', '금', '토']
                                  : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                              return (
                                <div
                                  key={offset}
                                  className={`py-1.5 rounded-[12px] text-[11px] tabular-nums ${
                                    isToday
                                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {dayLabels[d.getDay()]}
                                  <span
                                    className={`block text-xs font-bold mt-0.5 ${
                                      isToday ? 'text-white' : 'text-slate-800 dark:text-slate-200'
                                    }`}
                                  >
                                    {d.getDate()}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                            {db.projects
                              .filter((p) => !p.deletedAt && p.dueDate)
                              .slice(0, 4)
                              .map((p) => (
                                <div
                                  key={p.projectId}
                                  className="p-2.5 rounded-[12px] bg-white/75 dark:bg-slate-800/75 border border-white/70 dark:border-slate-700 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                      {getRawLocalized(p, 'name')}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                      Hạn dự án · {formatLocaleDate(p.dueDate, lang)}
                                    </p>
                                  </div>
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
                                    {p.progress}%
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Department Performance & Activity Chart */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      <div className="lg:col-span-5 glass-surface glass-tint-emerald p-5 rounded-[12px] min-w-0">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="font-bold text-base text-slate-900 dark:text-white">
                            {t.dashDeptPerfTitle}
                          </h2>
                          <button
                            type="button"
                            onClick={() => setActiveTab('projects')}
                            className="px-3 py-1 rounded-[999px] bg-white/70 dark:bg-slate-800/70 border border-white/70 dark:border-slate-700 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-white dark:hover:bg-slate-800 flex items-center gap-1"
                          >
                            <span>{t.viewAll}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                          {db.departments.map((dept) => {
                            const deptObjs = db.objectives.filter(
                              (o) => !o.deletedAt && o.departmentId === dept.departmentId
                            );
                            const avg = deptObjs.length
                              ? Math.round(
                                  deptObjs.reduce((s, o) => s + (Number(o.progress) || 0), 0) /
                                    deptObjs.length
                                )
                              : 0;
                            return (
                              <div
                                key={dept.departmentId}
                                className="p-2.5 rounded-[12px] bg-white/70 dark:bg-slate-800/70 border border-white/70 dark:border-slate-700"
                              >
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                  <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                    {getRawLocalized(dept, 'name')} · {deptObjs.length} OKRs
                                  </span>
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                    {avg}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-indigo-600 to-fuchsia-500 rounded-full"
                                    style={{ width: `${avg}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="lg:col-span-7 glass-surface glass-tint-amber p-5 rounded-[12px] flex flex-col justify-between min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <h2 className="font-bold text-base text-slate-900 dark:text-white">
                              {t.dashActivityChartTitle}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {t.dashActivityChartSub}
                            </p>
                          </div>
                          <select
                            value={dashChartMode}
                            onChange={(e) => setDashChartMode(e.target.value as 'weekly' | 'department')}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800 border border-white/70 dark:border-slate-700 rounded-[12px] px-3 py-1.5 outline-none"
                          >
                            <option value="weekly">{t.chartModeWeekly}</option>
                            <option value="department">{t.chartModeDept}</option>
                          </select>
                        </div>

                        <div className="h-44 flex items-end justify-around gap-3 pt-6 px-2 border-b border-slate-200/70 dark:border-slate-700">
                          {(() => {
                            const maxVal = Math.max(5, ...weeklyBarData.map((b) => b.value));
                            return weeklyBarData.map((bar, idx) => {
                              const heightPct = Math.max(10, Math.round((bar.value / maxVal) * 100));
                              return (
                                <div
                                  key={idx}
                                  className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end min-w-0"
                                >
                                  <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                    {bar.value}
                                    {bar.suffix}
                                  </span>
                                  <div
                                    className="w-full max-w-[36px] bg-gradient-to-t from-blue-600 via-indigo-500 to-cyan-400 rounded-t-[12px] transition-all duration-300"
                                    style={{ height: `${heightPct}%` }}
                                  />
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-full">
                                    {bar.label}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Tasks Kanban Preview */}
                    <div className="glass-surface glass-tint-pink p-5 rounded-[12px]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                        <div>
                          <h2 className="font-bold text-base text-slate-900 dark:text-white">
                            {t.dashKanbanTitle}
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{t.dashKanbanSub}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveTab('kanban')}
                            className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800 border border-white/70 dark:border-slate-700 px-3.5 py-1.5 rounded-[999px]"
                          >
                            {t.fullKanbanBtn}
                          </button>
                          <button
                            type="button"
                            onClick={() => openAddTaskModal('TO_DO')}
                            className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-1.5 rounded-[999px] flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t.addInitiativeBtn}</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {(
                          [
                            { key: 'TO_DO', title: 'To Do', tint: 'glass-tint-blue' },
                            { key: 'IN_PROGRESS', title: 'In Progress', tint: 'glass-tint-violet' },
                            { key: 'REVIEW', title: 'Review', tint: 'glass-tint-amber' },
                            { key: 'DONE', title: 'Done', tint: 'glass-tint-emerald' },
                          ] as Array<{ key: TaskStatus; title: string; tint: string }>
                        ).map((col) => {
                          const items = db.tasks.filter((tk) => !tk.deletedAt && tk.status === col.key);
                          return (
                            <div
                              key={col.key}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const id = e.dataTransfer.getData('text/plain');
                                const task = db.tasks.find((tk) => tk.taskId === id);
                                if (task) handleUpdateTaskStatus(task, col.key);
                              }}
                              className={`glass-surface ${col.tint} p-3 rounded-[12px] flex flex-col justify-between min-h-[200px]`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2.5 px-1">
                                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {col.title}
                                  </span>
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                    {items.length}
                                  </span>
                                </div>
                                <div className="space-y-2">
                                  {items.map((task) => {
                                    const order: TaskStatus[] = ['BACKLOG', 'TO_DO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
                                    const nextStatus =
                                      order[Math.min(order.indexOf(task.status) + 1, order.length - 1)];
                                    return (
                                      <div
                                        key={task.taskId}
                                        draggable
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', task.taskId)}
                                        className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-[12px] border border-white/70 dark:border-slate-700 shadow-2xs cursor-grab"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">
                                            {renderLocalized(task, 'title')}
                                          </p>
                                          {col.key !== 'DONE' && (
                                            <button
                                              type="button"
                                              onClick={() => handleUpdateTaskStatus(task, nextStatus)}
                                              className="p-1.5 rounded-[999px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white shrink-0"
                                            >
                                              <ArrowRight className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                          <span>{task.priority}</span>
                                          <span>{formatLocaleDate(task.dueDate, lang)}</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => openAddTaskModal(col.key)}
                                className="mt-3 w-full py-1.5 rounded-[999px] text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm Task</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 02. OBJECTIVES MANAGEMENT */}
                {activeTab === 'objectives' && (
                  <motion.div
                    key="objectives"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          {t.objPageTitle}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                          {t.objPageSub}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="glass-surface p-1 rounded-[999px] flex items-center gap-1">
                          {(['card', 'table', 'hierarchy'] as const).map((m) => (
                            <button
                              type="button"
                              key={m}
                              onClick={() => setObjViewMode(m)}
                              className={`px-3 py-1.5 rounded-[999px] text-xs font-bold capitalize transition-colors ${
                                objViewMode === m
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              {m === 'hierarchy' ? 'Tree' : m}
                            </button>
                          ))}
                        </div>

                        <label className="glass-surface px-3.5 py-2 rounded-[999px] flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showDeletedObj}
                            onChange={(e) => setShowDeletedObj(e.target.checked)}
                            className="accent-indigo-600"
                          />
                          <span>{t.showTrash}</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => openAddOkrModal()}
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-[999px]"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{t.addObjectiveBtn}</span>
                        </button>
                      </div>
                    </div>

                    <div className="glass-surface glass-tint-blue p-4 rounded-[12px] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedDeptTab('ALL')}
                          className={`px-3.5 py-1.5 rounded-[999px] text-xs font-bold transition-colors ${
                            selectedDeptTab === 'ALL'
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {t.allDepartments}
                        </button>
                        {db.departments.map((d) => (
                          <button
                            type="button"
                            key={d.departmentId}
                            onClick={() => setSelectedDeptTab(d.departmentId)}
                            className={`px-3.5 py-1.5 rounded-[999px] text-xs font-bold transition-colors ${
                              selectedDeptTab === d.departmentId
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {getRawLocalized(d, 'name')}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={objLevelFilter}
                          onChange={(e) => setObjLevelFilter(e.target.value)}
                          className="text-xs font-bold bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 rounded-[12px] px-3 py-1.5"
                        >
                          <option value="ALL">Tất cả cấp độ</option>
                          <option value="Company">Company</option>
                          <option value="Division">Division</option>
                          <option value="Department">Department</option>
                          <option value="Team">Team</option>
                          <option value="Individual">Individual</option>
                        </select>
                        <select
                          value={objStatusFilter}
                          onChange={(e) => setObjStatusFilter(e.target.value)}
                          className="text-xs font-bold bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 rounded-[12px] px-3 py-1.5"
                        >
                          <option value="ALL">Tất cả trạng thái</option>
                          <option value="ON_TRACK">On Track</option>
                          <option value="AT_RISK">At Risk</option>
                          <option value="BEHIND">Behind</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="NOT_STARTED">Not Started</option>
                        </select>
                      </div>
                    </div>

                    {filteredManagementObjectives.length === 0 ? (
                      <div className="glass-surface p-10 rounded-[12px] text-center space-y-3">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          Chưa có Mục tiêu nào khớp với bộ lọc.
                        </p>
                        <button
                          type="button"
                          onClick={() => openAddOkrModal()}
                          className="px-4 py-2 rounded-[999px] bg-indigo-600 text-white text-xs font-bold"
                        >
                          + {t.addObjectiveBtn}
                        </button>
                      </div>
                    ) : objViewMode === 'table' ? (
                      <div className="glass-surface rounded-[12px] overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200/70 dark:border-slate-700 bg-white/60 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300">
                              <th className="p-3.5 font-bold">Objective</th>
                              <th className="p-3.5 font-bold">Level · Dept</th>
                              <th className="p-3.5 font-bold">Tiến độ</th>
                              <th className="p-3.5 font-bold">Trạng thái</th>
                              <th className="p-3.5 font-bold text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                            {filteredManagementObjectives.map((obj) => {
                              const dept = db.departments.find((d) => d.departmentId === obj.departmentId);
                              return (
                                <tr key={obj.objectiveId} className="hover:bg-white/50 dark:hover:bg-slate-800/50">
                                  <td className="p-3.5 font-bold text-slate-900 dark:text-white max-w-xs break-words">
                                    {renderLocalized(obj, 'title')}
                                  </td>
                                  <td className="p-3.5 text-slate-600 dark:text-slate-300">
                                    {obj.level} · {dept ? getRawLocalized(dept, 'name') : ''}
                                  </td>
                                  <td className="p-3.5 font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                    {obj.progress || 0}%
                                  </td>
                                  <td className="p-3.5">{renderStatusBadge(obj.status)}</td>
                                  <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => setDetailModalObjId(obj.objectiveId)}
                                      className="px-3 py-1 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 font-bold"
                                    >
                                      Chi tiết
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditOkrModal(obj)}
                                      className="px-3 py-1 rounded-[999px] bg-indigo-600 text-white font-bold"
                                    >
                                      Sửa
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={objViewMode === 'hierarchy' ? 'space-y-3' : 'grid grid-cols-1 xl:grid-cols-2 gap-4'}>
                        {filteredManagementObjectives.map((obj, oIdx) => {
                          const dept = db.departments.find((d) => d.departmentId === obj.departmentId);
                          const krs = db.keyResults.filter((k) => k.objectiveId === obj.objectiveId && !k.deletedAt);
                          const tints = ['glass-tint-blue', 'glass-tint-violet', 'glass-tint-cyan', 'glass-tint-emerald'];
                          const tint = tints[oIdx % tints.length];
                          return (
                            <div
                              key={obj.objectiveId}
                              className={`glass-surface ${tint} p-5 rounded-[12px] flex flex-col justify-between gap-4 min-w-0 ${
                                objViewMode === 'hierarchy' && obj.parentObjectiveId ? 'sm:ml-8' : ''
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2.5 flex-wrap">
                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{obj.level}</span>
                                    <span>·</span>
                                    <span>{dept ? getRawLocalized(dept, 'name') : ''}</span>
                                    <span>·</span>
                                    {renderStatusBadge(obj.status)}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {obj.deletedAt ? (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteOrRestoreObjective(obj, true)}
                                        className="px-3 py-1 rounded-[999px] bg-emerald-600 text-white text-xs font-bold"
                                      >
                                        Khôi phục
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setDetailModalObjId(obj.objectiveId)}
                                          className="p-1.5 rounded-[999px] bg-white/80 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white"
                                          title="Chi tiết"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openAddOkrModal({
                                              titleVi: `${obj.titleVi} (Bản sao)`,
                                              titleKo: obj.titleKo ? `${obj.titleKo} (복사본)` : '',
                                            })
                                          }
                                          className="p-1.5 rounded-[999px] bg-white/80 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white"
                                          title="Nhân bản"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openEditOkrModal(obj)}
                                          className="p-1.5 rounded-[999px] bg-white/80 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white"
                                          title="Sửa"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteOrRestoreObjective(obj, false)}
                                          className="p-1.5 rounded-[999px] bg-white/80 dark:bg-slate-800 hover:bg-rose-600 hover:text-white"
                                          title="Xóa mềm"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="min-w-0">
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug break-words">
                                      {renderLocalized(obj, 'title')}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                                      Weight: {obj.weight || 100}% · Hạn chót: {formatLocaleDate(obj.dueDate, lang)}
                                    </p>
                                  </div>
                                  <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 shrink-0 tabular-nums">
                                    {obj.progress || 0}%
                                  </span>
                                </div>

                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3.5">
                                  <div
                                    className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300"
                                    style={{ width: `${obj.progress || 0}%` }}
                                  />
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-slate-700">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                      Key Results ({krs.length})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openKrModal(obj.objectiveId)}
                                      className="px-2.5 py-1 rounded-[999px] bg-indigo-50 dark:bg-indigo-950/60 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                                    >
                                      + Thêm KR
                                    </button>
                                  </div>
                                  {krs.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">Chưa có Key Result.</p>
                                  ) : (
                                    krs.map((kr, idx) => (
                                      <div
                                        key={kr.krId}
                                        className="p-2.5 rounded-[12px] bg-white/75 dark:bg-slate-800/75 border border-white/70 dark:border-slate-700 flex items-center justify-between gap-2"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                            KR{idx + 1}: {renderLocalized(kr, 'title')}
                                          </p>
                                          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                            {formatLocaleNumber(kr.currentValue, kr.metricType, kr.unit, lang)} /{' '}
                                            {formatLocaleNumber(kr.targetValue, kr.metricType, kr.unit, lang)} (
                                            {kr.progress || 0}%)
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => openCheckInModal(kr)}
                                          className="px-3 py-1 rounded-[999px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
                                        >
                                          Check-in
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* 03. KEY RESULTS */}
                {activeTab === 'key-results' && (
                  <motion.div key="key-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          {t.krPageTitle}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">{t.krPageSub}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openKrModal()}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-[999px] shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t.addKrBtn}</span>
                      </button>
                    </div>

                    <div className="glass-surface glass-tint-emerald p-4 rounded-[12px] flex flex-wrap items-center gap-2">
                      <select
                        value={krObjFilter}
                        onChange={(e) => setKrObjFilter(e.target.value)}
                        className="text-xs font-bold bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 rounded-[12px] px-3 py-2 max-w-xs"
                      >
                        <option value="ALL">Tất cả Objectives</option>
                        {db.objectives
                          .filter((o) => !o.deletedAt)
                          .map((o) => (
                            <option key={o.objectiveId} value={o.objectiveId}>
                              {getRawLocalized(o, 'title')}
                            </option>
                          ))}
                      </select>
                      <select
                        value={krTypeFilter}
                        onChange={(e) => setKrTypeFilter(e.target.value)}
                        className="text-xs font-bold bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 rounded-[12px] px-3 py-2"
                      >
                        <option value="ALL">Tất cả kiểu đo lường</option>
                        <option value="NUMBER">Number</option>
                        <option value="PERCENTAGE">Percentage</option>
                        <option value="CURRENCY">Currency</option>
                        <option value="BOOLEAN">Boolean</option>
                        <option value="MILESTONE">Milestone</option>
                        <option value="RANGE">Range</option>
                        <option value="MANUAL">Manual</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {db.keyResults
                        .filter(
                          (k) =>
                            !k.deletedAt &&
                            (krObjFilter === 'ALL' || k.objectiveId === krObjFilter) &&
                            (krTypeFilter === 'ALL' || k.metricType === krTypeFilter)
                        )
                        .map((kr, kIdx) => {
                          const parentObj = db.objectives.find((o) => o.objectiveId === kr.objectiveId);
                          const tints = ['glass-tint-emerald', 'glass-tint-cyan', 'glass-tint-blue', 'glass-tint-violet'];
                          const tint = tints[kIdx % tints.length];
                          return (
                            <div key={kr.krId} className={`glass-surface ${tint} p-5 rounded-[12px] space-y-3 min-w-0`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                      {kr.metricType} · {kr.direction}
                                    </span>
                                    <span>·</span>
                                    {renderStatusBadge(kr.status)}
                                  </div>
                                  <h3 className="text-sm font-bold text-slate-900 dark:text-white break-words">
                                    {renderLocalized(kr, 'title')}
                                  </h3>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                    Objective: {parentObj ? getRawLocalized(parentObj, 'title') : kr.objectiveId}
                                  </p>
                                </div>
                                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums shrink-0">
                                  {kr.progress || 0}%
                                </span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                  style={{ width: `${kr.progress || 0}%` }}
                                />
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-200/70 dark:border-slate-700">
                                <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                                  {formatLocaleNumber(kr.baselineValue, kr.metricType, kr.unit, lang)} →{' '}
                                  <strong>{formatLocaleNumber(kr.currentValue, kr.metricType, kr.unit, lang)}</strong> /{' '}
                                  {formatLocaleNumber(kr.targetValue, kr.metricType, kr.unit, lang)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openCheckInModal(kr)}
                                    className="px-3.5 py-1.5 rounded-[999px] bg-indigo-600 text-white font-bold"
                                  >
                                    Check-in
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openKrModal(kr.objectiveId, kr)}
                                    className="px-3 py-1.5 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-white/70 dark:border-slate-700 font-bold"
                                  >
                                    Sửa
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </motion.div>
                )}

                {/* 04. PROJECTS MANAGEMENT */}
                {activeTab === 'projects' && (
                  <motion.div key="projects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          {t.projPageTitle}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                          {t.projPageSub}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openProjectModal()}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-[999px] shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t.addProjectBtn}</span>
                      </button>
                    </div>

                    <div className="glass-surface glass-tint-violet p-4 rounded-[12px] flex flex-wrap items-center gap-2">
                      {(['ALL', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'] as const).map((st) => (
                        <button
                          type="button"
                          key={st}
                          onClick={() => setProjStatusFilter(st)}
                          className={`px-3.5 py-1.5 rounded-[999px] text-xs font-bold transition-colors ${
                            projStatusFilter === st
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {st === 'ALL' ? 'Tất cả dự án' : st}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {db.projects
                        .filter((p) => !p.deletedAt && (projStatusFilter === 'ALL' || p.status === projStatusFilter))
                        .map((proj, pIdx) => {
                          const linkedObj = db.objectives.find((o) => o.objectiveId === proj.objectiveId);
                          const linkedTasks = db.tasks.filter(
                            (tk) => !tk.deletedAt && tk.projectId === proj.projectId
                          );
                          const doneTasks = linkedTasks.filter((tk) => tk.status === 'DONE').length;
                          const tints = ['glass-tint-violet', 'glass-tint-blue', 'glass-tint-amber', 'glass-tint-pink'];
                          const tint = tints[pIdx % tints.length];
                          return (
                            <div key={proj.projectId} className={`glass-surface ${tint} p-5 rounded-[12px] space-y-3 min-w-0`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                                    {renderStatusBadge(proj.status)}
                                    <span>·</span>
                                    <span>{proj.priority}</span>
                                    <span>·</span>
                                    <span className="tabular-nums">
                                      {doneTasks}/{linkedTasks.length} Tasks
                                    </span>
                                  </div>
                                  <h3 className="text-base font-bold text-slate-900 dark:text-white break-words">
                                    {renderLocalized(proj, 'name')}
                                  </h3>
                                  {linkedObj && (
                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5 truncate">
                                      OKR: {getRawLocalized(linkedObj, 'title')}
                                    </p>
                                  )}
                                </div>
                                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 tabular-nums shrink-0">
                                  {proj.progress}%
                                </span>
                              </div>

                              <p className="text-xs text-slate-600 dark:text-slate-300 break-words">
                                {getRawLocalized(proj, 'description') || 'Chưa có mô tả.'}
                              </p>

                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-indigo-600 to-cyan-500 rounded-full"
                                  style={{ width: `${proj.progress}%` }}
                                />
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-700 text-xs">
                                <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                                  <span>{formatLocaleDate(proj.startDate, lang)}</span>
                                  <span> → </span>
                                  <span>{formatLocaleDate(proj.dueDate, lang)}</span>
                                  {proj.budget > 0 && (
                                    <span>
                                      {' '}
                                      · {proj.budget.toLocaleString()} {proj.currency}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {proj.driveLink && (
                                    <a
                                      href={proj.driveLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-white/70 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1"
                                    >
                                      <span>Drive</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openProjectModal(proj)}
                                    className="px-3 py-1.5 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-white/70 dark:border-slate-700 font-bold"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProject(proj)}
                                    className="p-1.5 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-white/70 dark:border-slate-700 hover:bg-rose-600 hover:text-white"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </motion.div>
                )}

                {/* 05. TASKS KANBAN 6 COLUMNS */}
                {activeTab === 'kanban' && (
                  <motion.div key="kanban" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          {t.kanbanPageTitle}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                          Backlog → To Do → In Progress → Blocked → Review → Done
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={kanbanProjectFilter}
                          onChange={(e) => setKanbanProjectFilter(e.target.value)}
                          className="text-xs font-bold bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 rounded-[12px] px-3 py-2"
                        >
                          <option value="ALL">Tất cả Dự án</option>
                          {db.projects
                            .filter((p) => !p.deletedAt)
                            .map((p) => (
                              <option key={p.projectId} value={p.projectId}>
                                {getRawLocalized(p, 'name')}
                              </option>
                            ))}
                        </select>
                        <select
                          value={kanbanObjFilter}
                          onChange={(e) => setKanbanObjFilter(e.target.value)}
                          className="text-xs font-bold bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 rounded-[12px] px-3 py-2"
                        >
                          <option value="ALL">Tất cả Objectives</option>
                          {db.objectives
                            .filter((o) => !o.deletedAt)
                            .map((o) => (
                              <option key={o.objectiveId} value={o.objectiveId}>
                                {getRawLocalized(o, 'title')}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => openAddTaskModal('TO_DO')}
                          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-[999px]"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Tạo Task</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3.5">
                      {(
                        [
                          { key: 'BACKLOG', title: 'Backlog', tint: 'glass-tint-cyan' },
                          { key: 'TO_DO', title: 'To Do', tint: 'glass-tint-blue' },
                          { key: 'IN_PROGRESS', title: 'In Progress', tint: 'glass-tint-violet' },
                          { key: 'BLOCKED', title: 'Blocked', tint: 'glass-tint-pink' },
                          { key: 'REVIEW', title: 'Review', tint: 'glass-tint-amber' },
                          { key: 'DONE', title: 'Done', tint: 'glass-tint-emerald' },
                        ] as Array<{ key: TaskStatus; title: string; tint: string }>
                      ).map((col) => {
                        const items = db.tasks.filter(
                          (tk) =>
                            !tk.deletedAt &&
                            tk.status === col.key &&
                            (kanbanProjectFilter === 'ALL' || tk.projectId === kanbanProjectFilter) &&
                            (kanbanObjFilter === 'ALL' || tk.objectiveId === kanbanObjFilter)
                        );
                        return (
                          <div
                            key={col.key}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const id = e.dataTransfer.getData('text/plain');
                              const task = db.tasks.find((tk) => tk.taskId === id);
                              if (task) handleUpdateTaskStatus(task, col.key);
                            }}
                            className={`glass-surface ${col.tint} p-3 rounded-[12px] flex flex-col justify-between min-h-[340px]`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-2.5 px-1">
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                  {col.title}
                                </span>
                                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                  {items.length}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {items.map((task) => {
                                  const proj = db.projects.find((p) => p.projectId === task.projectId);
                                  const order: TaskStatus[] = ['BACKLOG', 'TO_DO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
                                  const nextStatus =
                                    order[Math.min(order.indexOf(task.status) + 1, order.length - 1)];
                                  return (
                                    <div
                                      key={task.taskId}
                                      draggable
                                      onDragStart={(e) => e.dataTransfer.setData('text/plain', task.taskId)}
                                      className="bg-white/85 dark:bg-slate-900/85 p-3 rounded-[12px] border border-white/70 dark:border-slate-700 shadow-2xs cursor-grab space-y-2"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug break-words">
                                          {renderLocalized(task, 'title')}
                                        </p>
                                        {col.key !== 'DONE' && (
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateTaskStatus(task, nextStatus)}
                                            className="p-1.5 rounded-[999px] bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white shrink-0"
                                            title="Chuyển bước tiếp theo"
                                          >
                                            <ArrowRight className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                      {proj && (
                                        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 truncate">
                                          {getRawLocalized(proj, 'name')}
                                        </p>
                                      )}
                                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                        <span>{task.priority}</span>
                                        <div className="flex items-center gap-1.5">
                                          <span>{formatLocaleDate(task.dueDate, lang)}</span>
                                          <button
                                            type="button"
                                            onClick={() => openAddTaskModal(col.key, task)}
                                            className="p-1 rounded-[999px] hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteTask(task)}
                                            className="p-1 rounded-[999px] hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-600"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openAddTaskModal(col.key)}
                              className="mt-3 w-full py-1.5 rounded-[999px] text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Thêm Task</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 06. CHECK-IN CENTER */}
                {activeTab === 'checkins' && (
                  <motion.div key="checkins" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          {t.checkinPageTitle}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                          {t.checkinPageSub}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const first = db.keyResults.find((k) => !k.deletedAt);
                          if (first) openCheckInModal(first);
                          else showToast('Chưa có Key Result để Check-in', 'error');
                        }}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-[999px] shrink-0"
                      >
                        <Layers className="w-4 h-4" />
                        <span>{t.bulkCheckinBtn}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      <div className="lg:col-span-5 glass-surface glass-tint-cyan p-5 rounded-[12px]">
                        <h2 className="font-bold text-base text-slate-900 dark:text-white mb-3">
                          Key Results cần cập nhật
                        </h2>
                        <div className="space-y-2.5 max-h-[450px] overflow-y-auto">
                          {db.keyResults
                            .filter((k) => !k.deletedAt)
                            .map((kr) => (
                              <div
                                key={kr.krId}
                                className="p-3 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {renderLocalized(kr, 'title')}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                    Tiến độ: {kr.progress || 0}% · Lần cuối:{' '}
                                    {kr.lastCheckinAt ? formatLocaleDate(kr.lastCheckinAt, lang) : 'Chưa check-in'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openCheckInModal(kr)}
                                  className="px-3.5 py-1.5 rounded-[999px] bg-indigo-600 text-white text-xs font-bold shrink-0"
                                >
                                  Check-in
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="lg:col-span-7 glass-surface glass-tint-emerald p-5 rounded-[12px]">
                        <h2 className="font-bold text-base text-slate-900 dark:text-white mb-3">
                          Lịch sử Check-in (Tab CHECKINS)
                        </h2>
                        <div className="space-y-3 max-h-[450px] overflow-y-auto">
                          {db.checkins.length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-8">Chưa có bản ghi Check-in.</p>
                          ) : (
                            db.checkins.map((ci) => {
                              const kr = db.keyResults.find((k) => k.krId === ci.krId);
                              return (
                                <div
                                  key={ci.checkInId}
                                  className="p-3.5 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-white/70 dark:border-slate-700 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                                      {kr ? getRawLocalized(kr, 'title') : ci.krId}
                                    </span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                                      {ci.calculatedProgress}% · Conf: {ci.confidenceScore}/10
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-800 dark:text-slate-200 break-words">
                                    <strong>Wins:</strong> {renderLocalized(ci, 'wins')}
                                  </p>
                                  {ci.blockersVi && (
                                    <p className="text-xs text-rose-700 dark:text-rose-400 break-words">
                                      <strong>Blockers:</strong> {ci.blockersVi}
                                    </p>
                                  )}
                                  {ci.nextStepsVi && (
                                    <p className="text-xs text-emerald-700 dark:text-emerald-400 break-words">
                                      <strong>Next:</strong> {ci.nextStepsVi}
                                    </p>
                                  )}
                                  {ci.evidenceUrl && (
                                    <a
                                      href={ci.evidenceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                      <span>Xem tài liệu minh chứng Drive</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 tabular-nums">
                                    <span>{ci.ownerId}</span>
                                    <span>{formatLocaleDate(ci.createdAt, lang)}</span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* 07. ALIGNMENT TREE */}
                {activeTab === 'alignment' && (
                  <motion.div key="alignment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        {t.alignPageTitle}
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                        Company → Department → Key Results → Projects → Tasks
                      </p>
                    </div>
                    <div className="space-y-3">
                      {db.objectives
                        .filter((o) => !o.deletedAt)
                        .map((obj, aIdx) => {
                          const krs = db.keyResults.filter(
                            (k) => k.objectiveId === obj.objectiveId && !k.deletedAt
                          );
                          const projs = db.projects.filter(
                            (p) => p.objectiveId === obj.objectiveId && !p.deletedAt
                          );
                          const tints = ['glass-tint-blue', 'glass-tint-violet', 'glass-tint-emerald', 'glass-tint-cyan'];
                          const tint = tints[aIdx % tints.length];
                          return (
                            <div
                              key={obj.objectiveId}
                              className={`glass-surface ${tint} p-4 rounded-[12px] ${obj.parentObjectiveId ? 'sm:ml-8' : ''}`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                    {obj.level}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white ml-2 break-words">
                                    {renderLocalized(obj, 'title')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {renderStatusBadge(obj.status)}
                                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                                    {obj.progress || 0}%
                                  </span>
                                </div>
                              </div>
                              {(krs.length > 0 || projs.length > 0) && (
                                <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-700 space-y-1">
                                  {krs.map((k) => (
                                    <p key={k.krId} className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                                      · <strong>KR:</strong> {renderLocalized(k, 'title')} ({k.progress || 0}%)
                                    </p>
                                  ))}
                                  {projs.map((p) => (
                                    <p key={p.projectId} className="text-xs text-emerald-700 dark:text-emerald-400 tabular-nums">
                                      · <strong>Project:</strong> {renderLocalized(p, 'name')} ({p.progress || 0}%)
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </motion.div>
                )}

                {/* 08. GOOGLE DRIVE STORAGE MANAGER */}
                {activeTab === 'drive-files' && (
                  <motion.div key="drive-files" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          {t.drivePageTitle}
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                          {t.drivePageSub}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {driveFolder?.webViewLink && (
                          <a
                            href={driveFolder.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-white/70 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5"
                          >
                            <FolderOpen className="w-4 h-4 text-amber-500" />
                            <span>Mở thư mục Drive</span>
                          </a>
                        )}
                        <label className="px-4 py-2 rounded-[999px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
                          <Upload className="w-4 h-4" />
                          <span>Tải tệp lên Google Drive</span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) await handleUploadFileToDrive(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Active Spreadsheet Selector & New Sheet */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="glass-surface glass-tint-blue p-5 rounded-[12px] space-y-3">
                        <h2 className="font-bold text-base text-slate-900 dark:text-white">
                          Bảng tính Google Sheets đang kết nối
                        </h2>
                        <div className="space-y-2">
                          {driveSpreadsheets.length === 0 ? (
                            <p className="text-xs text-slate-500">Chưa có Google Sheet nào trong thư mục.</p>
                          ) : (
                            driveSpreadsheets.map((sp) => (
                              <div
                                key={sp.id}
                                className={`p-3 rounded-[12px] border flex items-center justify-between gap-2 ${
                                  sp.id === activeSpreadsheetId
                                    ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700'
                                    : 'bg-white/75 dark:bg-slate-800/75 border-white/70 dark:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {sp.name}
                                    </p>
                                    <p className="text-[11px] text-slate-500 tabular-nums">
                                      {formatLocaleDate(sp.modifiedTime, lang)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {sp.id === activeSpreadsheetId ? (
                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                      Đang dùng
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSelectSpreadsheet(sp.id)}
                                      className="px-3 py-1 rounded-[999px] bg-indigo-600 text-white text-xs font-bold"
                                    >
                                      Chọn
                                    </button>
                                  )}
                                  {sp.webViewLink && (
                                    <a
                                      href={sp.webViewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-white/70 dark:border-slate-700"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="glass-surface glass-tint-emerald p-5 rounded-[12px] space-y-3">
                        <h2 className="font-bold text-base text-slate-900 dark:text-white">
                          Tạo Google Sheet Cơ sở dữ liệu mới
                        </h2>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Tạo thêm một tệp bảng tính mới cho chu kỳ hoặc phòng ban khác ngay trong thư mục Google Drive.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            value={newSheetNameInput}
                            onChange={(e) => setNewSheetNameInput(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleCreateSpreadsheet(false)}
                            className="px-4 py-2 rounded-[999px] bg-indigo-600 text-white text-xs font-bold shrink-0"
                          >
                            Tạo Sheet mới
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* All Files in Drive Folder */}
                    <div className="glass-surface glass-tint-cyan p-5 rounded-[12px] overflow-x-auto">
                      <h2 className="font-bold text-base text-slate-900 dark:text-white mb-3">
                        Tệp trong thư mục Google Drive ({driveFiles.length})
                      </h2>
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200/70 dark:border-slate-700">
                            <th className="p-2.5 font-bold">Tên tệp</th>
                            <th className="p-2.5 font-bold">Loại</th>
                            <th className="p-2.5 font-bold">Cập nhật</th>
                            <th className="p-2.5 font-bold text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                          {driveFiles.map((f) => (
                            <tr key={f.id}>
                              <td className="p-2.5 font-bold flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                <span className="truncate max-w-xs">{f.name}</span>
                              </td>
                              <td className="p-2.5 text-slate-500 dark:text-slate-400">
                                {f.mimeType.includes('spreadsheet') ? 'Google Sheet' : 'Drive File'}
                              </td>
                              <td className="p-2.5 text-slate-500 dark:text-slate-400 tabular-nums">
                                {formatLocaleDate(f.modifiedTime, lang)}
                              </td>
                              <td className="p-2.5 text-right space-x-2 whitespace-nowrap">
                                {f.webViewLink && (
                                  <a
                                    href={f.webViewLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1 rounded-[999px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold"
                                  >
                                    Mở
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      title: 'Xóa tệp khỏi Google Drive',
                                      message: `Bạn có chắc chắn muốn xóa vĩnh viễn tệp "${f.name}" khỏi Google Drive? Thao tác này không thể hoàn tác.`,
                                      confirmLabel: 'Xóa khỏi Drive',
                                      tone: 'danger',
                                      onConfirm: async () => {
                                        setConfirmDialog((p) => ({ ...p, open: false }));
                                        setLoadingText('Đang xóa tệp trên Google Drive...');
                                        try {
                                          await deleteDriveFile(f.id);
                                          if (authUser) await connectAndLoadWorkspace(authUser);
                                          showToast(`Đã xóa tệp "${f.name}" khỏi Google Drive.`);
                                        } catch (err: unknown) {
                                          showToast((err as Error).message, 'error');
                                        } finally {
                                          setLoadingText('');
                                        }
                                      },
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-[999px] bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-bold"
                                >
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* 09. REPORTS & CSV */}
                {activeTab === 'reports' && (
                  <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                          {t.reportsPageTitle}
                        </h1>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={reportType}
                          onChange={(e) => setReportType(e.target.value)}
                          className="text-xs font-bold bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 rounded-[12px] px-3 py-2"
                        >
                          <option value="COMPANY_OKR">1. Company OKR Report</option>
                          <option value="DEPARTMENT_OKR">2. Department OKR Report</option>
                          <option value="PROJECTS_REPORT">3. Projects Progress Report</option>
                          <option value="TASKS_REPORT">4. Tasks Execution Report</option>
                          <option value="KR_REPORT">5. Key Results Report</option>
                          <option value="CHECKIN_COMPLIANCE">6. Check-in Compliance Report</option>
                          <option value="AT_RISK_OKR">7. At-Risk OKR Report</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            exportReportCsv(
                              reportDataset.headers,
                              reportDataset.rows,
                              `${reportType}_${new Date().toISOString().slice(0, 10)}.csv`
                            )
                          }
                          className="px-4 py-2 rounded-[999px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Xuất CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-4 py-2 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-white/70 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>In báo cáo</span>
                        </button>
                      </div>
                    </div>

                    <div className="glass-surface glass-tint-violet p-5 rounded-[12px] overflow-x-auto">
                      {reportDataset.rows.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">Chưa có dữ liệu báo cáo.</p>
                      ) : (
                        <table className="w-full text-left border-collapse text-xs tabular-nums">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                              {reportDataset.headers.map((h, i) => (
                                <th key={i} className="p-3 font-bold text-slate-700 dark:text-slate-300">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                            {reportDataset.rows.map((r, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                                {r.map((cell, cIdx) => (
                                  <td key={cIdx} className="p-3 text-slate-800 dark:text-slate-200">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 10. TEAM, DEPARTMENTS & DYNAMIC ORGANIZATION CHART */}
                {activeTab === 'team' && currentUserProfile && (
                  <motion.div key="team" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <OrganizationChartView
                      lang={lang}
                      db={db}
                      currentUser={currentUserProfile}
                      onOrgAction={handleOrgAction}
                      onOpenObjectiveDetail={(objId) => setDetailModalObjId(objId)}
                    />
                  </motion.div>
                )}

                {/* 10B. USER APPROVAL MANAGEMENT (ADMIN ONLY) */}
                {activeTab === 'approval' && (
                  activeRole === 'ADMIN' && currentUserProfile ? (
                    <motion.div key="approval" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <UserApprovalView
                        lang={lang}
                        db={db}
                        currentUser={currentUserProfile}
                        onApproveUser={(payload) =>
                          handleApprovalAction(
                            { action: 'approveUser', ...payload },
                            'Đã phê duyệt & kích hoạt tài khoản nhân sự!'
                          )
                        }
                        onSaveDraft={(payload) =>
                          handleApprovalAction(
                            { action: 'saveDraft', ...payload },
                            'Đã lưu cấu hình tạm thời cho nhân sự.'
                          )
                        }
                        onRejectUser={(userId, reason) =>
                          handleApprovalAction(
                            { action: 'rejectUser', userId, reason },
                            'Đã từ chối yêu cầu đăng ký tài khoản.'
                          )
                        }
                        onSuspendUser={(userId, reason, nextStatus) =>
                          handleApprovalAction(
                            { action: 'suspendUser', userId, reason, nextStatus },
                            'Đã cập nhật trạng thái tạm khóa tài khoản.'
                          )
                        }
                        onReactivateUser={(userId, reason) =>
                          handleApprovalAction(
                            { action: 'reactivateUser', userId, reason },
                            'Đã kích hoạt lại tài khoản nhân sự!'
                          )
                        }
                      />
                    </motion.div>
                  ) : (
                    <div className="glass-surface glass-tint-pink p-8 rounded-[12px] text-center text-sm text-rose-600 dark:text-rose-400 font-bold">
                      Chỉ Quản trị viên hệ thống (ADMIN) mới có quyền truy cập khu vực Phê duyệt tài khoản.
                    </div>
                  )
                )}

                {/* 11. CALENDAR */}
                {activeTab === 'calendar' && (
                  <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                      {t.calPageTitle}
                    </h1>
                    <div className="glass-surface glass-tint-cyan p-5 rounded-[12px] space-y-3">
                      {[
                        ...db.cycles.map((c) => ({
                          id: c.cycleId,
                          type: 'Chu kỳ',
                          title: getRawLocalized(c, 'name'),
                          start: c.startDate,
                          end: c.endDate,
                          status: c.status,
                        })),
                        ...db.objectives
                          .filter((o) => !o.deletedAt)
                          .map((o) => ({
                            id: o.objectiveId,
                            type: 'OKR',
                            title: getRawLocalized(o, 'title'),
                            start: o.startDate,
                            end: o.dueDate,
                            status: o.status,
                          })),
                        ...db.projects
                          .filter((p) => !p.deletedAt)
                          .map((p) => ({
                            id: p.projectId,
                            type: 'Dự án',
                            title: getRawLocalized(p, 'name'),
                            start: p.startDate,
                            end: p.dueDate,
                            status: p.status,
                          })),
                      ].map((it) => (
                        <div
                          key={it.id}
                          className="p-3.5 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{it.type}</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white ml-2 break-words">
                              {it.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                            <span>
                              {formatLocaleDate(it.start, lang)} → {formatLocaleDate(it.end, lang)}
                            </span>
                            {renderStatusBadge(it.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* 12. NOTIFICATIONS */}
                {activeTab === 'notifications' && (
                  <motion.div key="notifications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        Thông báo hệ thống
                      </h1>
                      <button
                        type="button"
                        onClick={() =>
                          commitDatabaseChange(
                            (prev) => ({
                              ...prev,
                              notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
                            }),
                            'Đã đánh dấu tất cả là đã đọc'
                          )
                        }
                        className="px-4 py-2 rounded-[999px] bg-white/80 dark:bg-slate-800 border border-white/70 dark:border-slate-700 text-xs font-bold"
                      >
                        Đánh dấu đã đọc
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {db.notifications.length === 0 ? (
                        <div className="glass-surface p-8 rounded-[12px] text-center text-xs text-slate-500">
                          Không có thông báo mới.
                        </div>
                      ) : (
                        db.notifications.map((n) => (
                          <div
                            key={n.notificationId}
                            className={`glass-surface glass-tint-blue p-4 rounded-[12px] flex items-center justify-between gap-3 ${
                              n.isRead ? 'opacity-70' : ''
                            }`}
                          >
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                {renderLocalized(n, 'title')}
                              </h4>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                                {renderLocalized(n, 'message')}
                              </p>
                            </div>
                            <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                              {formatLocaleDate(n.createdAt, lang)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}

                {/* 13. TEMPLATES */}
                {activeTab === 'templates' && (
                  <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        {t.tplPageTitle}
                      </h1>
                      <select
                        value={tplCategory}
                        onChange={(e) => setTplCategory(e.target.value)}
                        className="text-xs font-bold bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 rounded-[12px] px-3 py-2"
                      >
                        <option value="ALL">Tất cả 10 khối chuyên môn</option>
                        {OKR_TEMPLATES_LIBRARY.map((tItem) => (
                          <option key={tItem.cat} value={tItem.cat}>
                            {tItem.cat} OKR
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {OKR_TEMPLATES_LIBRARY.filter(
                        (tItem) => tplCategory === 'ALL' || tItem.cat === tplCategory
                      ).map((tpl, idx) => {
                        const tints = ['glass-tint-cyan', 'glass-tint-emerald', 'glass-tint-violet', 'glass-tint-amber', 'glass-tint-blue', 'glass-tint-pink'];
                        const tint = tints[idx % tints.length];
                        return (
                          <div key={idx} className={`glass-surface ${tint} p-5 rounded-[12px] flex flex-col justify-between gap-3`}>
                            <div>
                              <span className="text-xs font-bold text-teal-700 dark:text-teal-400">{tpl.cat} OKR</span>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                                {renderLocalized(tpl, 'title')}
                              </h3>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                <strong>Sample KR:</strong> {renderLocalized(tpl, 'kr')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openAddOkrModal(tpl)}
                              className="self-start px-4 py-2 rounded-[999px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                            >
                              Áp dụng mẫu này
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 14. CYCLES */}
                {activeTab === 'cycles' && (
                  <motion.div key="cycles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex items-center justify-between">
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        {t.cyclesPageTitle}
                      </h1>
                      <button
                        type="button"
                        onClick={() => {
                          const y = new Date().getFullYear() + 1;
                          commitDatabaseChange(
                            (prev) => ({
                              ...prev,
                              cycles: [
                                ...prev.cycles,
                                {
                                  cycleId: `CYC-${Date.now()}`,
                                  nameVi: `Quý 1 / ${y}`,
                                  nameKo: `${y}년 1분기`,
                                  cycleType: 'QUARTERLY',
                                  startDate: `${y}-01-01`,
                                  endDate: `${y}-03-31`,
                                  status: 'DRAFT',
                                  createdAt: new Date().toISOString(),
                                },
                              ],
                            }),
                            'Đã tạo chu kỳ mới trên Google Sheets!'
                          );
                        }}
                        className="px-4 py-2.5 rounded-[999px] bg-indigo-600 text-white text-xs font-bold"
                      >
                        + Tạo Chu kỳ mới
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {db.cycles.map((c, cIdx) => {
                        const tints = ['glass-tint-blue', 'glass-tint-emerald', 'glass-tint-violet', 'glass-tint-amber'];
                        const tint = tints[cIdx % tints.length];
                        return (
                          <div key={c.cycleId} className={`glass-surface ${tint} p-5 rounded-[12px] space-y-2.5`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-blue-600 dark:text-blue-400">{c.cycleType}</span>
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">{c.status}</span>
                            </div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                              {renderLocalized(c, 'name')}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                              {formatLocaleDate(c.startDate, lang)} → {formatLocaleDate(c.endDate, lang)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 15. SETTINGS & AUDIT LOGS */}
                {activeTab === 'settings' && (
                  <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                      {t.settingsPageTitle}
                    </h1>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      <div className="lg:col-span-6 glass-surface glass-tint-blue p-5 rounded-[12px] space-y-4">
                        <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                          <Table2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Kết nối Google Drive & Google Sheets</span>
                        </h2>
                        <div className="p-3.5 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 space-y-1.5 text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Tài khoản Google:</span>
                            <span className="font-bold truncate">{authUser?.email}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Thư mục Drive:</span>
                            <span className="font-bold">{driveFolder?.name || 'FlowOKR_Workspace'}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Spreadsheet ID:</span>
                            <span className="font-mono text-[11px] truncate max-w-[200px]">
                              {activeSpreadsheetId || 'Chưa chọn'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => authUser && connectAndLoadWorkspace(authUser)}
                            className="px-4 py-2 rounded-[999px] bg-emerald-600 text-white text-xs font-bold"
                          >
                            Đồng bộ từ Google Sheets
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                title: 'Xóa toàn bộ dữ liệu trên Google Sheet',
                                message: `CẢNH BÁO: Thao tác này sẽ xóa toàn bộ Mục tiêu, KR, Dự án và Công việc hiện tại trong bảng tính "${activeSpreadsheetName}". Bạn có chắc chắn muốn thực hiện?`,
                                confirmLabel: 'Xóa toàn bộ dữ liệu',
                                tone: 'danger',
                                onConfirm: async () => {
                                  setConfirmDialog((p) => ({ ...p, open: false }));
                                  await commitDatabaseChange(
                                    (prev) => ({
                                      ...prev,
                                      objectives: [],
                                      keyResults: [],
                                      projects: [],
                                      tasks: [],
                                      checkins: [],
                                    }),
                                    'Đã làm trống dữ liệu OKR, Dự án & Task trên Google Sheets.'
                                  );
                                },
                              })
                            }
                            className="px-4 py-2 rounded-[999px] bg-rose-600 text-white text-xs font-bold"
                          >
                            Làm trống dữ liệu Sheet
                          </button>
                        </div>

                        <div className="pt-2 border-t border-slate-200/70 dark:border-slate-700 space-y-1 text-xs">
                          <div className="flex justify-between gap-2">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Vai trò (Xác thực Backend):</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{activeRole}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Trạng thái tài khoản:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{accountStatus || 'APPROVED'}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="font-bold text-slate-600 dark:text-slate-400">Google Sub ID:</span>
                            <span className="font-mono text-[11px] truncate max-w-[180px]">
                              {currentUserProfile?.googleSub || '--'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-6 glass-surface glass-tint-violet p-5 rounded-[12px] space-y-4">
                        <h2 className="font-bold text-base text-slate-900 dark:text-white">
                          Quy tắc Scoring Engine (Tab SETTINGS)
                        </h2>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block font-bold mb-1">Tên Doanh nghiệp</label>
                            <input
                              value={db.settings.companyName}
                              onChange={(e) =>
                                setDb((p) => ({
                                  ...p,
                                  settings: { ...p.settings, companyName: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block font-bold mb-1">Tần suất Check-in</label>
                            <select
                              value={db.settings.checkinFrequency}
                              onChange={(e) =>
                                setDb((p) => ({
                                  ...p,
                                  settings: { ...p.settings, checkinFrequency: e.target.value },
                                }))
                              }
                              className="w-full px-3 py-2 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700"
                            >
                              <option value="WEEKLY">Hàng tuần</option>
                              <option value="BIWEEKLY">Hai tuần</option>
                              <option value="MONTHLY">Hàng tháng</option>
                            </select>
                          </div>
                          <div>
                            <label className="block font-bold mb-1">Ngưỡng On Track (%)</label>
                            <input
                              type="number"
                              value={db.settings.onTrackThreshold}
                              onChange={(e) =>
                                setDb((p) => ({
                                  ...p,
                                  settings: { ...p.settings, onTrackThreshold: Number(e.target.value) },
                                }))
                              }
                              className="w-full px-3 py-2 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block font-bold mb-1">Ngưỡng At Risk (%)</label>
                            <input
                              type="number"
                              value={db.settings.atRiskThreshold}
                              onChange={(e) =>
                                setDb((p) => ({
                                  ...p,
                                  settings: { ...p.settings, atRiskThreshold: Number(e.target.value) },
                                }))
                              }
                              className="w-full px-3 py-2 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            commitDatabaseChange((prev) => prev, 'Đã lưu cấu hình SETTINGS lên Google Sheets!')
                          }
                          className="px-4 py-2 rounded-[999px] bg-indigo-600 text-white text-xs font-bold"
                        >
                          Lưu cấu hình vào Sheet
                        </button>
                      </div>
                    </div>

                    <div className="glass-surface p-5 rounded-[12px] overflow-x-auto">
                      <h2 className="font-bold text-base text-slate-900 dark:text-white mb-3">
                        Nhật ký Hoạt động (AUDIT_LOGS)
                      </h2>
                      <table className="w-full text-left text-xs tabular-nums">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700">
                            <th className="p-2.5 font-bold">Thời gian</th>
                            <th className="p-2.5 font-bold">Hành động</th>
                            <th className="p-2.5 font-bold">Đối tượng</th>
                            <th className="p-2.5 font-bold">Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800">
                          {db.auditLogs.slice(0, 25).map((l) => (
                            <tr key={l.logId}>
                              <td className="p-2.5 text-slate-500">{formatLocaleDate(l.timestamp, lang)}</td>
                              <td className="p-2.5 font-bold">{l.action}</td>
                              <td className="p-2.5">
                                {l.entityType} · {l.entityId}
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-300 break-words">{l.newValue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}

                {/* 16. GUIDE */}
                {activeTab === 'guide' && (
                  <motion.div key="guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <BookOpenCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                          <span>{t.guidePageTitle}</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">{t.guidePageSub}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-4 py-2 rounded-[999px] bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>{t.guidePrintBtn}</span>
                      </button>
                    </div>

                    <div className="glass-surface glass-tint-cyan p-3 rounded-[12px] flex flex-wrap gap-2">
                      {[
                        { key: 'ALL', label: 'Tất cả giai đoạn' },
                        { key: 'SETUP', label: '01. Kết nối Google Drive & Sheets' },
                        { key: 'OKR', label: '02. OKR & Dự án' },
                        { key: 'CHECKIN', label: '03. Tasks & Check-in' },
                      ].map((tab) => (
                        <button
                          type="button"
                          key={tab.key}
                          onClick={() => setGuideFilter(tab.key)}
                          className={`px-3.5 py-1.5 rounded-[999px] text-xs font-bold transition-colors ${
                            guideFilter === tab.key
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-4">
                      {GUIDE_MODULES_DATA.filter((g) => guideFilter === 'ALL' || g.phase === guideFilter).map(
                        (item, gIdx) => {
                          const tints = ['glass-tint-blue', 'glass-tint-violet', 'glass-tint-emerald'];
                          const tint = tints[gIdx % tints.length];
                          return (
                            <div key={item.phase} className={`glass-surface ${tint} p-5 sm:p-6 rounded-[12px] space-y-4`}>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70 dark:border-slate-700">
                                <div className="space-y-1">
                                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                    {item.stepBadge}
                                  </span>
                                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                                    {lang === 'ko' ? item.titleKo : item.titleVi}
                                  </h2>
                                  <p className="text-xs text-slate-600 dark:text-slate-300">
                                    {lang === 'ko' ? item.summaryKo : item.summaryVi}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab(item.actionTab as NavTab)}
                                  className="self-start sm:self-center shrink-0 px-4 py-2 rounded-[999px] bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5"
                                >
                                  <span>{lang === 'ko' ? item.actionLabelKo : item.actionLabelVi}</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="space-y-2.5">
                                {(lang === 'ko' ? item.stepsKo : item.stepsVi).map((stepText, idx) => (
                                  <div
                                    key={idx}
                                    className="p-3.5 rounded-[12px] bg-white/80 dark:bg-slate-800/80 border border-white/70 dark:border-slate-700 flex items-start gap-3"
                                  >
                                    <span className="w-6 h-6 rounded-[12px] bg-indigo-600/15 text-indigo-700 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 tabular-nums">
                                      {idx + 1}
                                    </span>
                                    <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                                      {stepText}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Confirmation Dialog */}
      <Modals
        lang={lang}
        db={db}
        getRawLocalized={getRawLocalized}
        renderStatusBadge={renderStatusBadge}
        okrModal={okrModal}
        setOkrModal={setOkrModal}
        onSaveOkr={handleSaveOkrSubmit}
        krModal={krModal}
        setKrModal={setKrModal}
        onSaveKr={handleSaveKrSubmit}
        projectModal={projectModal}
        setProjectModal={setProjectModal}
        onSaveProject={handleSaveProjectSubmit}
        taskModal={taskModal}
        setTaskModal={setTaskModal}
        onSaveTask={handleSaveTaskSubmit}
        checkinModal={checkinModal}
        setCheckinModal={setCheckinModal}
        onSaveCheckIn={handleCheckInSubmit}
        onUploadEvidenceToDrive={handleUploadFileToDrive}
        detailObj={detailObj}
        onCloseDetail={() => setDetailModalObjId(null)}
        detailCommentInput={detailCommentInput}
        setDetailCommentInput={setDetailCommentInput}
        onAddComment={async (e, objectiveId) => {
          e.preventDefault();
          if (!detailCommentInput.trim() || !requireWritePermission()) return;
          await commitDatabaseChange(
            (prev) => ({
              ...prev,
              comments: [
                {
                  commentId: `CMT-${Date.now()}`,
                  entityType: 'OBJECTIVE',
                  entityId: objectiveId,
                  userId: currentUserProfile?.userId || authUser?.uid || 'USER',
                  bodyVi: detailCommentInput.trim(),
                  bodyKo: '',
                  createdAt: new Date().toISOString(),
                },
                ...prev.comments,
              ],
            }),
            'Đã gửi bình luận lên Google Sheets!'
          );
          setDetailCommentInput('');
        }}
        onOpenKrFromDetail={(objectiveId) => {
          setDetailModalObjId(null);
          openKrModal(objectiveId);
        }}
        onOpenCheckInFromDetail={(kr) => {
          setDetailModalObjId(null);
          openCheckInModal(kr);
        }}
      />

      <ConfirmModal
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        tone={confirmDialog.tone}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((p) => ({ ...p, open: false }))}
      />
    </div>
  );
}
