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
  customerName?: string | null;
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

const stationLeftBorder: Record<StationType, string> = {
  pool: "border-l-chart-1",
  gaming: "border-l-chart-2",
  foosball: "border-l-chart-3",
};

const stationBadgeColors: Record<StationType, string> = {
  pool: "bg-chart-1/10 text-chart-1 border-chart-1/20",
  gaming: "bg-chart-2/10 text-chart-2 border-chart-2/20",
  foosball: "bg-chart-3/10 text-chart-3 border-chart-3/20",
};

const stationIconBg: Record<StationType, string> = {
  pool: "bg-chart-1/15",
  gaming: "bg-chart-2/15",
  foosball: "bg-chart-3/15",
};

const stationIconColor: Record<StationType, string> = {
  pool: "text-chart-1",
  gaming: "text-chart-2",
  foosball: "text-chart-3",
};

/* ─── Station Type Illustrated Icons ─────────────────────────────── */

function PoolBallIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="13" cy="13" r="12.5" fill="currentColor" />
      <circle cx="13" cy="11" r="6" fill="white" opacity="0.92" />
      <text
        x="13"
        y="15.5"
        textAnchor="middle"
        fontSize="7.5"
        fontWeight="800"
        fill="currentColor"
        fontFamily="monospace"
      >
        8
      </text>
    </svg>
  );
}

function GameControllerIcon() {
  return (
    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden="true">
      {/* Body */}
      <path
        d="M3 7 Q3 3 7 3 L21 3 Q25 3 25 7 L25 13 Q25 20 19 20 L9 20 Q3 20 3 13 Z"
        fill="currentColor"
        opacity="0.9"
      />
      {/* D-pad horizontal bar */}
      <rect x="7" y="10" width="6.5" height="2.5" rx="1" fill="white" opacity="0.5" />
      {/* D-pad vertical bar */}
      <rect x="9.25" y="7.5" width="2.5" height="6.5" rx="1" fill="white" opacity="0.5" />
      {/* Button dots */}
      <circle cx="19.5" cy="8.5" r="1.8" fill="white" opacity="0.45" />
      <circle cx="22.5" cy="11" r="1.8" fill="white" opacity="0.45" />
      <circle cx="16.5" cy="11" r="1.8" fill="white" opacity="0.45" />
      <circle cx="19.5" cy="13.5" r="1.8" fill="white" opacity="0.45" />
    </svg>
  );
}

function FoosballTableIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
      {/* Table surface */}
      <rect x="2" y="2" width="22" height="22" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="2" y="2" width="22" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" />
      {/* Rods */}
      <line x1="2" y1="9" x2="24" y2="9" stroke="currentColor" strokeWidth="1.5" opacity="0.65" />
      <line x1="2" y1="17" x2="24" y2="17" stroke="currentColor" strokeWidth="1.5" opacity="0.65" />
      {/* Players on top rod */}
      <circle cx="8" cy="9" r="2.8" fill="currentColor" />
      <circle cx="18" cy="9" r="2.8" fill="currentColor" />
      {/* Players on bottom rod */}
      <circle cx="8" cy="17" r="2.8" fill="white" opacity="0.7" />
      <circle cx="18" cy="17" r="2.8" fill="white" opacity="0.7" />
      {/* Ball */}
      <circle cx="13" cy="13" r="2.2" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function StationTypeIcon({ type, size = 42 }: { type: StationType; size?: number }) {
  return (
    <div
      className={cn(
        "rounded-xl flex items-center justify-center shrink-0",
        stationIconBg[type],
        stationIconColor[type]
      )}
      style={{ width: size, height: size }}
    >
      {type === "pool" && <PoolBallIcon />}
      {type === "gaming" && <GameControllerIcon />}
      {type === "foosball" && <FoosballTableIcon />}
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────────────────────── */

type StatusState = "active" | "paused" | "available";

function StatusBadge({ status, id }: { status: StatusState; id: string }) {
  return (
    <div className="flex items-center gap-1.5" data-testid={`badge-status-${id}`}>
      <span
        className={cn(
          "w-2 h-2 rounded-full",
          status === "active" && "bg-chart-3 animate-pulse",
          status === "paused" && "bg-chart-4",
          status === "available" && "bg-muted-foreground/40"
        )}
      />
      <span
        className={cn(
          "text-xs font-medium",
          status === "active" && "text-chart-3",
          status === "paused" && "text-chart-4",
          status === "available" && "text-muted-foreground"
        )}
      >
        {status === "active" ? "Live" : status === "paused" ? "Paused" : "Idle"}
      </span>
    </div>
  );
}

/* ─── Station Card ───────────────────────────────────────────────── */

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
  customerName,
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

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const formatRate = (val: number | string | undefined) => {
    if (val === undefined || val === null) return "—";
    const n = typeof val === "string" ? Number(val) : val;
    if (!Number.isFinite(n)) return "—";
    return formatCurrency(n);
  };

  const formatStartTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const showCurrentRateOnly = isActive && !!currentPricingTier;
  const currentRate = currentPricingTier === "solo" ? rateSoloHourly : rateGroupHourly;
  const currentTierLabel = currentPricingTier === "solo" ? "Solo" : "Group";
  const statusState: StatusState = !isActive ? "available" : isPaused ? "paused" : "active";

  return (
    <Card
      className={cn(
        "border-l-4 hover-elevate cursor-pointer transition-all",
        stationLeftBorder[type],
        isActive && !isPaused && "ring-1 ring-chart-3/30",
        isActive && isPaused && "ring-1 ring-chart-4/30",
        !isActive && "opacity-75",
        isDragOver && "ring-2 ring-primary"
      )}
      onClick={onClick}
      data-testid={`card-station-${id}`}
      {...dropZoneProps}
    >
      <div className="p-4 space-y-3">
        {/* Drag handle */}
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

        {/* Header: illustrated icon + name/badge + status/actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <StationTypeIcon type={type} />
            <div className="min-w-0">
              <h3
                className="text-sm font-semibold leading-tight truncate"
                data-testid={`text-station-name-${id}`}
              >
                {name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn("text-xs", stationBadgeColors[type])}
                  data-testid={`badge-station-type-${id}`}
                >
                  {type === "pool" ? "Pool" : type === "gaming" ? "Gaming" : "Foosball"}
                </Badge>
                {showCurrentRateOnly && (
                  <span
                    className="text-xs text-muted-foreground"
                    data-testid={`text-rate-current-${id}`}
                  >
                    {currentTierLabel} · {formatRate(currentRate)}/hr
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={statusState} id={id} />
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
                disabled={!onEdit}
                aria-label="Edit station"
                data-testid={`button-edit-${id}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                disabled={!onDelete}
                aria-label="Delete station"
                data-testid={`button-delete-${id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="border-t border-border/40" />

        {/* Body: live session data or idle rate grid */}
        {isActive ? (
          <div className="space-y-3">
            {/* Timer + charge centered */}
            <div className="text-center space-y-1">
              {customerName && (
                <div className="text-base font-semibold text-foreground" data-testid={`text-customer-name-${id}`}>
                  {customerName}
                </div>
              )}
              {startTime && (
                <div className="text-xs text-muted-foreground" data-testid={`text-start-time-${id}`}>
                  Started {formatStartTime(startTime)}
                </div>
              )}
              <div className="flex items-center justify-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span
                  className="text-2xl font-mono font-bold text-foreground leading-none"
                  data-testid={`text-timer-${id}`}
                >
                  {formatTime(timeElapsed)}
                </span>
              </div>
              <div>
                <span
                  className="text-xl font-mono font-semibold text-primary"
                  data-testid={`text-charge-${id}`}
                >
                  {formatCurrency(currentCharge)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
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
          <div className="space-y-3">
            {/* Rate grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="text-center py-2 rounded-lg bg-muted/30">
                <div className="text-xs text-muted-foreground mb-0.5">Solo/hr</div>
                <div
                  className="text-base font-mono font-semibold text-foreground"
                  data-testid={`text-rate-solo-${id}`}
                >
                  {formatRate(rateSoloHourly)}
                </div>
              </div>
              <div className="text-center py-2 rounded-lg bg-muted/30">
                <div className="text-xs text-muted-foreground mb-0.5">Group/hr</div>
                <div
                  className="text-base font-mono font-semibold text-foreground"
                  data-testid={`text-rate-group-${id}`}
                >
                  {formatRate(rateGroupHourly)}
                </div>
              </div>
            </div>

            {/* Start button */}
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
          </div>
        )}
      </div>
    </Card>
  );
}
