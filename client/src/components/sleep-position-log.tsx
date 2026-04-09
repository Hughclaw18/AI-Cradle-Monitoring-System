/**
 * SleepPositionLog — historical + live sleep position tracker
 *
 * Layout:
 *  • Current position card — large, prominent, live from WebSocket
 *  • 7-day position breakdown — stacked bar per day (back / side / stomach / unknown)
 *  • Safety banner — warning when stomach detected
 *  • Paginated timeline — every recorded position change, newest first
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Baby, AlertTriangle, ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Position = "back" | "side" | "stomach" | "unknown";

interface PositionEntry {
  id: number;
  timestamp: Date;
  position: Position;
}

interface DaySummary {
  date: string;
  positions: Record<string, number>;
}

interface HistoryResponse {
  rows: { id: number; timestamp: string; sleepingPosition: string | null }[];
  limit: number;
  offset: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const POS_CONFIG: Record<Position, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  back:    { label: "Back",    color: "text-blue-500",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    emoji: "🔵" },
  side:    { label: "Side",    color: "text-green-500",   bg: "bg-green-500/10",   border: "border-green-500/20",   emoji: "🟢" },
  stomach: { label: "Stomach", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", emoji: "🔴" },
  unknown: { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted/30",  border: "border-border/30",      emoji: "⚪" },
};

const SAFE_POSITIONS: Position[] = ["back", "side"];

function normalise(raw: string | null | undefined): Position {
  const s = (raw ?? "").toLowerCase().trim();
  if (!s || s === "unknown") return "unknown";
  // Full sentence values from the YOLO posture model
  if (s.includes("facing up") || s.includes("back") || s.includes("supine")) return "back";
  if (s.includes("side") || s.includes("lateral")) return "side";
  if (s.includes("stomach") || s.includes("prone") || s.includes("facing down")) return "stomach";
  // Short keyword fallback
  if (s === "back") return "back";
  if (s === "side") return "side";
  if (s === "stomach") return "stomach";
  return "unknown";
}

function exportCsv(entries: PositionEntry[]) {
  const header = "ID,Timestamp,Position\n";
  const body = entries.map(e => `${e.id},${e.timestamp.toISOString()},${e.position}`).join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sleep-positions-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CurrentPositionCard({ position }: { position: Position }) {
  const cfg = POS_CONFIG[position];
  const isDanger = position === "stomach";

  return (
    <motion.div
      key={position}
      initial={{ scale: 0.97, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-2xl border-2 p-4 flex items-center gap-4",
        cfg.bg, cfg.border,
        isDanger && "animate-pulse"
      )}
    >
      <div className={cn("p-3 rounded-xl text-3xl", cfg.bg)}>
        {cfg.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Current Position</p>
        <p className={cn("text-2xl font-black leading-none", cfg.color)}>{cfg.label}</p>
        {isDanger && (
          <p className="text-xs text-destructive font-bold mt-1.5 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Airway risk — check on baby
          </p>
        )}
        {position === "back" && (
          <p className="text-xs text-muted-foreground mt-1">Safest sleep position ✓</p>
        )}
      </div>
      <Baby className={cn("h-10 w-10 shrink-0 opacity-20", cfg.color)} />
    </motion.div>
  );
}

function WeeklyBreakdown({ summary }: { summary: DaySummary[] }) {
  if (!summary.length) return null;

  const positions: Position[] = ["back", "side", "stomach", "unknown"];

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-4 space-y-3">
      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">7-day position breakdown</p>

      <div className="space-y-2">
        {summary.map(day => {
          const total = Object.values(day.positions).reduce((s, v) => s + v, 0) || 1;
          const d = parseISO(day.date);
          const label = isToday(d) ? "Today" : isYesterday(d) ? "Yest." : format(d, "EEE");

          return (
            <div key={day.date} className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted-foreground w-9 shrink-0">{label}</span>
              <div className="flex-1 flex h-5 rounded-full overflow-hidden gap-px">
                {positions.map(pos => {
                  const count = day.positions[pos] || 0;
                  const pct = Math.round((count / total) * 100);
                  if (!pct) return null;
                  return (
                    <div
                      key={pos}
                      title={`${POS_CONFIG[pos].label}: ${count} (${pct}%)`}
                      className={cn(
                        "transition-all",
                        pos === "back"    && "bg-blue-500",
                        pos === "side"    && "bg-green-500",
                        pos === "stomach" && "bg-destructive",
                        pos === "unknown" && "bg-muted-foreground/30",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  );
                })}
              </div>
              {(day.positions["stomach"] ?? 0) > 0 && (
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap pt-1">
        {positions.filter(p => p !== "unknown").map(pos => (
          <div key={pos} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full",
              pos === "back" && "bg-blue-500",
              pos === "side" && "bg-green-500",
              pos === "stomach" && "bg-destructive",
            )} />
            <span className="text-[10px] font-bold text-muted-foreground">{POS_CONFIG[pos].label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PositionRow({ entry, index }: { entry: PositionEntry; index: number }) {
  const [open, setOpen] = useState(false);
  const cfg = POS_CONFIG[entry.position];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025, duration: 0.18 }}
      className={cn("rounded-2xl border p-3 cursor-pointer transition-colors hover:bg-muted/40", cfg.bg, cfg.border)}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl shrink-0">{cfg.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-bold", cfg.color)}>{cfg.label}</span>
            {entry.position === "stomach" && (
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> RISK
              </Badge>
            )}
            {SAFE_POSITIONS.includes(entry.position) && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-green-600 border-green-500/30">Safe</Badge>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">{format(entry.timestamp, "h:mm a")}</span>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pt-2 mt-2 border-t border-border/50 text-xs text-muted-foreground space-y-0.5">
              <p><span className="font-semibold text-foreground">Position:</span> {cfg.label}</p>
              <p><span className="font-semibold text-foreground">Recorded:</span> {format(entry.timestamp, "PPP p")}</p>
              <p><span className="font-semibold text-foreground">Safety:</span> {SAFE_POSITIONS.includes(entry.position) ? "✓ Safe" : entry.position === "stomach" ? "⚠ Airway risk" : "—"}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SleepPositionLogProps {
  /** Latest position from live WebSocket sensor data */
  currentPosition?: string | null;
}

