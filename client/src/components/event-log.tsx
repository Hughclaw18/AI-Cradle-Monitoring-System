/**
 * EventLog — unified historical + live detection log
 *
 * Layout:
 *  • Summary bar  — today's totals at a glance
 *  • 7-day sparkline — tap a bar to jump to that day
 *  • Filter pills — All / Cry / Object / Temp
 *  • Grouped timeline — date-separated rows, newest first
 *  • Load more — paginated, 50 at a time
 *  • Export CSV
 */
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Package, Thermometer, ChevronDown, Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SensorData } from "@shared/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = "crying" | "object" | "temperature";
type FilterType = "all" | EventType;

interface LogEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  detail: string;
  severity: "info" | "warning" | "danger";
}

interface DaySummary {
  date: string;
  crying: number;
  objects: number;
  temperature: number;
}

interface HistoryResponse {
  rows: SensorData[];
  summary: DaySummary[];
  limit: number;
  offset: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HAZARDOUS = new Set([
  "knife","scissors","lighter","coin","battery","pin","nail",
  "glass","medicine","plastic_bag","small_marble","sharp_toy","hot_liquid","insect",
]);

function rowsToEvents(rows: SensorData[]): LogEvent[] {
  const events: LogEvent[] = [];
  for (const row of rows) {
    const ts = new Date(row.timestamp);
    if (row.cryingDetected) {
      events.push({
        id: `cry-${row.id}`,
        type: "crying",
        timestamp: ts,
        detail: "Crying detected",
        severity: "warning",
      });
    }
    const objs = Array.isArray(row.objectDetected) ? row.objectDetected : [];
    for (const obj of objs) {
      const isHazard = HAZARDOUS.has(obj.object_name?.toLowerCase());
      events.push({
        id: `obj-${row.id}-${obj.object_name}`,
        type: "object",
        timestamp: new Date(obj.timestamp ?? ts),
        detail: obj.object_name,
        severity: isHazard ? "danger" : "info",
      });
    }
    if (row.temperature > 78) {
      events.push({
        id: `temp-${row.id}`,
        type: "temperature",
        timestamp: ts,
        detail: `${row.temperature.toFixed(1)}°F`,
        severity: row.temperature > 85 ? "danger" : "warning",
      });
    }
  }
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

function groupByDay(events: LogEvent[]): { label: string; date: string; events: LogEvent[] }[] {
  const map = new Map<string, LogEvent[]>();
  for (const e of events) {
    const key = format(e.timestamp, "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([date, evts]) => {
    const d = parseISO(date);
    const label = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEE, MMM d");
    return { label, date, events: evts };
  });
}

function exportCsv(events: LogEvent[]) {
  const header = "Type,Timestamp,Detail,Severity\n";
  const body = events
    .map(e => `${e.type},${e.timestamp.toISOString()},${e.detail},${e.severity}`)
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cradle-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Sparkline({ summary, onDayClick }: { summary: DaySummary[]; onDayClick: (date: string) => void }) {
  const maxVal = Math.max(1, ...summary.map(d => d.crying + d.objects + d.temperature));
  return (
    <div className="flex items-end gap-1.5 h-10">
      {summary.map((day) => {
        const total = day.crying + day.objects + day.temperature;
        const heightPct = Math.max(8, Math.round((total / maxVal) * 100));
        const isTodays = isToday(parseISO(day.date));
        return (
          <button
            key={day.date}
            onClick={() => onDayClick(day.date)}
            title={`${format(parseISO(day.date), "EEE MMM d")}: ${total} events`}
            className="flex-1 flex flex-col items-center gap-0.5 group"
          >
            <div
              className={cn(
                "w-full rounded-sm transition-all group-hover:opacity-80",
                isTodays ? "bg-primary" : "bg-primary/30"
              )}
              style={{ height: `${heightPct}%` }}
            />
            <span className="text-[8px] font-bold text-muted-foreground uppercase">
              {format(parseISO(day.date), "EEE")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const TYPE_CONFIG = {
  crying:      { icon: Volume2,     color: "text-amber-500",     bg: "bg-amber-500/10",     border: "border-amber-500/20",     label: "Cry"    },
  object:      { icon: Package,     color: "text-green-500",     bg: "bg-green-500/10",     border: "border-green-500/20",     label: "Object" },
  temperature: { icon: Thermometer, color: "text-destructive",   bg: "bg-destructive/10",   border: "border-destructive/20",   label: "Temp"   },
};

function EventRow({ event, index }: { event: LogEvent; index: number }) {
  const [open, setOpen] = useState(false);
  const cfg = TYPE_CONFIG[event.type];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className={cn("rounded-2xl border p-3 cursor-pointer transition-colors hover:bg-muted/40", cfg.bg, cfg.border)}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center gap-3">
        <div className={cn("p-1.5 rounded-xl shrink-0", cfg.bg)}>
          <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">
              {event.type === "crying" ? "Crying detected"
               : event.type === "temperature" ? `High temp — ${event.detail}`
               : event.detail}
            </span>
            {event.severity === "danger" && (
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> HAZARD
              </Badge>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">
            {format(event.timestamp, "h:mm a")}
          </span>
        </div>

        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="pt-2 mt-2 border-t border-border/50 text-xs text-muted-foreground space-y-0.5">
              <p><span className="font-semibold text-foreground">Type:</span> {event.type}</p>
              <p><span className="font-semibold text-foreground">Detail:</span> {event.detail}</p>
              <p><span className="font-semibold text-foreground">Time:</span> {format(event.timestamp, "PPP p")}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface EventLogProps {
  /** Live in-session events from the WebSocket (passed from dashboard) */
  liveEvents: LogEvent[];
}

export type { LogEvent };

export function EventLog({ liveEvents }: EventLogProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [offset, setOffset] = useState(0);
  const [jumpDate, setJumpDate] = useState<string | null>(null);
  const PAGE = 50;

  const { data, isFetching } = useQuery<HistoryResponse>({
    queryKey: ["/api/sensors/history", offset],
    queryFn: async () => {
      const res = await fetch(`/api/sensors/history?limit=${PAGE}&offset=${offset}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    staleTime: 30_000,
  });

  // Merge DB history with live in-session events, deduplicate by id
  const allEvents = useMemo(() => {
    const dbEvents = rowsToEvents(data?.rows ?? []);
    const liveIds = new Set(liveEvents.map(e => e.id));
    const deduped = dbEvents.filter(e => !liveIds.has(e.id));
    return [...liveEvents, ...deduped].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [data?.rows, liveEvents]);

  const filtered = useMemo(
    () => filter === "all" ? allEvents : allEvents.filter(e => e.type === filter),
    [allEvents, filter]
  );

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  // Today's totals for summary bar
  const todayEvents = useMemo(() => allEvents.filter(e => isToday(e.timestamp)), [allEvents]);
  const todayCry  = todayEvents.filter(e => e.type === "crying").length;
  const todayObj  = todayEvents.filter(e => e.type === "object").length;
  const todayTemp = todayEvents.filter(e => e.type === "temperature").length;

  const handleDayClick = useCallback((date: string) => {
    setJumpDate(date);
    setFilter("all");
    setTimeout(() => {
      document.getElementById(`day-${date}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Event Log</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Full history from database + live session</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 text-xs font-bold"
          onClick={() => exportCsv(filtered)}
        >
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {/* ── Summary bar ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Cries today",   value: todayCry,  color: "text-amber-500",   bg: "bg-amber-500/10",   icon: Volume2     },
          { label: "Objects today", value: todayObj,  color: "text-green-500",   bg: "bg-green-500/10",   icon: Package     },
          { label: "Temp alerts",   value: todayTemp, color: "text-destructive", bg: "bg-destructive/10", icon: Thermometer },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className={cn("rounded-2xl p-3 flex flex-col gap-1 border border-border/50", bg)}>
            <Icon className={cn("h-4 w-4", color)} />
            <span className={cn("text-2xl font-black leading-none", color)}>{value}</span>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider leading-tight">{label}</span>
          </div>
        ))}
      </div>

      {/* ── 7-day sparkline ── */}
      {data?.summary && data.summary.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card/50 p-4 space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Last 7 days — tap to jump</p>
          <Sparkline summary={data.summary} onDayClick={handleDayClick} />
        </div>
      )}

      {/* ── Filter pills ── */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "crying", "object", "temperature"] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all",
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
            )}
          >
            {f === "all" ? "All" : f === "crying" ? "😭 Cry" : f === "object" ? "📦 Object" : "🌡 Temp"}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground self-center font-medium">
          {filtered.length} events
        </span>
      </div>

      {/* ── Timeline ── */}
      <div className="min-h-0">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground space-y-2">
            <Package className="h-8 w-8 opacity-20" />
            <p className="text-sm font-medium">No events yet</p>
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {groups.map(({ label, date, events: dayEvents }) => (
              <div key={date} id={`day-${date}`}>
                <div className="flex items-center gap-3 mb-3 sticky top-0 bg-background/80 backdrop-blur py-1 z-10">
                  <div className="h-px flex-1 bg-border/50" />
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest shrink-0">{label}</span>
                  <div className="h-px flex-1 bg-border/50" />
                </div>
                <div className="space-y-2">
                  {dayEvents.map((event, i) => (
                    <EventRow key={event.id} event={event} index={i} />
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
          </div>
        )}
      </div>
    </div>
  );
}
