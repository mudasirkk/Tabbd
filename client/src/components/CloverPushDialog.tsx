import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth, postWithAuth } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  price: string | number;
  category: string;
  isActive: boolean;
}

interface PushResult {
  pushed: number;
  created: number;
  updated: number;
  errors: { itemId: string; message: string }[];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CloverPushDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function toNumber(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = "confirm" | "pushing" | "done";

export default function CloverPushDialog({ open, onOpenChange }: CloverPushDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("confirm");
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Re-use the existing menu query (cache-friendly, no duplicate fetch)
  const { data: items, isLoading: menuLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: () => fetchWithAuth<MenuItem[]>("/api/menu"),
    enabled: open,
  });

  // Select all items when menu loads
  const itemIds = items?.map((i) => i.id) ?? [];
  const allSelected = itemIds.length > 0 && selected.size === itemIds.length;
  const noneSelected = selected.size === 0;

  // Reset step and selection when dialog opens/closes
  function handleOpenChange(next: boolean) {
    if (!next) {
      setStep("confirm");
      setPushResult(null);
    } else if (items) {
      setSelected(new Set(items.map((i) => i.id)));
    }
    onOpenChange(next);
  }

  // Pre-select all when items first load
  if (items && selected.size === 0 && step === "confirm" && open) {
    const ids = new Set(items.map((i) => i.id));
    if (ids.size > 0 && selected.size !== ids.size) {
      setSelected(ids);
    }
  }

  function toggleItem(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (items) setSelected(new Set(items.map((i) => i.id)));
  }

  function unselectAll() {
    setSelected(new Set());
  }

  async function pushToClover() {
    setStep("pushing");
    try {
      const result = await postWithAuth<PushResult>("/api/clover/push", {
        itemIds: Array.from(selected),
      });
      setPushResult(result);
      setStep("done");
      await qc.invalidateQueries({ queryKey: ["menu"] });
      toast({
        title: "Push complete",
        description: `${result.pushed} item${result.pushed !== 1 ? "s" : ""} pushed to Clover.`,
      });
    } catch (e: any) {
      toast({
        title: "Push failed",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
      handleOpenChange(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderConfirm() {
    const totalCount = items?.length ?? 0;
    const selectedCount = selected.size;

    return (
      <div className="space-y-4">
        {menuLoading ? (
          <div className="flex gap-1.5 justify-center py-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </div>
        ) : (
          <>
            <div className="rounded-md bg-muted/50 border border-border/60 p-4 space-y-2">
              <p className="text-sm font-semibold">
                Push{" "}
                <span className="font-mono text-primary">{selectedCount}</span>{" "}
                of {totalCount} menu {totalCount === 1 ? "item" : "items"} to Clover?
              </p>
              <p className="text-xs text-muted-foreground">
                Items with a Clover ID will be updated. New items will be created on Clover.
              </p>
            </div>

            {totalCount > 0 && items && (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-muted-foreground">
                    {selectedCount} of {totalCount} selected
                  </p>
                  <button
                    type="button"
                    onClick={allSelected ? unselectAll : selectAll}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    {allSelected ? "Unselect All" : "Select All"}
                  </button>
                </div>
                <ScrollArea className="h-48 rounded-md border border-border/60">
                  <div className="p-3 space-y-1">
                    {items.map((item) => {
                      const checked = selected.has(item.id);
                      return (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 py-1.5 px-1 rounded-md hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItem(item.id)}
                            className="accent-primary w-4 h-4 shrink-0"
                          />
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={[
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                item.isActive ? "bg-chart-3" : "bg-muted-foreground/40",
                              ].join(" ")}
                            />
                            <p className="text-sm truncate">{item.name}</p>
                          </div>
                          <span className="font-mono text-sm text-primary shrink-0">
                            ${toNumber(item.price).toFixed(2)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={pushToClover} disabled={selectedCount === 0}>
                Push Selected ({selectedCount})
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderPushing() {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </div>
        <p className="text-sm text-muted-foreground">Pushing items to Clover...</p>
      </div>
    );
  }

  function renderDone() {
    if (!pushResult) return null;

    const hasErrors = pushResult.errors.length > 0;

    return (
      <div className="space-y-4">
        <div className="rounded-md bg-chart-3/10 border border-chart-3/30 p-4 space-y-1">
          <p className="text-sm font-semibold text-chart-3">Push complete</p>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{pushResult.pushed}</span>{" "}
            {pushResult.pushed === 1 ? "item" : "items"} pushed:{" "}
            <span className="font-semibold text-foreground">{pushResult.created}</span> created,{" "}
            <span className="font-semibold text-foreground">{pushResult.updated}</span> updated.
          </p>
        </div>

        {hasErrors && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4 space-y-2">
            <p className="text-xs font-semibold text-destructive uppercase tracking-widest">
              Errors ({pushResult.errors.length})
            </p>
            <ScrollArea className="max-h-32">
              <div className="space-y-1.5">
                {pushResult.errors.map((err, idx) => (
                  <div key={idx} className="text-xs space-y-0.5">
                    <p className="font-medium text-foreground/80">{err.itemId}</p>
                    <p className="text-destructive/80">{err.message}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button onClick={() => handleOpenChange(false)}>Close</Button>
        </div>
      </div>
    );
  }

  function getTitle(): string {
    if (step === "pushing") return "Pushing to Clover…";
    if (step === "done") return "Push Complete";
    return "Push to Clover";
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        {step === "confirm" && renderConfirm()}
        {step === "pushing" && renderPushing()}
        {step === "done" && renderDone()}
      </DialogContent>
    </Dialog>
  );
}
