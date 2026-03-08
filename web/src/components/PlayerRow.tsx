import TeamBadge from "./TeamBadge";

interface TeamLite {
  id: number;
  shortName: string;
  crestUrl?: string | null;
}

interface PlayerRowProps {
  name: string;
  status: "ALIVE" | "ELIMINATED" | "WINNER";
  picksUsed: number;
  recentTeams: TeamLite[];
  currentPick?: TeamLite | null;
  eliminatedGameweek?: number | null;
}

export default function PlayerRow({
  name,
  status,
  picksUsed,
  recentTeams,
  currentPick,
  eliminatedGameweek,
}: PlayerRowProps) {
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        status === "ELIMINATED" ? "border-red-800/40 bg-slate-900/30 opacity-60" : "border-slate-700/80 bg-slate-900/60"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700/80 font-outfit text-sm font-bold text-slate-100">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="font-dm truncate text-sm font-semibold text-slate-100">{name}</p>
            <p className="font-dm text-xs text-slate-500">Picks used: {picksUsed}</p>
          </div>
        </div>

        {status === "ALIVE" ? (
          <span className="font-dm rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-emerald-300">
            IN
          </span>
        ) : status === "WINNER" ? (
          <span className="font-dm rounded-full border border-cyan-500/40 bg-cyan-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-cyan-300">
            WINNER
          </span>
        ) : (
          <span className="font-dm rounded-full border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-red-300">
            OUT {eliminatedGameweek ? `GW${eliminatedGameweek}` : ""}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        {recentTeams.length === 0 && <span className="font-dm text-xs text-slate-500">No revealed history</span>}
        {recentTeams.slice(0, 3).map((team) => (
          <TeamBadge key={`${team.id}-${team.shortName}`} shortName={team.shortName} crestUrl={team.crestUrl} size={22} muted={status === "ELIMINATED"} />
        ))}
      </div>

      {currentPick && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="font-dm text-[10px] uppercase tracking-[0.12em] text-slate-500">Current:</span>
          <TeamBadge shortName={currentPick.shortName} crestUrl={currentPick.crestUrl} size={20} muted={status === "ELIMINATED"} />
          <span className="font-dm text-xs text-slate-300">{currentPick.shortName}</span>
        </div>
      )}
    </div>
  );
}
