import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import Skeleton from "../components/Skeleton";
import TeamBadge from "../components/TeamBadge";
import PlayerRow from "../components/PlayerRow";
import { useLeague } from "../api/hooks/useLeague";
import { useToast } from "../context/ToastContext";

export default function LeaguePage() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [tab, setTab] = useState<"standings" | "history">("standings");

  const {
    loading,
    error,
    detail,
    history,
    historyByUser,
    currentGameweekPicks,
    currentGameweekPickByUser,
    myCurrentPickExists,
    reload,
  } = useLeague(id);

  async function copyInviteCode() {
    if (!detail?.league.code) return;
    try {
      await navigator.clipboard.writeText(detail.league.code);
      showToast("Invite code copied", "success");
    } catch {
      showToast("Could not copy invite code", "error");
    }
  }

  const aliveMembers = useMemo(
    () => (detail?.members ?? []).filter((m) => m.status === "ALIVE" || m.status === "WINNER"),
    [detail?.members]
  );

  const eliminatedMembers = useMemo(
    () => (detail?.members ?? []).filter((m) => m.status === "ELIMINATED"),
    [detail?.members]
  );

  if (loading) {
    return (
      <main className="page-shell space-y-3">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
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

  if (!detail) {
    return (
      <main className="page-shell">
        <EmptyState title="League not found" description="It may have been removed or you do not have access." />
      </main>
    );
  }

  return (
    <main className="page-shell space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-outfit text-3xl font-extrabold text-slate-100">{detail.league.name}</h1>
          <p className="font-dm mt-1 text-sm text-slate-400">{detail.league.memberCount} players</p>
        </div>
        <button
          onClick={copyInviteCode}
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 font-dm text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300"
        >
          Invite: {detail.league.code}
        </button>
      </header>

      <div className="flex rounded-xl border border-slate-700 bg-slate-900/50 p-1">
        <button
          onClick={() => setTab("standings")}
          className={`flex-1 rounded-lg py-2 font-dm text-sm font-semibold transition ${
            tab === "standings" ? "bg-[#22D3EE] text-slate-950" : "text-slate-400"
          }`}
        >
          Standings
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 rounded-lg py-2 font-dm text-sm font-semibold transition ${
            tab === "history" ? "bg-[#22D3EE] text-slate-950" : "text-slate-400"
          }`}
        >
          History
        </button>
      </div>

      {tab === "standings" ? (
        <section className="space-y-4">
          {!myCurrentPickExists && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 font-dm text-sm text-amber-300">
              ⚠ You haven't picked yet for GW{detail.currentGameweek?.gameweek ?? "?"}!
            </div>
          )}

          <div className="space-y-2">
            <h2 className="font-dm text-xs uppercase tracking-[0.16em] text-emerald-400">● Still Standing ({aliveMembers.length})</h2>
            <div className="space-y-2">
              {aliveMembers.length === 0 && (
                <EmptyState title="No one still standing" description="All players have been eliminated." />
              )}
              {aliveMembers.map((member) => {
                const recent = (historyByUser.get(member.user.id) ?? []).map((p) => p.team);
                const currentPick = currentGameweekPicks?.revealed ? currentGameweekPickByUser.get(member.user.id)?.team : null;
                return (
                  <PlayerRow
                    key={member.id}
                    name={member.user.displayName}
                    status={member.status}
                    picksUsed={member.pickCount}
                    recentTeams={recent}
                    currentPick={currentPick ?? null}
                    eliminatedGameweek={member.eliminatedGameweek}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-dm text-xs uppercase tracking-[0.16em] text-red-400">● Eliminated ({eliminatedMembers.length})</h2>
            <div className="space-y-2">
              {eliminatedMembers.length === 0 && (
                <EmptyState title="No eliminated players yet" description="Everyone is still alive this gameweek." />
              )}
              {eliminatedMembers.map((member) => {
                const recent = (historyByUser.get(member.user.id) ?? []).map((p) => p.team);
                const currentPick = currentGameweekPicks?.revealed ? currentGameweekPickByUser.get(member.user.id)?.team : null;
                return (
                  <PlayerRow
                    key={member.id}
                    name={member.user.displayName}
                    status={member.status}
                    picksUsed={member.pickCount}
                    recentTeams={recent}
                    currentPick={currentPick ?? null}
                    eliminatedGameweek={member.eliminatedGameweek}
                  />
                );
              })}
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          {history.length === 0 && <EmptyState title="No history yet" description="Gameweek picks will appear once rounds are complete." />}
          {history.map((gw) => (
            <div key={gw.gameweek} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-outfit text-lg font-bold text-slate-100">GW {gw.gameweek}</h3>
                {!gw.revealed && <span className="font-dm text-xs text-slate-500">Not revealed yet</span>}
              </div>

              <div className="space-y-2">
                {gw.picks.map((pick) => (
                  <div key={pick.id} className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-950/40 px-2.5 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamBadge shortName={pick.team.shortName} crestUrl={pick.team.crestUrl} size={24} />
                      <span className="font-dm truncate text-sm text-slate-200">{pick.user.displayName}</span>
                      <span className="font-dm text-xs text-slate-500">{pick.team.shortName}</span>
                    </div>
                    <span
                      className={`font-dm text-sm font-bold ${
                        pick.result === "WON"
                          ? "text-emerald-400"
                          : pick.result === "LOST" || pick.result === "DRAWN"
                            ? "text-red-400"
                            : "text-slate-500"
                      }`}
                    >
                      {pick.result === "WON" ? "✓" : pick.result === "LOST" || pick.result === "DRAWN" ? "✗" : "•"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
