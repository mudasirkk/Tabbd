import { useState } from "react";
import { Clock } from "lucide-react";
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
  onConfirmStart: (customStartTime: number) => void;
}

export function StartSessionDialog({
  open,
  onOpenChange,
  stationName,
  onConfirmStart,
}: StartSessionDialogProps) {
  const now = new Date();
  const defaultTime = now.toTimeString().slice(0, 5); // HH:MM format
  const [customTime, setCustomTime] = useState(defaultTime);

  const handleConfirm = () => {
    const [hours, minutes] = customTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    // If the time is in the future, assume it was yesterday
    if (startDate > now) {
      startDate.setDate(startDate.getDate() - 1);
    }
    
    onConfirmStart(startDate.getTime());
    onOpenChange(false);
    setCustomTime(defaultTime); // Reset for next time
  };

  const handleUseCurrentTime = () => {
    onConfirmStart(Date.now());
    onOpenChange(false);
    setCustomTime(defaultTime);
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
              Current time: {defaultTime}
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
