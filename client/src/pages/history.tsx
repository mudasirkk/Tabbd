import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthReady } from "@/lib/useAuthReady";
import { fetchWithAuth } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface SessionHistoryItem {
  id: string;
  menuItemId: string | null;
  nameSnapshot: string;
  priceSnapshot: number;
  qty: number;
  lineTotal: number;
  createdAt: string;
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
    year: "numeric",
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!authReady) return;
    if (!user) window.location.replace("/signin");
  }, [authReady, user]);

  const { data, isLoading, error } = useQuery<SessionHistoryRow[]>({
    queryKey: ["session-history"],
    queryFn: () => fetchWithAuth<SessionHistoryRow[]>("/api/sessions/history"),
    retry: false,
    enabled: authReady && !!user,
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
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
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Session History</h1>
            <p className="text-sm text-muted-foreground">Previously checked out sessions</p>
          </div>
          <Button variant="outline" onClick={() => window.location.assign("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {rows.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No checked out sessions yet.
          </Card>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => {
              const isOpen = !!expanded[row.id];
              return (
                <Card key={row.id} className="p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{row.stationName}</h2>
                      <p className="text-sm text-muted-foreground">
                        {row.stationType} | {row.pricingTier === "solo" ? "Solo" : "Group"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Grand Total</div>
                      <div className="text-xl font-mono font-semibold">{formatMoney(row.grandTotal)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">Started</div>
                      <div>{formatDateTime(row.startedAt)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Checked Out</div>
                      <div>{formatDateTime(row.closedAt)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Duration</div>
                      <div className="font-mono">{formatDuration(row.effectiveSeconds)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Items</div>
                      <div>{row.itemCount}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Time Charge</div>
                      <div className="font-mono">{formatMoney(row.timeCharge)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Items Subtotal</div>
                      <div className="font-mono">{formatMoney(row.itemsSubtotal)}</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Time Segments</div>
                    {row.timeSegments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No transfer segments recorded.</p>
                    ) : (
                      row.timeSegments.map((segment) => (
                        <div key={segment.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                          <span>
                            {segment.sequence}. {segment.stationName} ({segment.pricingTier === "solo" ? "Solo" : "Group"}) - {formatDuration(segment.effectiveSeconds)}
                          </span>
                          <span className="font-mono">
                            ${segment.rateHourlyApplied.toFixed(2)}/hr | {formatMoney(segment.timeAmount)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: !isOpen }))}
                    >
                      {isOpen ? "Hide Items" : "Show Items"}
                    </Button>
                    <span className="text-xs text-muted-foreground">Session ID: {row.id}</span>
                  </div>

                  {isOpen ? (
                    <div className="space-y-2">
                      {row.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No items were added to this session.</p>
                      ) : (
                        row.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm border rounded-md p-2">
                            <span>
                              {item.qty}x {item.nameSnapshot}
                            </span>
                            <span className="font-mono">
                              {formatMoney(item.priceSnapshot)} each | {formatMoney(item.lineTotal)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