export function SleepPositionLog({ currentPosition }: SleepPositionLogProps) {
  const [offset, setOffset] = useState(0);
  const PAGE = 100;

  const { data, isFetching } = useQuery<HistoryResponse>({
    queryKey: ["/api/sensors/sleep-positions", offset],
    queryFn: async () => {
      const res = await fetch(`/api/sensors/sleep-positions?limit=${PAGE}&offset=${offset}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });

  const entries: PositionEntry[] = useMemo(() =>
    (data?.rows ?? []).map(r => ({
      id: r.id,
      timestamp: new Date(r.timestamp),
      position: normalise(r.sleepingPosition),
    })),
    [data?.rows]
  );

  // Build 7-day summary from entries
  const summary: DaySummary[] = useMemo(() => {
    const byDay: Record<string, Record<string, number>> = {};
    for (const e of entries) {
      const day = format(e.timestamp, "yyyy-MM-dd");
      if (!byDay[day]) byDay[day] = {};
      byDay[day][e.position] = (byDay[day][e.position] || 0) + 1;
    }
    return Object.entries(byDay)
      .map(([date, positions]) => ({ date, positions }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);
  }, [entries]);

  // Group timeline by day
  const grouped = useMemo(() => {
    const map = new Map<string, PositionEntry[]>();
    for (const e of entries) {
      const key = format(e.timestamp, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).map(([date, evts]) => {
      const d = parseISO(date);
      return {
        date,
        label: isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEE, MMM d"),
        entries: evts,
      };
    });
  }, [entries]);

  const livePosition = normalise(currentPosition);
  const stomachCount = entries.filter(e => e.position === "stomach").length;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Sleep Position</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Live detection + full history</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs font-bold" onClick={() => exportCsv(entries)}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {/* Live current position */}
      <AnimatePresence mode="wait">
        <CurrentPositionCard key={livePosition} position={livePosition} />
      </AnimatePresence>

      {/* Safety warning if stomach detected historically */}
      {stomachCount > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive font-medium">
            Stomach position detected <span className="font-black">{stomachCount}×</span> in history.
            Stomach sleeping increases SIDS risk — always place baby on their back.
          </p>
        </div>
      )}

      {/* 7-day breakdown */}
      <WeeklyBreakdown summary={summary} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {(["back", "side", "stomach"] as Position[]).map(pos => {
          const count = entries.filter(e => e.position === pos).length;
          const cfg = POS_CONFIG[pos];
          return (
            <div key={pos} className={cn("rounded-2xl p-3 border flex flex-col gap-1", cfg.bg, cfg.border)}>
              <span className="text-lg">{cfg.emoji}</span>
              <span className={cn("text-2xl font-black leading-none", cfg.color)}>{count}</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Timeline — no fixed height, scrolls with page */}
      <div className="space-y-6 pb-4">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground space-y-2">
            <Baby className="h-8 w-8 opacity-20" />
            <p className="text-sm font-medium">No position data yet</p>
            <p className="text-xs opacity-60">Start the simulator and upload a video</p>
          </div>
        ) : (
          <>
            {grouped.map(({ label, date, entries: dayEntries }) => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-3 sticky top-0 bg-background/80 backdrop-blur py-1 z-10">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest shrink-0">{label}</span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                <div className="space-y-2">
                  {dayEntries.map((entry, i) => (
                    <PositionRow key={entry.id} entry={entry} index={i} />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" className="rounded-xl text-xs font-bold"
                disabled={isFetching || (data?.rows?.length ?? 0) < PAGE}
                onClick={() => setOffset(o => o + PAGE)}>
                {isFetching ? "Loading…" : (data?.rows?.length ?? 0) < PAGE ? "All caught up" : "Load more"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
