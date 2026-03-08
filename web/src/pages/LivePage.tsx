import { useMemo } from "react";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Skeleton from "../components/Skeleton";
import TeamBadge from "../components/TeamBadge";
import { useLiveScores } from "../api/hooks/useLiveScores";

function OddsRow({ homeOdds, drawOdds, awayOdds }: { homeOdds: number | null; drawOdds: number | null; awayOdds: number | null }) {
  if (homeOdds == null && drawOdds == null && awayOdds == null) return null;

  return (
    <p className="font-dm mt-1 text-[11px] text-slate-500">
      {(homeOdds ?? 0).toFixed(2)} — {(drawOdds ?? 0).toFixed(2)} — {(awayOdds ?? 0).toFixed(2)}
    </p>
  );
}

export default function LivePage() {
  const {
    loading,
    error,
    gameweek,
    liveNow,
    upcoming,
    fullTime,
    expandedFixtureId,
    setExpandedFixtureId,
    eventsByFixture,
    flashingFixtureIds,
    hasSocketActivity,
    reload,
  } = useLiveScores();

  const sortedLive = useMemo(() => [...liveNow].sort((a, b) => new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime()), [liveNow]);

  if (loading) {
    return (
      <main className="page-shell space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell">
        <ErrorState message={error} onRetry={reload} />
      </main>
    );
  }

  return (
    <main className="page-shell space-y-4">
      <header>
        <h1 className="font-outfit text-3xl font-extrabold text-slate-100">Live Scores</h1>
        <p className="font-dm mt-1 text-sm text-slate-400">Gameweek {gameweek ?? "-"}</p>
      </header>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-dm text-xs uppercase tracking-[0.16em] text-slate-500">Live Now</h2>
          {hasSocketActivity ? (
            <span className="inline-flex items-center gap-1 font-dm text-xs text-red-300">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> live
            </span>
          ) : (
            <span className="font-dm text-xs text-slate-500">Scores update every few minutes</span>
          )}
        </div>

        {sortedLive.length === 0 && (
          <EmptyState title="No live matches" description="Scores will appear here as matches start." />
        )}

        <div className="space-y-2">
          {sortedLive.map((fixture) => {
            const expanded = expandedFixtureId === fixture.id;
            const events = eventsByFixture[fixture.id] ?? [];
            return (
              <div
                key={fixture.id}
                className={`rounded-xl border bg-slate-900/60 p-3 transition ${
                  flashingFixtureIds[fixture.id] ? "score-flash border-cyan-400/70" : "border-slate-700"
                }`}
              >
                <button className="w-full" onClick={() => setExpandedFixtureId(expanded ? null : fixture.id)}>
                  <div className="flex items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamBadge shortName={fixture.homeTeam.shortName} crestUrl={fixture.homeTeam.crestUrl} size={30} />
                      <span className="font-dm text-sm font-semibold text-slate-100">{fixture.homeTeam.shortName}</span>
                    </div>
                    <div className="text-center">
                      <p className="font-outfit text-2xl font-bold text-slate-100">
                        {fixture.homeScore ?? 0} - {fixture.awayScore ?? 0}
                      </p>
                      <p className="font-dm text-xs text-red-300">{fixture.minute ? `${fixture.minute}'` : "LIVE"}</p>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 justify-end">
                      <span className="font-dm text-sm font-semibold text-slate-100">{fixture.awayTeam.shortName}</span>
                      <TeamBadge shortName={fixture.awayTeam.shortName} crestUrl={fixture.awayTeam.crestUrl} size={30} />
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="mt-3 space-y-1 rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                    {events.length === 0 ? (
                      <p className="font-dm text-xs text-slate-500">No event data available</p>
                    ) : (
                      events
                        .slice()
                        .sort((a, b) => a.minute - b.minute)
                        .map((event, idx) => (
                          <div
                            key={`${event.type}-${event.minute}-${idx}`}
                            className={`flex items-center gap-2 ${event.teamSide === "away" ? "justify-end text-right" : "justify-start text-left"}`}
                          >
                            <span className="font-dm text-xs text-slate-300">{event.playerName ?? event.type}</span>
                            <span className="font-dm text-[11px] text-slate-500">
                              {event.minute}' · {event.type}
                            </span>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-dm text-xs uppercase tracking-[0.16em] text-slate-500">Upcoming</h2>
        <div className="space-y-2">
          {upcoming.length === 0 && <EmptyState title="No upcoming fixtures" description="Nothing else scheduled in this gameweek." />}
          {upcoming.map((fixture) => (
            <div key={fixture.id} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TeamBadge shortName={fixture.homeTeam.shortName} crestUrl={fixture.homeTeam.crestUrl} size={26} />
                  <span className="font-dm text-sm text-slate-100">{fixture.homeTeam.shortName}</span>
                </div>
                <span className="font-dm text-[11px] text-slate-500">
                  {new Date(fixture.kickoffTime).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-dm text-sm text-slate-100">{fixture.awayTeam.shortName}</span>
                  <TeamBadge shortName={fixture.awayTeam.shortName} crestUrl={fixture.awayTeam.crestUrl} size={26} />
                </div>
              </div>
              <OddsRow homeOdds={fixture.homeOdds} drawOdds={fixture.drawOdds} awayOdds={fixture.awayOdds} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-dm text-xs uppercase tracking-[0.16em] text-slate-500">Full Time</h2>
        <div className="space-y-2">
          {fullTime.length === 0 && <EmptyState title="No final scores yet" description="Finished matches will move here." />}
          {fullTime.map((fixture) => (
            <div key={fixture.id} className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TeamBadge shortName={fixture.homeTeam.shortName} crestUrl={fixture.homeTeam.crestUrl} size={26} />
                  <span className="font-dm text-sm text-slate-100">{fixture.homeTeam.shortName}</span>
                </div>
                <span className="font-outfit text-xl font-extrabold text-slate-100">
                  {fixture.homeScore ?? 0} - {fixture.awayScore ?? 0}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-dm text-sm text-slate-100">{fixture.awayTeam.shortName}</span>
                  <TeamBadge shortName={fixture.awayTeam.shortName} crestUrl={fixture.awayTeam.crestUrl} size={26} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
