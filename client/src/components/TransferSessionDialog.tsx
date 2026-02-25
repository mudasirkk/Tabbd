import { ArrowRightLeft } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { StationType } from "./StationCard";

interface Station {
  id: string;
  name: string;
  stationType: StationType;
}

interface TransferSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStationName: string;
  availableStations: Station[];
  currentPricingTier: "solo" | "group";
  onConfirmTransfer: (payload: {
    destinationStationId: string;
    endingPricingTier: "solo" | "group";
    nextPricingTier: "solo" | "group";
  }) => void;
}

const stationTypeLabels = {
  pool: "Pool Tables",
  gaming: "Gaming Stations",
  foosball: "Foosball Tables",
};

const stationColors = {
  pool: "border-l-chart-1",
  gaming: "border-l-chart-2",
  foosball: "border-l-chart-3",
};

export function TransferSessionDialog({
  open,
  onOpenChange,
  currentStationName,
  availableStations,
  currentPricingTier,
  onConfirmTransfer,
}: TransferSessionDialogProps) {
  const groupedStations = availableStations.reduce((acc, station) => {
    if (!acc[station.stationType]) {
      acc[station.stationType] = [];
    }
    acc[station.stationType].push(station);
    return acc;
  }, {} as Record<StationType, Station[]>);

  const [endingPricingTier, setEndingPricingTier] =
    useState<"solo" | "group">(currentPricingTier);
  const [nextPricingTier, setNextPricingTier] =
    useState<"solo" | "group">(currentPricingTier);

  useEffect(() => {
    if (!open) return;
    setEndingPricingTier(currentPricingTier);
    setNextPricingTier(currentPricingTier);
  }, [currentPricingTier, open]);

  const handleTransfer = (stationId: string) => {
    onConfirmTransfer({
      destinationStationId: stationId,
      endingPricingTier,
      nextPricingTier,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-transfer-session">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2" data-testid="text-transfer-title">
            <ArrowRightLeft className="w-6 h-6" />
            Transfer Session
          </DialogTitle>
          <DialogDescription>
            Transfer from <span className="font-semibold text-foreground">{currentStationName}</span> to another available station
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Ending Segment Tier</Label>
            <Select value={endingPricingTier} onValueChange={(v: "solo" | "group") => setEndingPricingTier(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">Solo</SelectItem>
                <SelectItem value="group">Group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Next Segment Tier</Label>
            <Select value={nextPricingTier} onValueChange={(v: "solo" | "group") => setNextPricingTier(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">Solo</SelectItem>
                <SelectItem value="group">Group</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4 py-2">
            {Object.keys(groupedStations).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No available stations to transfer to
              </div>
            ) : (
              Object.entries(groupedStations).map(([type, stations]) => (
                <div key={type} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {stationTypeLabels[type as StationType]}
                  </h3>
                  <div className="space-y-2">
                    {stations.map((station) => (
                      <Button
                        key={station.id}
                        variant="outline"
                        className={cn(
                          "w-full justify-start gap-3 h-auto py-3 hover-elevate border-l-4",
                          stationColors[station.stationType]
                        )}
                        onClick={() => handleTransfer(station.id)}
                        data-testid={`button-transfer-to-${station.id}`}
                      >
                        <div className="flex-1 text-left">
                          <p className="font-semibold">{station.name}</p>
                        </div>
                        <Badge variant="secondary" className="ml-auto">
                          Available
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
