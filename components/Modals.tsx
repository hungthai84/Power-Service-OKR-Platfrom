'use client';

import React from 'react';
import { X, Upload, ExternalLink } from 'lucide-react';
import { calculateKrProgress, formatLocaleDate, formatLocaleNumber } from '@/lib/okr-engine';
import type {
  DatabaseState,
  KeyResult,
  Lang,
  Objective,
  OkrStatus,
  ProjectItem,
  TaskItem,
} from '@/types/okr';

export interface ObjectiveFormState {
  objectiveId: string;
  version: number;
  titleVi: string;
  titleKo: string;
  descriptionVi: string;
  descriptionKo: string;
  cycleId: string;
  level: string;
  departmentId: string;
  ownerId: string;
  parentObjectiveId: string;
  weight: number;
  startDate: string;
  dueDate: string;
  initKrTitle: string;
  initKrTarget: string | number;
  initKrUnit: string;
}

export interface CheckInFormState {
  open: boolean;
  kr: KeyResult | null;
  currentValue: number | string;
  confidence: number | string;
  status: OkrStatus;
  winsVi: string;
  winsKo: string;
  blockersVi: string;
  nextStepsVi: string;
  evidenceUrl: string;
}

interface ModalsProps {
  lang: Lang;
  db: DatabaseState;
  getRawLocalized: (obj: Record<string, unknown> | unknown, prefix: string) => string;
  renderStatusBadge: (status: string) => React.ReactNode;

  okrModal: { open: boolean; data: ObjectiveFormState | null };
  setOkrModal: React.Dispatch<React.SetStateAction<{ open: boolean; data: ObjectiveFormState | null }>>;
  onSaveOkr: (e: React.FormEvent) => void;

  krModal: { open: boolean; data: Partial<KeyResult> | null };
  setKrModal: React.Dispatch<React.SetStateAction<{ open: boolean; data: Partial<KeyResult> | null }>>;
  onSaveKr: (e: React.FormEvent) => void;

  projectModal: { open: boolean; data: Partial<ProjectItem> | null };
  setProjectModal: React.Dispatch<React.SetStateAction<{ open: boolean; data: Partial<ProjectItem> | null }>>;
  onSaveProject: (e: React.FormEvent) => void;

  taskModal: { open: boolean; data: Partial<TaskItem> | null };
  setTaskModal: React.Dispatch<React.SetStateAction<{ open: boolean; data: Partial<TaskItem> | null }>>;
  onSaveTask: (e: React.FormEvent) => void;

  checkinModal: CheckInFormState;
  setCheckinModal: React.Dispatch<React.SetStateAction<CheckInFormState>>;
  onSaveCheckIn: (e: React.FormEvent) => void;
  onUploadEvidenceToDrive: (file: File) => Promise<string | null>;

  detailObj: Objective | null;
  onCloseDetail: () => void;
  detailCommentInput: string;
  setDetailCommentInput: (val: string) => void;
  onAddComment: (e: React.FormEvent, objectiveId: string) => void;
  onOpenKrFromDetail: (objectiveId: string) => void;
  onOpenCheckInFromDetail: (kr: KeyResult) => void;
}

const inputCls =
  'w-full px-3 py-2 rounded-[12px] bg-white/85 dark:bg-slate-800/85 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500';
const labelCls = 'block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1';
const modalWrapCls =
  'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs';
const modalBoxCls =
  'glass-surface rounded-[12px] max-w-2xl w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto';

