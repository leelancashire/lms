import TeamBadge from "./TeamBadge";

interface Team {
  id: number;
  name: string;
  shortName: string;
  crestUrl?: string | null;
}

interface FixtureCardProps {
  fixture: {
    id: string;
    kickoffTime: string;
    status: string;
    homeScore?: number | null;
    awayScore?: number | null;
    homeTeam: Team;
    awayTeam: Team;
  };
  onTeamClick?: (team: Team) => void;
  formStripByTeam?: Record<number, Array<"W" | "D" | "L" | "P">>;
}

function resultCls(result: "W" | "D" | "L" | "P") {
  if (result === "W") return "bg-emerald-500/20 text-emerald-300";
  if (result === "D") return "bg-amber-500/20 text-amber-300";
  if (result === "L") return "bg-red-500/20 text-red-300";
  return "bg-slate-600/20 text-slate-300";
}

export default function FixtureCard({ fixture, onTeamClick, formStripByTeam }: FixtureCardProps) {
  const kickoff = new Date(fixture.kickoffTime);
  const kickoffText = kickoff.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });

  const isLive = fixture.status === "LIVE";
  const isDone = fixture.status === "FINISHED";
  const isPostponed = fixture.status === "POSTPONED";

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TeamBadge
          shortName={fixture.homeTeam.shortName}
          crestUrl={fixture.homeTeam.crestUrl}
          size={30}
          onClick={onTeamClick ? () => onTeamClick(fixture.homeTeam) : undefined}
        />
        <div className="min-w-0">
          <span className="font-dm block truncate text-sm font-semibold text-slate-100">{fixture.homeTeam.shortName}</span>
          {formStripByTeam?.[fixture.homeTeam.id]?.length ? (
            <div className="mt-0.5 flex gap-1">
              {formStripByTeam[fixture.homeTeam.id].slice(0, 5).map((r, idx) => (
                <span key={`${fixture.homeTeam.id}-${idx}`} className={`rounded px-1 py-0.5 font-dm text-[9px] ${resultCls(r)}`}>
                  {r}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-2 text-center">
        {isPostponed ? (
          <p className="font-dm text-[11px] rounded bg-amber-500/20 px-2 py-0.5 text-amber-300">Postponed</p>
        ) : isLive || isDone ? (
          <p className="font-outfit text-sm font-bold text-slate-100">
            {fixture.homeScore ?? 0} - {fixture.awayScore ?? 0}
          </p>
        ) : (
          <p className="font-dm text-[11px] text-slate-400">{kickoffText}</p>
        )}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <div className="min-w-0 text-right">
          <span className="font-dm block truncate text-sm font-semibold text-slate-100">{fixture.awayTeam.shortName}</span>
          {formStripByTeam?.[fixture.awayTeam.id]?.length ? (
            <div className="mt-0.5 flex justify-end gap-1">
              {formStripByTeam[fixture.awayTeam.id].slice(0, 5).map((r, idx) => (
                <span key={`${fixture.awayTeam.id}-${idx}`} className={`rounded px-1 py-0.5 font-dm text-[9px] ${resultCls(r)}`}>
                  {r}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <TeamBadge
          shortName={fixture.awayTeam.shortName}
          crestUrl={fixture.awayTeam.crestUrl}
          size={30}
          onClick={onTeamClick ? () => onTeamClick(fixture.awayTeam) : undefined}
        />
      </div>
    </div>
  );
}
