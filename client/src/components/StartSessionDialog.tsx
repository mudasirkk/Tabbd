import { useState } from "react";
import { Clock, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StartSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stationName: string;
  rateSoloHourly?: number | string;
  rateGroupHourly?: number | string;
  onConfirmStart: (customStartTime: number, pricingTier: "solo" | "group", customerName?: string) => void;
}

export function StartSessionDialog({
  open,
  onOpenChange,
  stationName,
  rateSoloHourly,
  rateGroupHourly,
  onConfirmStart,
}: StartSessionDialogProps) {
  const defaultTime = new Date().toTimeString().slice(0, 5); // HH:MM format
  const [customTime, setCustomTime] = useState(defaultTime);
  const [pricingTier, setPricingTier] = useState<"solo" | "group">("solo");
  const [customerName, setCustomerName] = useState("");

  const formatRate = (val: number | string | undefined) => {
    if (val === undefined || val === null) return "—";
    const n = typeof val === "string" ? Number(val) : val;
    if (!Number.isFinite(n)) return "—";
    return `$${n.toFixed(2)}`;
  };

  const selectedRate = pricingTier === "group" ? rateGroupHourly : rateSoloHourly;

  const handleConfirm = () => {
    const [hours, minutes] = customTime.split(':').map(Number);
    const now = new Date();
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);

    // If the time is in the future, assume it was yesterday
    if (startDate > now) {
      startDate.setDate(startDate.getDate() - 1);
    }
    
    onConfirmStart(startDate.getTime(), pricingTier, customerName.trim() || undefined);
    onOpenChange(false);
    setCustomTime(defaultTime); // Reset for next time
    setPricingTier("solo");
    setCustomerName("");
  };

  const handleUseCurrentTime = () => {
    onConfirmStart(Date.now(), pricingTier, customerName.trim() || undefined);
    onOpenChange(false);
    setCustomTime(defaultTime);
    setPricingTier("solo");
    setCustomerName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-start-session">
        <DialogHeader>
          <DialogTitle className="text-2xl" data-testid="text-start-session-title">
            Start Session - {stationName}
          </DialogTitle>
          <DialogDescription>
            Set the start time for this session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customer-name" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer Name
            </Label>
            <Input
              id="customer-name"
              type="text"
              placeholder="Optional - e.g., John"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              data-testid="input-customer-name"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">
              Associate this session with a customer (optional)
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">Pricing Tier</Label>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={pricingTier === "solo" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPricingTier("solo")}
                data-testid="button-tier-solo"
              >
                Solo
              </Button>

              <Button
                type="button"
                variant={pricingTier === "group" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPricingTier("group")}
                data-testid="button-tier-group"
              >
                Group
              </Button>
            </div>

            <p className="text-xs text-muted-foreground" data-testid="text-selected-rate">
              Selected rate: {formatRate(selectedRate)} / hr
            </p>
          </div>


          <div className="space-y-2">
            <Label htmlFor="start-time" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Start Time
            </Label>
            <Input
              id="start-time"
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              data-testid="input-start-time"
              className="font-mono text-lg"
            />
            <p className="text-xs text-muted-foreground">
              Current time: {new Date().toTimeString().slice(0, 5)}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleUseCurrentTime}
            data-testid="button-use-current-time"
            className="w-full sm:w-auto"
          >
            Use Current Time
          </Button>
          <Button
            onClick={handleConfirm}
            data-testid="button-confirm-start"
            className="w-full sm:w-auto"
          >
            Start Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