export default function Modals({
  lang,
  db,
  getRawLocalized,
  renderStatusBadge,
  okrModal,
  setOkrModal,
  onSaveOkr,
  krModal,
  setKrModal,
  onSaveKr,
  projectModal,
  setProjectModal,
  onSaveProject,
  taskModal,
  setTaskModal,
  onSaveTask,
  checkinModal,
  setCheckinModal,
  onSaveCheckIn,
  onUploadEvidenceToDrive,
  detailObj,
  onCloseDetail,
  detailCommentInput,
  setDetailCommentInput,
  onAddComment,
  onOpenKrFromDetail,
  onOpenCheckInFromDetail,
}: ModalsProps) {
  return (
    <>
      {/* 1. Objective Modal */}
      {okrModal.open && okrModal.data && (
        <div className={modalWrapCls} role="dialog" aria-modal="true">
          <div className={modalBoxCls}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                {okrModal.data.objectiveId ? 'Chỉnh sửa Mục Tiêu (Objective)' : 'Tạo Mục Tiêu (Objective)'}
              </h3>
              <button
                type="button"
                onClick={() => setOkrModal({ open: false, data: null })}
                className="p-2 rounded-[999px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={onSaveOkr} className="space-y-3.5 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tiêu đề Tiếng Việt *</label>
                  <input
                    required
                    value={okrModal.data.titleVi}
                    onChange={(e) =>
                      setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, titleVi: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tiêu đề Tiếng Hàn (KO)</label>
                  <input
                    value={okrModal.data.titleKo}
                    onChange={(e) =>
                      setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, titleKo: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Mô tả chi tiết</label>
                <textarea
                  rows={2}
                  value={okrModal.data.descriptionVi}
                  onChange={(e) =>
                    setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, descriptionVi: e.target.value } } : p))
                  }
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={labelCls}>Chu kỳ</label>
                  <select
                    value={okrModal.data.cycleId}
                    onChange={(e) =>
                      setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, cycleId: e.target.value } } : p))
                    }
                    className={inputCls}
                  >
                    {db.cycles.map((c) => (
                      <option key={c.cycleId} value={c.cycleId}>
                        {getRawLocalized(c, 'name')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Cấp độ</label>
                  <select
                    value={okrModal.data.level}
                    onChange={(e) =>
                      setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, level: e.target.value } } : p))
                    }
                    className={inputCls}
                  >
                    <option value="Company">Company</option>
                    <option value="Division">Division</option>
                    <option value="Department">Department</option>
                    <option value="Team">Team</option>
                    <option value="Individual">Individual</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Phòng ban</label>
                  <select
                    value={okrModal.data.departmentId}
                    onChange={(e) =>
                      setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, departmentId: e.target.value } } : p))
                    }
                    className={inputCls}
                  >
                    {db.departments
                      .filter((d) => d.status !== 'DELETED')
                      .map((d) => (
                        <option key={d.departmentId} value={d.departmentId}>
                          {getRawLocalized(d, 'name')}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Objective Cha</label>
                  <select
                    value={okrModal.data.parentObjectiveId}
                    onChange={(e) =>
                      setOkrModal((p) =>
                        p.data ? { ...p, data: { ...p.data, parentObjectiveId: e.target.value } } : p
                      )
                    }
                    className={inputCls}
                  >
                    <option value="">-- Mục tiêu gốc --</option>
                    {db.objectives
                      .filter((o) => !o.deletedAt && o.objectiveId !== okrModal.data?.objectiveId)
                      .map((o) => (
                        <option key={o.objectiveId} value={o.objectiveId}>
                          {getRawLocalized(o, 'title')}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={okrModal.data.startDate}
                    onChange={(e) =>
                      setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, startDate: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Hạn chót (Due date)</label>
                  <input
                    type="date"
                    value={okrModal.data.dueDate}
                    onChange={(e) =>
                      setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, dueDate: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Trọng số (%)</label>
                  <input
                    type="number"
                    value={okrModal.data.weight}
                    onChange={(e) =>
                      setOkrModal((p) =>
                        p.data ? { ...p, data: { ...p.data, weight: Number(e.target.value) } } : p
                      )
                    }
                    className={inputCls}
                  />
                </div>
              </div>

              {!okrModal.data.objectiveId && (
                <div className="p-3.5 rounded-[12px] bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900 space-y-2">
                  <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                    Kết quả then chốt đầu tiên (Tùy chọn tạo kèm)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <input
                      value={okrModal.data.initKrTitle}
                      onChange={(e) =>
                        setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, initKrTitle: e.target.value } } : p))
                      }
                      placeholder="Tên KR tiêu biểu..."
                      className={`sm:col-span-2 ${inputCls}`}
                    />
                    <input
                      type="number"
                      value={okrModal.data.initKrTarget}
                      onChange={(e) =>
                        setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, initKrTarget: e.target.value } } : p))
                      }
                      placeholder="Target (100)"
                      className={inputCls}
                    />
                    <input
                      value={okrModal.data.initKrUnit}
                      onChange={(e) =>
                        setOkrModal((p) => (p.data ? { ...p, data: { ...p.data, initKrUnit: e.target.value } } : p))
                      }
                      placeholder="Đơn vị (%)"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOkrModal({ open: false, data: null })}
                  className="px-4 py-2 rounded-[999px] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-[999px] text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  Lưu & Đồng bộ Google Sheets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Key Result Modal */}
      {krModal.open && krModal.data && (
        <div className={modalWrapCls} role="dialog" aria-modal="true">
          <div className={modalBoxCls}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                Thiết lập Kết quả then chốt (Key Result)
              </h3>
              <button
                type="button"
                onClick={() => setKrModal({ open: false, data: null })}
                className="p-2 rounded-[999px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={onSaveKr} className="space-y-3.5 mt-4">
              <div>
                <label className={labelCls}>Thuộc Mục tiêu (Objective) *</label>
                <select
                  required
                  value={krModal.data.objectiveId || ''}
                  onChange={(e) =>
                    setKrModal((p) => (p.data ? { ...p, data: { ...p.data, objectiveId: e.target.value } } : p))
                  }
                  className={inputCls}
                >
                  {db.objectives
                    .filter((o) => !o.deletedAt)
                    .map((o) => (
                      <option key={o.objectiveId} value={o.objectiveId}>
                        {getRawLocalized(o, 'title')}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tên KR Tiếng Việt *</label>
                  <input
                    required
                    value={krModal.data.titleVi || ''}
                    onChange={(e) =>
                      setKrModal((p) => (p.data ? { ...p, data: { ...p.data, titleVi: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tên KR Tiếng Hàn (KO)</label>
                  <input
                    value={krModal.data.titleKo || ''}
                    onChange={(e) =>
                      setKrModal((p) => (p.data ? { ...p, data: { ...p.data, titleKo: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={labelCls}>Kiểu đo lường</label>
                  <select
                    value={krModal.data.metricType || 'NUMBER'}
                    onChange={(e) =>
                      setKrModal((p) =>
                        p.data
                          ? { ...p, data: { ...p.data, metricType: e.target.value as KeyResult['metricType'] } }
                          : p
                      )
                    }
                    className={inputCls}
                  >
                    <option value="NUMBER">Number</option>
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="CURRENCY">Currency</option>
                    <option value="BOOLEAN">Boolean</option>
                    <option value="MILESTONE">Milestone</option>
                    <option value="RANGE">Range</option>
                    <option value="MANUAL">Manual</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Chiều hướng</label>
                  <select
                    value={krModal.data.direction || 'INCREASE'}
                    onChange={(e) =>
                      setKrModal((p) =>
                        p.data
                          ? { ...p, data: { ...p.data, direction: e.target.value as KeyResult['direction'] } }
                          : p
                      )
                    }
                    className={inputCls}
                  >
                    <option value="INCREASE">Increase</option>
                    <option value="DECREASE">Decrease</option>
                    <option value="MAINTAIN">Maintain</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Đơn vị</label>
                  <input
                    value={krModal.data.unit || ''}
                    onChange={(e) =>
                      setKrModal((p) => (p.data ? { ...p, data: { ...p.data, unit: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Trọng số</label>
                  <input
                    type="number"
                    step="0.1"
                    value={krModal.data.weight ?? 1}
                    onChange={(e) =>
                      setKrModal((p) =>
                        p.data ? { ...p, data: { ...p.data, weight: Number(e.target.value) } } : p
                      )
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Baseline</label>
                  <input
                    type="number"
                    step="any"
                    value={krModal.data.baselineValue ?? 0}
                    onChange={(e) =>
                      setKrModal((p) =>
                        p.data ? { ...p, data: { ...p.data, baselineValue: Number(e.target.value) } } : p
                      )
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Giá trị hiện tại</label>
                  <input
                    type="number"
                    step="any"
                    value={krModal.data.currentValue ?? 0}
                    onChange={(e) =>
                      setKrModal((p) =>
                        p.data ? { ...p, data: { ...p.data, currentValue: Number(e.target.value) } } : p
                      )
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Mục tiêu (Target) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={krModal.data.targetValue ?? 100}
                    onChange={(e) =>
                      setKrModal((p) =>
                        p.data ? { ...p, data: { ...p.data, targetValue: Number(e.target.value) } } : p
                      )
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setKrModal({ open: false, data: null })}
                  className="px-4 py-2 rounded-[999px] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[999px] text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Lưu Key Result
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Project Modal */}
      {projectModal.open && projectModal.data && (
        <div className={modalWrapCls} role="dialog" aria-modal="true">
          <div className={modalBoxCls}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                {projectModal.data.projectId ? 'Chỉnh sửa Dự án (Project)' : 'Tạo Dự án mới (Project)'}
              </h3>
              <button
                type="button"
                onClick={() => setProjectModal({ open: false, data: null })}
                className="p-2 rounded-[999px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={onSaveProject} className="space-y-3.5 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tên Dự án (VI) *</label>
                  <input
                    required
                    value={projectModal.data.nameVi || ''}
                    onChange={(e) =>
                      setProjectModal((p) => (p.data ? { ...p, data: { ...p.data, nameVi: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tên Dự án (KO)</label>
                  <input
                    value={projectModal.data.nameKo || ''}
                    onChange={(e) =>
                      setProjectModal((p) => (p.data ? { ...p, data: { ...p.data, nameKo: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Mô tả phạm vi dự án</label>
                <textarea
                  rows={2}
                  value={projectModal.data.descriptionVi || ''}
                  onChange={(e) =>
                    setProjectModal((p) => (p.data ? { ...p, data: { ...p.data, descriptionVi: e.target.value } } : p))
                  }
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Liên kết Objective OKR</label>
                  <select
                    value={projectModal.data.objectiveId || ''}
                    onChange={(e) =>
                      setProjectModal((p) => (p.data ? { ...p, data: { ...p.data, objectiveId: e.target.value } } : p))
                    }
                    className={inputCls}
                  >
                    <option value="">-- Độc lập --</option>
                    {db.objectives
                      .filter((o) => !o.deletedAt)
                      .map((o) => (
                        <option key={o.objectiveId} value={o.objectiveId}>
                          {getRawLocalized(o, 'title')}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Phòng ban</label>
                  <select
                    value={projectModal.data.departmentId || ''}
                    onChange={(e) =>
                      setProjectModal((p) =>
                        p.data ? { ...p, data: { ...p.data, departmentId: e.target.value } } : p
                      )
                    }
                    className={inputCls}
                  >
                    {db.departments
                      .filter((d) => d.status !== 'DELETED')
                      .map((d) => (
                        <option key={d.departmentId} value={d.departmentId}>
                          {getRawLocalized(d, 'name')}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Trạng thái</label>
                  <select
                    value={projectModal.data.status || 'ACTIVE'}
                    onChange={(e) =>
                      setProjectModal((p) =>
                        p.data
                          ? { ...p, data: { ...p.data, status: e.target.value as ProjectItem['status'] } }
                          : p
                      )
                    }
                    className={inputCls}
                  >
                    <option value="PLANNING">Planning</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={labelCls}>Ưu tiên</label>
                  <select
                    value={projectModal.data.priority || 'MEDIUM'}
                    onChange={(e) =>
                      setProjectModal((p) =>
                        p.data
                          ? { ...p, data: { ...p.data, priority: e.target.value as ProjectItem['priority'] } }
                          : p
                      )
                    }
                    className={inputCls}
                  >
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Ngân sách</label>
                  <input
                    type="number"
                    value={projectModal.data.budget ?? 0}
                    onChange={(e) =>
                      setProjectModal((p) =>
                        p.data ? { ...p, data: { ...p.data, budget: Number(e.target.value) } } : p
                      )
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={projectModal.data.startDate || ''}
                    onChange={(e) =>
                      setProjectModal((p) => (p.data ? { ...p, data: { ...p.data, startDate: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Hạn hoàn thành</label>
                  <input
                    type="date"
                    value={projectModal.data.dueDate || ''}
                    onChange={(e) =>
                      setProjectModal((p) => (p.data ? { ...p, data: { ...p.data, dueDate: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Liên kết tài liệu Google Drive (tùy chọn)</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={projectModal.data.driveLink || ''}
                  onChange={(e) =>
                    setProjectModal((p) => (p.data ? { ...p, data: { ...p.data, driveLink: e.target.value } } : p))
                  }
                  className={inputCls}
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setProjectModal({ open: false, data: null })}
                  className="px-4 py-2 rounded-[999px] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[999px] text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Lưu Dự án
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Task Modal */}
      {taskModal.open && taskModal.data && (
        <div className={modalWrapCls} role="dialog" aria-modal="true">
          <div className="glass-surface rounded-[12px] max-w-lg w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                {taskModal.data.taskId ? 'Chỉnh sửa Công việc (Task)' : 'Tạo Công việc mới (Task)'}
              </h3>
              <button
                type="button"
                onClick={() => setTaskModal({ open: false, data: null })}
                className="p-2 rounded-[999px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={onSaveTask} className="space-y-3.5 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tên công việc (VI) *</label>
                  <input
                    required
                    value={taskModal.data.titleVi || ''}
                    onChange={(e) =>
                      setTaskModal((p) => (p.data ? { ...p, data: { ...p.data, titleVi: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Tên công việc (KO)</label>
                  <input
                    value={taskModal.data.titleKo || ''}
                    onChange={(e) =>
                      setTaskModal((p) => (p.data ? { ...p, data: { ...p.data, titleKo: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Thuộc Dự án (Project)</label>
                  <select
                    value={taskModal.data.projectId || ''}
                    onChange={(e) =>
                      setTaskModal((p) => (p.data ? { ...p, data: { ...p.data, projectId: e.target.value } } : p))
                    }
                    className={inputCls}
                  >
                    <option value="">-- Công việc chung --</option>
                    {db.projects
                      .filter((pr) => !pr.deletedAt)
                      .map((pr) => (
                        <option key={pr.projectId} value={pr.projectId}>
                          {getRawLocalized(pr, 'name')}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Liên kết Objective OKR</label>
                  <select
                    value={taskModal.data.objectiveId || ''}
                    onChange={(e) =>
                      setTaskModal((p) => (p.data ? { ...p, data: { ...p.data, objectiveId: e.target.value } } : p))
                    }
                    className={inputCls}
                  >
                    <option value="">-- Không gắn OKR --</option>
                    {db.objectives
                      .filter((o) => !o.deletedAt)
                      .map((o) => (
                        <option key={o.objectiveId} value={o.objectiveId}>
                          {getRawLocalized(o, 'title')}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Ưu tiên</label>
                  <select
                    value={taskModal.data.priority || 'MEDIUM'}
                    onChange={(e) =>
                      setTaskModal((p) =>
                        p.data
                          ? { ...p, data: { ...p.data, priority: e.target.value as TaskItem['priority'] } }
                          : p
                      )
                    }
                    className={inputCls}
                  >
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Trạng thái</label>
                  <select
                    value={taskModal.data.status || 'TO_DO'}
                    onChange={(e) =>
                      setTaskModal((p) =>
                        p.data ? { ...p, data: { ...p.data, status: e.target.value as TaskItem['status'] } } : p
                      )
                    }
                    className={inputCls}
                  >
                    <option value="BACKLOG">Backlog</option>
                    <option value="TO_DO">To Do</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="REVIEW">Review</option>
                    <option value="DONE">Done</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Deadline</label>
                  <input
                    type="date"
                    value={taskModal.data.dueDate || ''}
                    onChange={(e) =>
                      setTaskModal((p) => (p.data ? { ...p, data: { ...p.data, dueDate: e.target.value } } : p))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTaskModal({ open: false, data: null })}
                  className="px-4 py-2 rounded-[999px] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[999px] text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Lưu Công việc
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Check-in Modal */}
      {checkinModal.open && checkinModal.kr && (
        <div className={modalWrapCls} role="dialog" aria-modal="true">
          <div className="glass-surface rounded-[12px] max-w-xl w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="min-w-0 pr-3">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Check-in Tiến độ Key Result
                </h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mt-0.5 truncate">
                  {getRawLocalized(checkinModal.kr, 'title')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckinModal((p) => ({ ...p, open: false }))}
                className="p-2 rounded-[999px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={onSaveCheckIn} className="space-y-3.5 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-[12px] bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Baseline → Target
                  </label>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
                    {checkinModal.kr.baselineValue} → {checkinModal.kr.targetValue} {checkinModal.kr.unit}
                  </p>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Giá trị hiện tại *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={checkinModal.currentValue}
                    onChange={(e) => setCheckinModal((p) => ({ ...p, currentValue: e.target.value }))}
                    className={`${inputCls} mt-0.5 tabular-nums`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    Tiến độ tính toán
                  </label>
                  <p className="text-base font-bold text-indigo-700 dark:text-indigo-400 mt-0.5 tabular-nums">
                    {calculateKrProgress({ ...checkinModal.kr, currentValue: Number(checkinModal.currentValue) })}%
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Mức độ tự tin (1-10)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={checkinModal.confidence}
                    onChange={(e) => setCheckinModal((p) => ({ ...p, confidence: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Trạng thái đánh giá</label>
                  <select
                    value={checkinModal.status}
                    onChange={(e) => setCheckinModal((p) => ({ ...p, status: e.target.value as OkrStatus }))}
                    className={inputCls}
                  >
                    <option value="ON_TRACK">On Track</option>
                    <option value="AT_RISK">At Risk</option>
                    <option value="BEHIND">Behind</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Kết quả đạt được (Wins - VI) *</label>
                  <textarea
                    rows={2}
                    required
                    value={checkinModal.winsVi}
                    onChange={(e) => setCheckinModal((p) => ({ ...p, winsVi: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>성과 요약 (Wins - KO)</label>
                  <textarea
                    rows={2}
                    value={checkinModal.winsKo}
                    onChange={(e) => setCheckinModal((p) => ({ ...p, winsKo: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Khó khăn / Rào cản (Blockers)</label>
                  <textarea
                    rows={2}
                    value={checkinModal.blockersVi}
                    onChange={(e) => setCheckinModal((p) => ({ ...p, blockersVi: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Kế hoạch tiếp theo (Next Steps)</label>
                  <textarea
                    rows={2}
                    value={checkinModal.nextStepsVi}
                    onChange={(e) => setCheckinModal((p) => ({ ...p, nextStepsVi: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Tài liệu minh chứng (Google Drive link hoặc tải tệp lên Drive)</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={checkinModal.evidenceUrl}
                    onChange={(e) => setCheckinModal((p) => ({ ...p, evidenceUrl: e.target.value }))}
                    className={`flex-1 ${inputCls}`}
                  />
                  <label className="px-4 py-2 rounded-[999px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer flex items-center justify-center gap-1.5 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Tải lên Drive</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await onUploadEvidenceToDrive(file);
                        if (url) {
                          setCheckinModal((p) => ({ ...p, evidenceUrl: url }));
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCheckinModal((p) => ({ ...p, open: false }))}
                  className="px-4 py-2 rounded-[999px] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[999px] text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  Ghi nhận Check-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Objective Detail & Comments Modal */}
      {detailObj && (
        <div className={modalWrapCls} role="dialog" aria-modal="true">
          <div className="glass-surface rounded-[12px] max-w-3xl w-full p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 break-words">
                {getRawLocalized(detailObj, 'title')}
              </h3>
              <button
                type="button"
                onClick={onCloseDetail}
                className="p-2 rounded-[999px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-[12px] bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-indigo-700 dark:text-indigo-400">{detailObj.level}</span>
                  <span>·</span>
                  {renderStatusBadge(detailObj.status)}
                </div>
                <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                  {detailObj.progress || 0}%
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 break-words">
                {getRawLocalized(detailObj, 'description') || 'Chưa có mô tả chi tiết.'}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  Kết quả then chốt (Key Results)
                </h4>
                <button
                  type="button"
                  onClick={() => onOpenKrFromDetail(detailObj.objectiveId)}
                  className="px-3 py-1 rounded-[999px] bg-indigo-50 dark:bg-indigo-950/60 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                >
                  + Thêm Key Result
                </button>
              </div>
              {db.keyResults
                .filter((k) => k.objectiveId === detailObj.objectiveId && !k.deletedAt)
                .map((kr) => (
                  <div
                    key={kr.krId}
                    className="p-3 rounded-[12px] bg-white/75 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 break-words">
                        {getRawLocalized(kr, 'title')}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                        {formatLocaleNumber(kr.currentValue, kr.metricType, kr.unit, lang)} /{' '}
                        {formatLocaleNumber(kr.targetValue, kr.metricType, kr.unit, lang)} ({kr.progress || 0}%)
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenCheckInFromDetail(kr)}
                      className="px-3.5 py-1.5 rounded-[999px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
                    >
                      Check-in
                    </button>
                  </div>
                ))}
            </div>

            {/* Linked Projects */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">Dự án liên kết (Projects)</h4>
              {db.projects.filter((p) => p.objectiveId === detailObj.objectiveId && !p.deletedAt).length === 0 ? (
                <p className="text-xs text-slate-500">Chưa có dự án liên kết với mục tiêu này.</p>
              ) : (
                db.projects
                  .filter((p) => p.objectiveId === detailObj.objectiveId && !p.deletedAt)
                  .map((proj) => (
                    <div
                      key={proj.projectId}
                      className="p-3 rounded-[12px] bg-white/75 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {getRawLocalized(proj, 'name')}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {proj.status} · {proj.progress}%
                        </p>
                      </div>
                      {proj.driveLink && (
                        <a
                          href={proj.driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 rounded-[999px] bg-indigo-50 dark:bg-indigo-950/60 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 shrink-0"
                        >
                          <span>Drive</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400">Thảo luận & Bình luận</h4>
              <form onSubmit={(e) => onAddComment(e, detailObj.objectiveId)} className="flex gap-2">
                <input
                  value={detailCommentInput}
                  onChange={(e) => setDetailCommentInput(e.target.value)}
                  required
                  placeholder="Nhập nội dung trao đổi..."
                  className={`flex-1 ${inputCls}`}
                />
                <button
                  type="submit"
                  className="px-5 py-2 rounded-[999px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
                >
                  Gửi
                </button>
              </form>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {db.comments
                  .filter((c) => c.entityId === detailObj.objectiveId)
                  .map((c) => (
                    <div
                      key={c.commentId}
                      className="p-2.5 rounded-[12px] bg-white/75 dark:bg-slate-800/75 border border-slate-200/80 dark:border-slate-700 text-xs"
                    >
                      <p className="text-slate-800 dark:text-slate-200 break-words">{c.bodyVi}</p>
                      <span className="text-[10px] text-slate-400">
                        {c.userId} · {formatLocaleDate(c.createdAt, lang)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
