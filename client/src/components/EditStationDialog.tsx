import { useEffect, useMemo, useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { PoolBallIcon, GameControllerIcon, FoosballTableIcon } from "@/components/StationCard";

type StationType = "pool" | "gaming" | "foosball";

export interface EditStationDialogStation {
    id: string;
    name: string;
    stationType: StationType;
    rateSoloHourly: string | number;
    rateGroupHourly: string | number;
    isEnabled: boolean;
}

const stationIconColor: Record<StationType, string> = {
    pool: "text-chart-1",
    gaming: "text-chart-2",
    foosball: "text-chart-3",
};

interface EditStationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    station: EditStationDialogStation | null;
    onSave: (patch: {
        id: string;
        name: string;
        stationType: StationType;
        rateSoloHourly: string;
        rateGroupHourly: string;
        isEnabled: boolean;
    }) => Promise<void> | void;
    onDelete?: (station: EditStationDialogStation) => void;
}

function toNumber(v: string | number | null | undefined): number {
    if (v === null || v === undefined) return 0;
    return typeof v === "number" ? v : Number(v);
}

export function EditStationDialog({
open,
onOpenChange,
station,
onSave,
onDelete,
}: EditStationDialogProps) {
const [name, setName] = useState("");
const [stationType, setStationType] = useState<StationType>("pool");
const [rateSoloHourly, setRateSoloHourly] = useState("0.00");
const [rateGroupHourly, setRateGroupHourly] = useState("0.00");
const [isEnabled, setIsEnabled] = useState(true);
const [saving, setSaving] = useState(false);


// hydrate form when dialog opens / station changes
useEffect(() => {
    if (!station) return;
    setName(station.name ?? "");
    setStationType(station.stationType ?? "pool");
    setRateSoloHourly(toNumber(station.rateSoloHourly).toFixed(2));
    setRateGroupHourly(toNumber(station.rateGroupHourly).toFixed(2));
    setIsEnabled(!!station.isEnabled);
}, [station]);

const canSave = useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return false;

    const solo = Number(rateSoloHourly);
    const group = Number(rateGroupHourly);

    if (!Number.isFinite(solo) || solo < 0) return false;
    if (!Number.isFinite(group) || group < 0) return false;


    return true;
}, [name, rateSoloHourly, rateGroupHourly]);

async function handleSave() {
    if (!station) return;

    const trimmed = name.trim();
    const solo = Number(rateSoloHourly);
    const group = Number(rateGroupHourly);

    if (!trimmed) return;
    if (!Number.isFinite(solo) || solo < 0) return;
    if (!Number.isFinite(group) || group < 0) return;

    try {
    setSaving(true);
    await onSave({
        id: station.id,
        name: trimmed,
        stationType,
        rateSoloHourly: solo.toFixed(2),
        rateGroupHourly: group.toFixed(2),
        isEnabled,
    });
    onOpenChange(false);
    } finally {
    setSaving(false);
    }
}

return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg" data-testid="dialog-edit-station">
        <DialogHeader>
        <DialogTitle>Edit Station</DialogTitle>
        <DialogDescription>Update this station's name, type, and pricing.</DialogDescription>
        </DialogHeader>

        {!station ? (
        <div className="text-sm text-muted-foreground">No station selected.</div>
        ) : (
        <div className="space-y-4">
            <div className="space-y-1">
            <label className="text-sm font-medium">Name</label>
            <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Station name"
                data-testid="input-station-name"
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
                data-testid="button-type-pool"
                >
                <span className={stationType === "pool" ? "" : stationIconColor.pool}><PoolBallIcon /></span>
                Pool
                </Button>
                <Button
                type="button"
                variant={stationType === "gaming" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setStationType("gaming")}
                data-testid="button-type-gaming"
                >
                <span className={stationType === "gaming" ? "" : stationIconColor.gaming}><GameControllerIcon /></span>
                Gaming
                </Button>
                <Button
                type="button"
                variant={stationType === "foosball" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setStationType("foosball")}
                data-testid="button-type-foosball"
                >
                <span className={stationType === "foosball" ? "" : stationIconColor.foosball}><FoosballTableIcon /></span>
                Foosball
                </Button>
            </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                <label className="text-sm font-medium">Solo / hr</label>
                <Input
                    value={rateSoloHourly}
                    onChange={(e) => setRateSoloHourly(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-rate-solo"
                />
                </div>

                <div className="space-y-1">
                <label className="text-sm font-medium">Group / hr</label>
                <Input
                    value={rateGroupHourly}
                    onChange={(e) => setRateGroupHourly(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-rate-group"
                />
                </div>
            </div>


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
                data-testid="button-toggle-enabled"
            >
                {isEnabled ? "Enabled" : "Disabled"}
            </Button>
            </div>
        </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
        {station && onDelete && (
            <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:mr-auto"
                onClick={() => {
                    onOpenChange(false);
                    onDelete(station);
                }}
                disabled={saving}
                data-testid="button-delete-station-from-edit"
            >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Delete Station
            </Button>
        )}
        <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
        >
            Cancel
        </Button>
        <Button onClick={handleSave} disabled={!station || !canSave || saving}>
            Save
        </Button>
        </DialogFooter>
    </DialogContent>
    </Dialog>
);
}
