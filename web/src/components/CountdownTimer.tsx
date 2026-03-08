import { useEffect, useMemo, useState } from "react";

interface CountdownTimerProps {
  deadline?: string | Date | null;
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function CountdownTimer({ deadline }: CountdownTimerProps) {
  const deadlineMs = useMemo(() => (deadline ? new Date(deadline).getTime() : null), [deadline]);
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!deadlineMs) {
    return <span className="font-dm text-xs text-slate-500">--:--:--</span>;
  }

  return <span className="font-outfit text-xl font-bold text-[#22D3EE]">{formatRemaining(deadlineMs - nowMs)}</span>;
}
