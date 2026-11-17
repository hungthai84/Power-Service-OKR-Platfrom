'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy bỏ',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="glass-surface rounded-[12px] max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${
                tone === 'danger'
                  ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
                  : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-[999px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
          {message}
        </p>

        <div className="flex justify-end gap-2.5 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-[999px] text-xs font-bold text-slate-700 dark:text-slate-200 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 rounded-[999px] text-xs font-bold text-white transition-colors ${
              tone === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
