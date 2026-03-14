import { useMemo, useState } from "react";
import { ArrowRightLeft, Check, Clock, PanelRightClose, Pencil, Receipt, ShoppingBag, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

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
  customerName?: string | null;
  onUpdateName?: (name: string | null) => void;
  onAddItems: () => void;
  onCheckout: () => void;
  onTransfer: () => void;
  onRequestRemoveItem: (item: SessionItem) => void;
  onMinimize?: () => void;
  status?: "active" | "paused";
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
  customerName,
  onUpdateName,
  items,
  onAddItems,
  onCheckout,
  onTransfer,
  onRequestRemoveItem,
  onMinimize,
  status = "active",
}: ActiveSessionPanelProps) {
  const [activeTab, setActiveTab] = useState<"breakdown" | "items">("items");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

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

  const groupedItems = useMemo(() => {
    const groups = new Map<string, SessionItem[]>();
    for (const item of items) {
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
    return categories.map((cat) => ({
      category: cat,
      items: (groups.get(cat) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [items]);

  return (
    <Card className="h-[calc(100dvh-7rem)] overflow-hidden lg:h-[calc(100vh-8rem)] flex" data-testid="panel-active-session">
      {/* Minimize side strip */}
      {onMinimize && (
        <button
          className="flex items-center justify-center w-7 shrink-0 border-r border-border/50 text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={onMinimize}
          aria-label="Minimize panel"
          data-testid="button-minimize-panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      )}
      <div className="flex h-full flex-1 min-w-0 flex-col gap-3 p-4">

        {/* Station header */}
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2
                className="text-2xl font-bold font-display leading-tight truncate"
                data-testid="text-panel-station-name"
              >
                {stationName}
              </h2>
            </div>
            <Badge className={status === "paused"
              ? "bg-chart-4/10 text-chart-4 border border-chart-4/30 shrink-0"
              : "bg-chart-3/10 text-chart-3 border border-chart-3/30 shrink-0"
            }>
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === "paused" ? "bg-chart-4" : "bg-chart-3 animate-pulse"}`} />
              {status === "paused" ? "Paused" : "Live"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Input
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  placeholder="Customer name"
                  className="h-7 text-sm"
                  maxLength={100}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onUpdateName?.(editNameValue.trim() || null);
                      setIsEditingName(false);
                    }
                    if (e.key === "Escape") {
                      setIsEditingName(false);
                    }
                  }}
                  data-testid="input-edit-customer-name"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => {
                    onUpdateName?.(editNameValue.trim() || null);
                    setIsEditingName(false);
                  }}
                  data-testid="button-save-customer-name"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setIsEditingName(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                {customerName ? (
                  <span className="text-lg font-semibold text-foreground" data-testid="text-panel-customer-name">
                    {customerName}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground/50 italic">No customer name</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => {
                    setEditNameValue(customerName ?? "");
                    setIsEditingName(true);
                  }}
                  data-testid="button-edit-customer-name"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {startTime && (
            <p className="text-sm text-muted-foreground" data-testid="text-panel-start-time">
              Started at {formatStartTime(startTime)}
            </p>
          )}
        </div>

        {/* Compact timer row */}
        <div className="flex items-center justify-between rounded-md bg-muted/40 border border-border/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-2xl font-mono font-bold leading-none" data-testid="text-panel-timer">
              {formatTime(timeElapsed)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide leading-none mb-0.5">
              Time Charge
            </p>
            <p
              className="text-xl font-mono font-semibold text-primary leading-none"
              data-testid="text-panel-time-charge"
            >
              ${timeCharge.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border">
          <button
            className={`flex items-center gap-1.5 px-3 pb-2 text-sm font-medium transition-colors ${
              activeTab === "breakdown"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("breakdown")}
          >
            <Clock className="h-3.5 w-3.5" />
            Time Breakdown
            {timeSegments.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs leading-none ${
                activeTab === "breakdown" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {timeSegments.length}
              </span>
            )}
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 pb-2 text-sm font-medium transition-colors ${
              activeTab === "items"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("items")}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Items
            {items.length > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs leading-none ${
                activeTab === "items" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {items.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex min-h-0 flex-1 flex-col">
          {activeTab === "breakdown" ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {timeSegments.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No prior transfer segments.</p>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
                  {timeSegments.map((segment) => (
                    <div key={segment.id} className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{segment.stationName}</span>
                        <span className="font-mono font-semibold">${segment.timeAmount.toFixed(2)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between text-muted-foreground">
                        <span>{segment.pricingTier === "solo" ? "Solo" : "Group"}</span>
                        <span className="font-mono">{formatTime(segment.effectiveSeconds)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between rounded-md border bg-background/60 px-3 py-2 text-xs shrink-0">
                <span className="text-muted-foreground">
                  Current ({currentPricingTier === "solo" ? "Solo" : "Group"}) @ ${currentHourlyRate.toFixed(2)}/hr
                </span>
                <span className="font-mono font-semibold">${currentSegmentCharge.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between shrink-0">
                <span className="text-xs text-muted-foreground">
                  {items.length === 0 ? "No items added yet" : `${items.length} item${items.length === 1 ? "" : "s"}`}
                </span>
                <Button variant="outline" size="sm" onClick={onAddItems} data-testid="button-add-items">
                  Add Items
                </Button>
              </div>

              {groupedItems.length > 0 ? (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                  {groupedItems.map((group) => (
                    <div key={group.category}>
                      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1">
                        {group.category}
                      </p>
                      {group.items.map((item, index) => (
                        <div
                          key={`${item.id}-${index}`}
                          className="flex items-center justify-between rounded-md px-2 py-1.5 hover-elevate"
                          data-testid={`item-session-${item.id}-${index}`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="text-sm truncate">
                              {item.quantity}x {item.name}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => onRequestRemoveItem(item)}
                              aria-label={`Remove ${item.name}`}
                              data-testid={`button-remove-session-item-${item.id}-${index}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <span
                            className="text-sm font-mono shrink-0"
                            data-testid={`text-session-item-total-${item.id}-${index}`}
                          >
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center justify-between border-t pt-2 shrink-0">
                <span className="text-sm font-medium text-muted-foreground">Items Subtotal</span>
                <span className="text-sm font-mono font-medium" data-testid="text-panel-items-subtotal">
                  ${itemsTotal.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Total strip */}
        <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/20 px-4 py-3">
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Total Amount
          </span>
          <span
            className="text-4xl font-mono font-bold text-primary"
            data-testid="text-panel-grand-total"
          >
            ${grandTotal.toFixed(2)}
          </span>
        </div>

        {/* Action buttons */}
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
