import { Clock, Play, Square, Pencil, Trash2, Receipt, GripVertical } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export type StationType = "pool" | "gaming" | "foosball";

interface StationCardProps {
  id: string;
  name: string;
  type: StationType;
  isActive: boolean;
  rateSoloHourly?: number | string;
  rateGroupHourly?: number | string;
  currentPricingTier?: "solo" | "group";
  isPaused?: boolean;
  timeElapsed?: number;
  currentCharge?: number;
  startTime?: number;
  onStart: () => void;
  onStop: () => void;
  onResume?: () => void;
  onCompletePayment?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
  dragEnabled?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLDivElement>;
  dropZoneProps?: HTMLAttributes<HTMLDivElement>;
  isDragOver?: boolean;
}

const stationColors = {
  pool: "border-l-chart-1",
  gaming: "border-l-chart-2",
  foosball: "border-l-chart-3",
};

const stationBadgeColors = {
  pool: "bg-chart-1/10 text-chart-1",
  gaming: "bg-chart-2/10 text-chart-2",
  foosball: "bg-chart-3/10 text-chart-3",
};

export function StationCard({
  id,
  name,
  type,
  isActive,
  rateSoloHourly,
  rateGroupHourly,
  currentPricingTier,
  isPaused = false,
  timeElapsed = 0,
  currentCharge = 0,
  startTime,
  onStart,
  onStop,
  onResume,
  onCompletePayment,
  onEdit,
  onDelete,
  onClick,
  dragEnabled = false,
  dragHandleProps,
  dropZoneProps,
  isDragOver = false,
}: StationCardProps) {
  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatRate = (val: number | string | undefined) => {
    if(val === undefined || val === null) return "—";
    const n = typeof val === "string" ? Number(val) : val;
    if(!Number.isFinite(n)) return "—";
    return formatCurrency(n);
  };

  const formatStartTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const showCurrentRateOnly = isActive && !!currentPricingTier;
  const currentRate = currentPricingTier === "solo" ? rateSoloHourly : rateGroupHourly;
  const currentTierLabel = currentPricingTier === "solo" ? "Solo/hr" : "Group/hr";

  return (
    <Card
      className={cn(
        "border-l-4 hover-elevate cursor-pointer transition-all",
        stationColors[type],
        isActive && "ring-2 ring-primary/20",
        isDragOver && "ring-2 ring-primary"
      )}
      onClick={onClick}
      data-testid={`card-station-${id}`}
      {...dropZoneProps}
    >
      <div className="p-6 space-y-4">
        {dragEnabled && (
          <div
            className="w-full rounded-md border bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground flex items-center gap-2 cursor-grab active:cursor-grabbing select-none"
            onClick={(e) => e.stopPropagation()}
            data-testid={`drag-zone-${id}`}
            {...dragHandleProps}
          >
            <GripVertical className="w-4 h-4 shrink-0" />
            <span className="truncate">Drag me to another Station to Swap</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="text-lg font-semibold" data-testid={`text-station-name-${id}`}>
              {name}
            </h3>
            <Badge
              variant="outline"
              className={cn("mt-1", stationBadgeColors[type])}
              data-testid={`badge-station-type-${id}`}
            >
              {type === "pool" ? "Pool Table" : type === "gaming" ? "Gaming" : "Foosball"}
            </Badge>
            <div className="mt-2 text-xs text-muted-foreground space-y-1">
              {showCurrentRateOnly ? (
                <div className="font-semibold text-foreground" data-testid={`text-rate-current-${id}`}>
                  Current: {currentTierLabel} {formatRate(currentRate)}
                </div>
              ) : (
                <>
                  <div data-testid={`text-rate-solo-${id}`}>Solo/hr: {formatRate(rateSoloHourly)}</div>
                  <div data-testid={`text-rate-group-${id}`}>Group/hr: {formatRate(rateGroupHourly)}</div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={isActive ? (isPaused ? "outline" : "default") : "secondary"}
              data-testid={`badge-status-${id}`}
            >
              {isActive ? (isPaused ? "Paused" : "Active") : "Available"}
            </Badge>

            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.();
              }}
              disabled={!onEdit}
              aria-label="Edit station"
              data-testid={`button-edit-${id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>

            <Button
              variant="destructive"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.();
              }}
              disabled={!onDelete}
              aria-label="Delete station"
              data-testid={`button-delete-${id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isActive ? (
          <div className="space-y-3">
            {startTime && (
              <div className="text-xs text-muted-foreground" data-testid={`text-start-time-${id}`}>
                Started at {formatStartTime(startTime)}
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-3xl font-mono font-bold text-foreground" data-testid={`text-timer-${id}`}>
                {formatTime(timeElapsed)}
              </span>
            </div>
            <div className="text-2xl font-mono font-semibold text-primary" data-testid={`text-charge-${id}`}>
              {formatCurrency(currentCharge)}
            </div>
            {isPaused ? (
              <div className="space-y-2">
                <Button
                  variant="default"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResume?.();
                  }}
                  data-testid={`button-resume-${id}`}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompletePayment?.();
                  }}
                  disabled={!onCompletePayment}
                  data-testid={`button-checkout-${id}`}
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Checkout
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStop();
                  }}
                  data-testid={`button-stop-${id}`}
                >
                  <Square className="w-4 h-4 mr-2" />
                  Pause
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompletePayment?.();
                  }}
                  disabled={!onCompletePayment}
                  data-testid={`button-checkout-${id}`}
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Checkout
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Button
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onStart();
            }}
            data-testid={`button-start-${id}`}
          >
            <Play className="w-4 h-4 mr-2" />
            Start Session
          </Button>
        )}
      </div>
    </Card>
  );
}
