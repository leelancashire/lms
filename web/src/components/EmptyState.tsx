interface EmptyStateProps {
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export default function EmptyState({ title, description, ctaLabel, onCta }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 text-center">
      <p className="font-outfit text-xl font-bold text-slate-100">{title}</p>
      {description && <p className="font-dm mt-1 text-sm text-slate-400">{description}</p>}
      {ctaLabel && onCta && (
        <button onClick={onCta} className="mt-3 rounded-lg bg-[#22D3EE] px-3 py-2 font-dm text-sm font-semibold text-slate-950">
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
