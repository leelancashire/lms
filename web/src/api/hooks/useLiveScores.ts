import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../client";
import { useAuth } from "../../context/AuthContext";
import { disconnectSocket, getSocket } from "../../lib/socket";

interface TeamLite {
  id: number;
  name: string;
  shortName: string;
  crestUrl?: string | null;
}

export interface LiveFixture {
  id: string;
  gameweek: number;
  kickoffTime: string;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";
  minute: number | null;
  homeScore: number | null;
  awayScore: number | null;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
  homeTeam: TeamLite;
  awayTeam: TeamLite;
}

interface MatchEvent {
  id?: string;
  fixtureId: string;
  type: string;
  minute: number;
  teamSide: "home" | "away";
  playerName?: string | null;
  detail?: string | null;
}

interface ScoreUpdatePayload {
  fixtureId: string;
  homeScore: number | null;
  awayScore: number | null;
  minute: number | null;
  status: LiveFixture["status"];
}

interface MatchEventPayload {
  fixtureId: string;
  type: string;
  minute: number;
  teamSide: "home" | "away";
  playerName?: string;
  detail?: string;
}

export function useLiveScores() {
  const { accessToken } = useAuth();

  const [gameweek, setGameweek] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<LiveFixture[]>([]);
  const [eventsByFixture, setEventsByFixture] = useState<Record<string, MatchEvent[]>>({});
  const [expandedFixtureId, setExpandedFixtureId] = useState<string | null>(null);
  const [flashingFixtureIds, setFlashingFixtureIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasSocketActivity, setHasSocketActivity] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const flashTimers = useRef<Record<string, number>>({});

  const flashFixture = useCallback((fixtureId: string) => {
    setFlashingFixtureIds((prev) => ({ ...prev, [fixtureId]: true }));
    if (flashTimers.current[fixtureId]) window.clearTimeout(flashTimers.current[fixtureId]);
    flashTimers.current[fixtureId] = window.setTimeout(() => {
      setFlashingFixtureIds((prev) => ({ ...prev, [fixtureId]: false }));
    }, 900);
  }, []);

  const loadFixtureEvents = useCallback(async (fixtureId: string) => {
    const res = await apiClient.get<{ fixtureId: string; events: MatchEvent[] }>(`/api/fixtures/${fixtureId}/events`);
    setEventsByFixture((prev) => ({ ...prev, [fixtureId]: res.data.events }));
  }, []);

  const refreshFixtures = useCallback(async (gw: number) => {
    const res = await apiClient.get<{ fixtures: LiveFixture[] }>(`/api/fixtures?gameweek=${gw}`);
    setFixtures(res.data.fixtures);
  }, []);

  const reload = useCallback(() => {
    setReloadTick((v) => v + 1);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const gwRes = await apiClient.get<{ gameweek: number }>("/api/fixtures/current-gameweek");
        if (!active) return;
        setGameweek(gwRes.data.gameweek);
        await refreshFixtures(gwRes.data.gameweek);
      } catch (err: any) {
        if (!active) return;
        setError(err?.response?.data?.error ?? "Failed to load live scores");
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [refreshFixtures, reloadTick]);

  // 5-minute DB fallback polling (works even without API-Football)
  useEffect(() => {
    if (!gameweek) return;

    const intervalId = window.setInterval(() => {
      void refreshFixtures(gameweek);
    }, 5 * 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [gameweek, refreshFixtures]);

  // Socket listeners
  useEffect(() => {
    if (!accessToken || !gameweek) return;

    const socket = getSocket(accessToken);

    const onConnect = () => {
      socket.emit("followGameweek", gameweek);
    };

    const onScoreUpdate = (payload: ScoreUpdatePayload) => {
      setHasSocketActivity(true);
      setFixtures((prev) =>
        prev.map((fixture) =>
          fixture.id === payload.fixtureId
            ? {
                ...fixture,
                homeScore: payload.homeScore,
                awayScore: payload.awayScore,
                minute: payload.minute,
                status: payload.status,
              }
            : fixture
        )
      );
      flashFixture(payload.fixtureId);
    };

    const onMatchEvent = (payload: MatchEventPayload) => {
      setHasSocketActivity(true);
      setEventsByFixture((prev) => {
        const existing = prev[payload.fixtureId] ?? [];
        const fingerprint = `${payload.type}|${payload.minute}|${payload.teamSide}|${payload.playerName ?? ""}|${payload.detail ?? ""}`;
        const seen = new Set(existing.map((ev) => `${ev.type}|${ev.minute}|${ev.teamSide}|${ev.playerName ?? ""}|${ev.detail ?? ""}`));
        if (seen.has(fingerprint)) return prev;
        return {
          ...prev,
          [payload.fixtureId]: [...existing, payload],
        };
      });
    };

    socket.on("connect", onConnect);
    socket.on("scoreUpdate", onScoreUpdate);
    socket.on("matchEvent", onMatchEvent);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("scoreUpdate", onScoreUpdate);
      socket.off("matchEvent", onMatchEvent);
      disconnectSocket();
    };
  }, [accessToken, flashFixture, gameweek]);

  useEffect(() => {
    if (!expandedFixtureId) return;
    if (eventsByFixture[expandedFixtureId]) return;
    void loadFixtureEvents(expandedFixtureId);
  }, [expandedFixtureId, eventsByFixture, loadFixtureEvents]);

  const liveNow = useMemo(() => fixtures.filter((f) => f.status === "LIVE"), [fixtures]);
  const upcoming = useMemo(() => fixtures.filter((f) => f.status === "SCHEDULED"), [fixtures]);
  const fullTime = useMemo(() => fixtures.filter((f) => f.status === "FINISHED" || f.status === "POSTPONED"), [fixtures]);

  return {
    loading,
    error,
    gameweek,
    fixtures,
    liveNow,
    upcoming,
    fullTime,
    expandedFixtureId,
    setExpandedFixtureId,
    eventsByFixture,
    flashingFixtureIds,
    hasSocketActivity,
    reload,
  };
}
