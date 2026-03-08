import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "../client";

export interface LeagueMember {
  id: string;
  user: { id: string; displayName: string; email: string };
  status: "ALIVE" | "ELIMINATED" | "WINNER";
  eliminatedGameweek: number | null;
  joinedAt: string;
  pickCount: number;
}

export interface LeagueDetailPayload {
  league: {
    id: string;
    name: string;
    code: string;
    status: "ACTIVE" | "COMPLETED";
    memberCount: number;
  };
  members: LeagueMember[];
  currentGameweek: {
    gameweek: number;
    deadline: string;
    status: "pre" | "active" | "complete";
  } | null;
}

export interface LeaguePick {
  id: string;
  gameweek: number;
  result: "PENDING" | "WON" | "LOST" | "DRAWN";
  team: {
    id: number;
    name: string;
    shortName: string;
    crestUrl?: string | null;
  };
  user: {
    id: string;
    displayName: string;
    email: string;
  };
}

interface PicksResponse {
  picks: LeaguePick[];
  revealed: boolean;
}

interface PicksMineResponse {
  picks: Array<{ id: string; gameweek: number; teamId: number }>;
}

export function useLeague(initialLeagueId?: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leagueId, setLeagueId] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeagueDetailPayload | null>(null);
  const [currentGameweekPicks, setCurrentGameweekPicks] = useState<PicksResponse | null>(null);
  const [history, setHistory] = useState<Array<{ gameweek: number; picks: LeaguePick[]; revealed: boolean }>>([]);
  const [myCurrentPickExists, setMyCurrentPickExists] = useState<boolean>(false);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => {
    setReloadTick((v) => v + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        let resolvedLeagueId = initialLeagueId;

        if (!resolvedLeagueId || resolvedLeagueId === "default") {
          const leaguesRes = await apiClient.get<{ leagues: Array<{ id: string }> }>("/api/leagues");
          resolvedLeagueId = leaguesRes.data.leagues[0]?.id;
        }

        if (!resolvedLeagueId) {
          throw new Error("No league found. Create or join a league first.");
        }

        const detailRes = await apiClient.get<LeagueDetailPayload>(`/api/leagues/${resolvedLeagueId}`);
        const currentGw = detailRes.data.currentGameweek?.gameweek ?? 1;

        const [currentGwPicksRes, mineRes] = await Promise.all([
          apiClient.get<PicksResponse>(`/api/leagues/${resolvedLeagueId}/picks?gameweek=${currentGw}`),
          apiClient.get<PicksMineResponse>(`/api/leagues/${resolvedLeagueId}/picks/mine`),
        ]);

        const maxGw = currentGw;
        const historyFetches: Array<Promise<{ gameweek: number; data: PicksResponse }>> = [];
        for (let gw = 1; gw <= maxGw; gw += 1) {
          historyFetches.push(
            apiClient
              .get<PicksResponse>(`/api/leagues/${resolvedLeagueId}/picks?gameweek=${gw}`)
              .then((res) => ({ gameweek: gw, data: res.data }))
          );
        }

        const historyRaw = await Promise.all(historyFetches);

        if (!active) return;

        setLeagueId(resolvedLeagueId);
        setDetail(detailRes.data);
        setCurrentGameweekPicks(currentGwPicksRes.data);
        setMyCurrentPickExists(mineRes.data.picks.some((p) => p.gameweek === currentGw));

        const builtHistory = historyRaw
          .map((item) => ({ gameweek: item.gameweek, picks: item.data.picks, revealed: item.data.revealed }))
          .sort((a, b) => b.gameweek - a.gameweek);

        setHistory(builtHistory);
      } catch (err: any) {
        if (!active) return;
        setError(err?.response?.data?.error ?? err?.message ?? "Failed to load league data");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [initialLeagueId, reloadTick]);

  const historyByUser = useMemo(() => {
    const map = new Map<string, LeaguePick[]>();

    for (const gw of history) {
      if (!gw.revealed) continue;
      for (const pick of gw.picks) {
        const arr = map.get(pick.user.id) ?? [];
        arr.push(pick);
        map.set(pick.user.id, arr);
      }
    }

    for (const [k, picks] of map) {
      picks.sort((a, b) => b.gameweek - a.gameweek);
      map.set(k, picks);
    }

    return map;
  }, [history]);

  const currentGameweekPickByUser = useMemo(() => {
    const map = new Map<string, LeaguePick>();
    if (!currentGameweekPicks?.revealed) return map;

    for (const pick of currentGameweekPicks.picks) {
      map.set(pick.user.id, pick);
    }
    return map;
  }, [currentGameweekPicks]);

  return {
    loading,
    error,
    leagueId,
    detail,
    history,
    historyByUser,
    currentGameweekPicks,
    currentGameweekPickByUser,
    myCurrentPickExists,
    reload,
  };
}
