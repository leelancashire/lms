import { ReactNode } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <h3 className="font-outfit text-xl font-bold text-slate-100">{title}</h3>
        <p className="font-dm mt-2 text-sm text-slate-400">{description}</p>
        <div className="mt-5 flex gap-3">
          <button
            className="font-dm flex-1 rounded-lg border border-slate-600 bg-transparent py-2 text-slate-200"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button className="font-dm flex-1 rounded-lg bg-[#22D3EE] py-2 font-semibold text-slate-950" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
