import type {
  DatabaseState,
  KeyResult,
  OkrStatus,
  ProjectStatus,
  WorkspaceSettings,
} from '@/types/okr';

export function calculateKrProgress(kr: Partial<KeyResult>): number {
  const base = Number(kr.baselineValue) || 0;
  const curr = Number(kr.currentValue) || 0;
  const target = Number(kr.targetValue) || 0;
  const type = (kr.metricType || 'NUMBER').toUpperCase();
  const dir = (kr.direction || 'INCREASE').toUpperCase();

  let pct = 0;
  if (type === 'BOOLEAN') {
    pct = curr >= 1 ? 100 : 0;
  } else if (type === 'RANGE' || dir === 'MAINTAIN') {
    const minT =
      kr.minTargetValue !== '' && kr.minTargetValue !== undefined
        ? Number(kr.minTargetValue)
        : Math.min(base, target);
    const maxT =
      kr.maxTargetValue !== '' && kr.maxTargetValue !== undefined
        ? Number(kr.maxTargetValue)
        : Math.max(base, target);
    if (curr >= minT && curr <= maxT) pct = 100;
    else if (curr < minT && minT > 0) pct = Math.max(0, (curr / minT) * 100);
    else if (curr > maxT && curr > 0) pct = Math.max(0, (maxT / curr) * 100);
  } else if (dir === 'DECREASE') {
    pct =
      base === target
        ? curr <= target
          ? 100
          : 0
        : ((base - curr) / (base - target)) * 100;
  } else {
    pct =
      target === base
        ? curr >= target
          ? 100
          : 0
        : ((curr - base) / (target - base)) * 100;
  }
  return Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10;
}

export function calculateExpectedProgress(startDateStr?: string, dueDateStr?: string): number {
  if (!startDateStr || !dueDateStr) return 50;
  const start = new Date(startDateStr).getTime();
  const end = new Date(dueDateStr).getTime();
  const now = Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 50;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

export function deriveOkrHealthStatus(
  actualProgress: number,
  expectedProgress: number,
  currentStatus: string,
  settings?: Partial<WorkspaceSettings>
): OkrStatus {
  if (currentStatus === 'PAUSED') return 'PAUSED';
  if (actualProgress >= 100 || currentStatus === 'COMPLETED') return 'COMPLETED';
  if (actualProgress === 0 && expectedProgress < 10) return 'NOT_STARTED';
  const onTrackRatio = (Number(settings?.onTrackThreshold) || 85) / 100;
  const atRiskRatio = (Number(settings?.atRiskThreshold) || 60) / 100;
  const exp = Math.max(expectedProgress, 10);
  if (actualProgress >= exp * onTrackRatio) return 'ON_TRACK';
  if (actualProgress >= exp * atRiskRatio) return 'AT_RISK';
  return 'BEHIND';
}

export function recalculateDatabaseScores(stateObj: DatabaseState): DatabaseState {
  const updatedKeyResults = stateObj.keyResults.map((kr) => ({
    ...kr,
    progress: calculateKrProgress(kr),
  }));

  const updatedObjectives = stateObj.objectives.map((obj) => {
    const krs = updatedKeyResults.filter(
      (k) => k.objectiveId === obj.objectiveId && !k.deletedAt
    );
    let progress = obj.progress || 0;
    if (krs.length > 0) {
      const totalW = krs.reduce((s, k) => s + (Number(k.weight) || 1), 0);
      const sumW = krs.reduce(
        (s, k) => s + calculateKrProgress(k) * (Number(k.weight) || 1),
        0
      );
      progress = Math.round((sumW / totalW) * 10) / 10;
    }
    const exp = calculateExpectedProgress(obj.startDate, obj.dueDate);
    const status = deriveOkrHealthStatus(
      progress,
      exp,
      obj.status === 'PAUSED' ? 'PAUSED' : '',
      stateObj.settings
    );
    return { ...obj, progress, status };
  });

  const updatedProjects = stateObj.projects.map((proj) => {
    const linkedTasks = stateObj.tasks.filter(
      (t) => t.projectId === proj.projectId && !t.deletedAt
    );
    if (linkedTasks.length === 0) return proj;
    const doneTasks = linkedTasks.filter((t) => t.status === 'DONE').length;
    const avgTaskProg = Math.round(
      linkedTasks.reduce(
        (sum, t) => sum + (t.status === 'DONE' ? 100 : Number(t.progress) || 0),
        0
      ) / linkedTasks.length
    );
    const status: ProjectStatus =
      doneTasks === linkedTasks.length
        ? 'COMPLETED'
        : proj.status === 'ON_HOLD'
        ? 'ON_HOLD'
        : 'ACTIVE';
    return { ...proj, progress: avgTaskProg, status };
  });

  return {
    ...stateObj,
    keyResults: updatedKeyResults,
    objectives: updatedObjectives,
    projects: updatedProjects,
  };
}

export function formatLocaleDate(dateStr?: string, lang: 'vi' | 'ko' = 'vi'): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'vi-VN');
}

export function formatLocaleNumber(
  num: number | string,
  metricType = 'NUMBER',
  unit = '',
  lang: 'vi' | 'ko' = 'vi'
): string {
  const n = Number(num) || 0;
  const locale = lang === 'ko' ? 'ko-KR' : 'vi-VN';
  if (metricType === 'CURRENCY') return `${n.toLocaleString(locale)} ${unit || 'VND'}`;
  if (metricType === 'BOOLEAN') {
    return n >= 1
      ? lang === 'ko'
        ? '달성 (Yes)'
        : 'Đạt (Yes)'
      : lang === 'ko'
      ? '미달성 (No)'
      : 'Chưa đạt (No)';
  }
  return `${n.toLocaleString(locale)}${unit ? ' ' + unit : ''}`;
}
