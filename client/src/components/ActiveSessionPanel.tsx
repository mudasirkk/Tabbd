import { ArrowRightLeft, Clock, Receipt, ShoppingBag, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export interface SessionItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

interface ActiveSessionPanelProps {
  stationName: string;
  timeElapsed: number;
  timeCharge: number;
  startTime?: number;
  timeSegments?: Array<{
    id: string;
    stationName: string;
    effectiveSeconds: number;
    pricingTier: "solo" | "group";
    rateHourlyApplied: number;
    timeAmount: number;
  }>;
  currentPricingTier?: "solo" | "group";
  currentHourlyRate?: number;
  currentSegmentCharge?: number;
  items: SessionItem[];
  onAddItems: () => void;
  onCheckout: () => void;
  onTransfer: () => void;
  onRequestRemoveItem: (item: SessionItem) => void;
}

export function ActiveSessionPanel({
  stationName,
  timeElapsed,
  timeCharge,
  startTime,
  timeSegments = [],
  currentPricingTier = "group",
  currentHourlyRate = 0,
  currentSegmentCharge = 0,
  items,
  onAddItems,
  onCheckout,
  onTransfer,
  onRequestRemoveItem,
}: ActiveSessionPanelProps) {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatStartTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = timeCharge + itemsTotal;
  const sortedItems = [...items].sort((a, b) => {
    const aCategory = (a.category ?? "").trim() || "Miscellaneous";
    const bCategory = (b.category ?? "").trim() || "Miscellaneous";

    if (aCategory === "Miscellaneous" && bCategory !== "Miscellaneous") return 1;
    if (bCategory === "Miscellaneous" && aCategory !== "Miscellaneous") return -1;

    const categoryCompare = aCategory.localeCompare(bCategory);
    if (categoryCompare !== 0) return categoryCompare;

    return a.name.localeCompare(b.name);
  });

  return (
    <Card className="h-[calc(100dvh-7rem)] overflow-hidden p-4 lg:h-[calc(100vh-8rem)]" data-testid="panel-active-session">
      <div className="flex h-full flex-col gap-3">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-2xl font-semibold" data-testid="text-panel-station-name">
              {stationName}
            </h2>
            <Badge variant="default">Active Session</Badge>
          </div>
          {startTime && (
            <p className="text-sm text-muted-foreground" data-testid="text-panel-start-time">
              Started at {formatStartTime(startTime)}
            </p>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Time Elapsed</p>
                  <p className="text-3xl font-mono font-bold" data-testid="text-panel-timer">
                    {formatTime(timeElapsed)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Time Charge</p>
                <p className="text-2xl font-mono font-semibold text-primary" data-testid="text-panel-time-charge">
                  ${timeCharge.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Time Breakdown</p>
              <span className="text-xs text-muted-foreground">
                {timeSegments.length} transferred segment{timeSegments.length === 1 ? "" : "s"}
              </span>
            </div>

            {timeSegments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prior transfer segments.</p>
            ) : (
              <div className="max-h-28 overflow-y-auto rounded-md border bg-background sm:max-h-32 lg:max-h-36">
                <div className="space-y-2 p-2 pr-3">
                  {timeSegments.map((segment) => (
                    <div key={segment.id} className="rounded border bg-background p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{segment.stationName}</span>
                        <span className="font-mono">${segment.timeAmount.toFixed(2)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-muted-foreground">
                        <span>{segment.pricingTier === "solo" ? "Solo" : "Group"}</span>
                        <span>{formatTime(segment.effectiveSeconds)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded border bg-background p-2 text-xs">
              <span>
                Current ({currentPricingTier === "solo" ? "Solo" : "Group"}) @ ${currentHourlyRate.toFixed(2)}/hr
              </span>
              <span className="font-mono">${currentSegmentCharge.toFixed(2)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex min-h-0 flex-1 flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                <h3 className="font-medium">Items on Tab</h3>
              </div>
              <Button variant="outline" size="sm" onClick={onAddItems} data-testid="button-add-items">
                Add Items
              </Button>
            </div>

            {sortedItems.length > 0 ? (
              <div className="max-h-28 overflow-y-auto rounded-md border p-2 sm:max-h-32 lg:max-h-36">
                <div className="space-y-2">
                  {sortedItems.map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className="flex items-center justify-between rounded-md p-2 hover-elevate"
                      data-testid={`item-session-${item.id}-${index}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {item.quantity}x {item.name}
                        </span>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRequestRemoveItem(item)}
                          aria-label={`Remove ${item.name}`}
                          data-testid={`button-remove-session-item-${item.id}-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <span className="text-sm font-mono" data-testid={`text-session-item-total-${item.id}-${index}`}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-3 text-center text-sm text-muted-foreground">No items added yet</p>
            )}

            {items.length > 0 && (
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm font-medium">Items Subtotal</span>
                <span className="text-sm font-mono font-medium" data-testid="text-panel-items-subtotal">
                  ${itemsTotal.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between rounded-lg bg-primary/10 p-4">
          <span className="text-lg font-semibold">Total Amount</span>
          <span className="text-3xl font-mono font-bold text-primary" data-testid="text-panel-grand-total">
            ${grandTotal.toFixed(2)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" size="lg" onClick={onTransfer} data-testid="button-transfer-session">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transfer
          </Button>
          <Button size="lg" onClick={onCheckout} data-testid="button-end-session">
            <Receipt className="mr-2 h-4 w-4" />
            Checkout
          </Button>
        </div>
      </div>
    </Card>
  );
}
