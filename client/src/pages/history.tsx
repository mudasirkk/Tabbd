import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthReady } from "@/lib/useAuthReady";
import { fetchWithAuth } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun, ArrowLeft, Clock } from "lucide-react";

interface SessionHistoryItem {
  id: string;
  menuItemId: string | null;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
  lineTotal: number;
  createdAt: string;
  category: string | null;
}

interface SessionHistoryTimeSegment {
  id: string;
  sequence: number;
  stationId: string;
  stationName: string;
  stationType: string;
  startedAt: string;
  endedAt: string;
  effectiveSeconds: number;
  pricingTier: "solo" | "group";
  rateHourlyApplied: number;
  timeAmount: number;
}

interface SessionHistoryRow {
  id: string;
  stationId: string;
  stationName: string;
  stationType: string;
  pricingTier: "solo" | "group";
  startedAt: string;
  closedAt: string;
  totalPausedSeconds: number;
  effectiveSeconds: number;
  timeCharge: number;
  itemsSubtotal: number;
  grandTotal: number;
  itemCount: number;
  items: SessionHistoryItem[];
  timeSegments: SessionHistoryTimeSegment[];
}

function formatDateTime(input: string): string {
  return new Date(input).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function HistoryPage() {
  const { ready: authReady, user } = useAuthReady();
  const { theme, toggleTheme } = useTheme();

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [itemsDrawer, setItemsDrawer] = useState<string | null>(null);
  const [timeDrawer, setTimeDrawer] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (!user) window.location.replace("/signin");
  }, [authReady, user]);

  const { data, isLoading, error } = useQuery<SessionHistoryRow[]>({
    queryKey: ["session-history", selectedDate],
    queryFn: () => fetchWithAuth<SessionHistoryRow[]>(`/api/sessions/history?date=${selectedDate}`),
    retry: false,
    enabled: authReady && !!user,
    refetchOnWindowFocus: true,
  });

  const rows = useMemo(() => data ?? [], [data]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 max-w-lg w-full space-y-3">
          <h2 className="text-lg font-semibold">Couldn&apos;t load session history</h2>
          <p className="text-sm text-muted-foreground">
            Please refresh. If this continues, sign out and sign back in.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <Button onClick={() => window.location.assign("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <div className="container mx-auto max-w-screen-xl px-4 py-3 flex justify-between items-center gap-4">
          <h1 className="text-3xl font-bold font-display leading-tight">History</h1>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.assign("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-screen-xl px-4 py-6">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-card/30 p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
              <Clock className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground/60">No sessions closed on this date</p>
            <p className="mt-1 text-sm text-muted-foreground">Checked out sessions will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <Card key={row.id} className="border-t-2 border-t-primary/40 p-5 space-y-3">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold font-display leading-tight">{row.stationName}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">
                      {row.stationType} &middot; {row.pricingTier === "solo" ? "Solo" : "Group"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">
                      Grand Total
                    </p>
                    <div className="text-2xl font-mono font-bold text-primary">
                      {formatMoney(row.grandTotal)}
                    </div>
                  </div>
                </div>

                {/* Condensed info */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wide mr-1">Started</span>
                    {formatDateTime(row.startedAt)}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wide mr-1">Closed</span>
                    {formatDateTime(row.closedAt)}
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs uppercase tracking-wide mr-1">Duration</span>
                    <span className="font-mono">{formatDuration(row.effectiveSeconds)}</span>
                  </div>
                </div>

                {/* Drawer buttons */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setItemsDrawer(row.id)}>
                    Items — {formatMoney(row.itemsSubtotal)}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setTimeDrawer(row.id)}>
                    Time — {formatMoney(row.timeCharge)}
                  </Button>
                </div>

                {/* Items drawer */}
                <Sheet open={itemsDrawer === row.id} onOpenChange={(o) => !o && setItemsDrawer(null)}>
                  <SheetContent className="flex flex-col">
                    <SheetHeader className="shrink-0">
                      <SheetTitle>Items — {row.stationName}</SheetTitle>
                      <SheetDescription>Menu items added during this session.</SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto mt-4 pr-1">
                      {row.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items were added to this session.</p>
                      ) : (
                        (() => {
                          const groups = new Map<string, SessionHistoryItem[]>();
                          for (const item of row.items) {
                            const cat = (item.category ?? "").trim() || "Miscellaneous";
                            const arr = groups.get(cat) ?? [];
                            arr.push(item);
                            groups.set(cat, arr);
                          }
                          const categories = Array.from(groups.keys()).sort((a, b) => {
                            if (a === "Miscellaneous") return 1;
                            if (b === "Miscellaneous") return -1;
                            return a.localeCompare(b);
                          });
                          return categories.map((cat) => (
                            <div key={cat} className="mb-3">
                              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                                {cat}
                              </p>
                              <div className="space-y-1.5">
                                {(groups.get(cat) ?? [])
                                  .slice()
                                  .sort((a, b) => a.nameSnapshot.localeCompare(b.nameSnapshot))
                                  .map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex items-center justify-between text-sm border border-border/60 rounded-md px-3 py-2 bg-muted/20"
                                    >
                                      <span className="font-medium">
                                        {item.qty}x {item.nameSnapshot}
                                      </span>
                                      <span className="font-mono text-muted-foreground">
                                        {formatMoney(item.priceSnapshot)} each &middot;{" "}
                                        <span className="text-foreground/80">{formatMoney(item.lineTotal)}</span>
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          ));
                        })()
                      )}
                    </div>
                    <div className="flex justify-between pt-3 border-t font-medium shrink-0">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatMoney(row.itemsSubtotal)}</span>
                    </div>
                  </SheetContent>
                </Sheet>

                {/* Time drawer */}
                <Sheet open={timeDrawer === row.id} onOpenChange={(o) => !o && setTimeDrawer(null)}>
                  <SheetContent className="flex flex-col">
                    <SheetHeader className="shrink-0">
                      <SheetTitle>Time — {row.stationName}</SheetTitle>
                      <SheetDescription>Time segments and charges for this session.</SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 min-h-0 overflow-y-auto mt-4 space-y-1.5 pr-1">
                      {row.timeSegments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No transfer segments recorded.</p>
                      ) : (
                        row.timeSegments.map((segment) => (
                          <div
                            key={segment.id}
                            className="flex items-center justify-between text-xs border border-border/60 rounded-md px-3 py-2 bg-muted/20"
                          >
                            <span className="text-foreground/80">
                              {segment.sequence}. {segment.stationName}{" "}
                              <span className="text-muted-foreground">
                                ({segment.pricingTier === "solo" ? "Solo" : "Group"}) &middot; {formatDuration(segment.effectiveSeconds)}
                              </span>
                            </span>
                            <span className="font-mono text-muted-foreground">
                              ${segment.rateHourlyApplied.toFixed(2)}/hr &middot;{" "}
                              <span className="text-foreground/80">{formatMoney(segment.timeAmount)}</span>
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex justify-between pt-3 border-t font-medium shrink-0">
                      <span>Time Charge</span>
                      <span className="font-mono">{formatMoney(row.timeCharge)}</span>
                    </div>
                  </SheetContent>
                </Sheet>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
