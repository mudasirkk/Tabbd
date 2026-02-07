import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StationType = "pool" | "gaming" | "foosball";

export interface SetupStationPayload {
  name: string;
  stationType: StationType;
  rateSoloHourly: string;   // send as "0.00"
  rateGroupHourly: string;  // send as "0.00"
  isEnabled: boolean;
}

interface SetupStationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (payload: SetupStationPayload) => Promise<void> | void;
}

export function SetupStationDialog({
  open,
  onOpenChange,
  onCreate,
}: SetupStationDialogProps) {
  const [name, setName] = useState("");
  const [stationType, setStationType] = useState<StationType>("pool");
  const [rateSoloHourly, setRateSoloHourly] = useState("0.00");
  const [rateGroupHourly, setRateGroupHourly] = useState("0.00");
  const [isEnabled, setIsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const isPoolOrFoosball = stationType === "pool" || stationType === "foosball";

  // Reset form whenever dialog opens (fresh setup each time)
  useEffect(() => {
    if (!open) return;
    setName("");
    setStationType("pool");
    setRateSoloHourly("0.00");
    setRateGroupHourly("0.00");
    setIsEnabled(true);
    setSaving(false);
  }, [open]);

  useEffect(() => {
    if (!isPoolOrFoosball) {
      setRateGroupHourly(rateSoloHourly);
    }
  }, [isPoolOrFoosball, rateSoloHourly]);

  const canCreate = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return false;

    const solo = Number(rateSoloHourly);
    const group = Number(rateGroupHourly);

    if (!Number.isFinite(solo) || solo < 0) return false;

    // Only validate group rate when station supports group pricing
    if (isPoolOrFoosball) {
      if (!Number.isFinite(group) || group < 0) return false;
    }

    return true;
  }, [name, rateSoloHourly, rateGroupHourly, isPoolOrFoosball]);

  async function handleCreate() {
    const trimmed = name.trim();
    const solo = Number(rateSoloHourly);
    const group = Number(rateGroupHourly);

    if (!trimmed) return;
    if (!Number.isFinite(solo) || solo < 0) return;

    // Only enforce group validity when pool/foosball
    if (isPoolOrFoosball) {
      if (!Number.isFinite(group) || group < 0) return;
    }

    try {
      setSaving(true);
      await onCreate({
        name: trimmed,
        stationType,
        rateSoloHourly: solo.toFixed(2),
        rateGroupHourly: (isPoolOrFoosball ? group : solo).toFixed(2),
        isEnabled,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-setup-station">
        <DialogHeader>
          <DialogTitle>Setup Station</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Station name"
              data-testid="input-setup-station-name"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Type</label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={stationType === "pool" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setStationType("pool")}
              >
                Pool
              </Button>
              <Button
                type="button"
                variant={stationType === "gaming" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setStationType("gaming")}
              >
                Gaming
              </Button>
              <Button
                type="button"
                variant={stationType === "foosball" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setStationType("foosball")}
              >
                Foosball
              </Button>
            </div>
          </div>

          {isPoolOrFoosball ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Solo / hr</label>
                <Input
                  value={rateSoloHourly}
                  onChange={(e) => setRateSoloHourly(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Group / hr</label>
                <Input
                  value={rateGroupHourly}
                  onChange={(e) => setRateGroupHourly(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-sm font-medium">Flat Rate / hr</label>
              <Input
                value={rateSoloHourly}
                onChange={(e) => setRateSoloHourly(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-xs text-muted-foreground">
                This station type uses a single rate.
              </p>
            </div>
          )}


          <div className="flex items-center justify-between border rounded-md p-3 gap-3">
            <div>
              <div className="text-sm font-medium">Enabled</div>
              <div className="text-xs text-muted-foreground">
                Disabled stations won’t be startable.
              </div>
            </div>
            <Button
              type="button"
              variant={isEnabled ? "default" : "outline"}
              onClick={() => setIsEnabled((v) => !v)}
            >
              {isEnabled ? "Enabled" : "Disabled"}
            </Button>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate || saving}>
            Create Station
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
