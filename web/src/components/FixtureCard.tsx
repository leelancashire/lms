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
}

export default function FixtureCard({ fixture, onTeamClick }: FixtureCardProps) {
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
        <span className="font-dm truncate text-sm font-semibold text-slate-100">{fixture.homeTeam.shortName}</span>
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
        <span className="font-dm truncate text-sm font-semibold text-slate-100">{fixture.awayTeam.shortName}</span>
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
