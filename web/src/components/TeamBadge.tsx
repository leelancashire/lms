interface TeamBadgeProps {
  shortName: string;
  crestUrl?: string | null;
  size?: number;
  muted?: boolean;
  onClick?: () => void;
}

export default function TeamBadge({ shortName, crestUrl, size = 34, muted = false, onClick }: TeamBadgeProps) {
  const style = { width: size, height: size };
  const cls = `overflow-hidden rounded-full border border-slate-600/70 bg-slate-800 flex items-center justify-center ${
    muted ? "opacity-35" : ""
  } ${onClick ? "cursor-pointer hover:border-cyan-400/70" : ""}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cls}
        style={style}
        aria-label={`View ${shortName} form guide`}
      >
        {crestUrl ? (
          <img src={crestUrl} alt={shortName} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="font-dm text-[11px] font-bold tracking-wide text-slate-100">{shortName.slice(0, 3)}</span>
        )}
      </button>
    );
  }

  return (
    <div className={cls} style={style}>
      {crestUrl ? (
        <img src={crestUrl} alt={shortName} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span className="font-dm text-[11px] font-bold tracking-wide text-slate-100">{shortName.slice(0, 3)}</span>
      )}
    </div>
  );
}
