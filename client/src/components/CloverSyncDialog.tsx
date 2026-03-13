import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth, postWithAuth } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

// ─── API types (must match server response shapes) ──────────────────────────

interface CloverCategory {
  id: string;
  name: string;
}

interface CloverItem {
  id: string;
  name: string;
  price: number; // cents
  alternateName?: string | null;
  sku?: string | null;
  stockCount?: number;
  categories?: { elements: CloverCategory[] };
}

interface FieldDiff {
  field: string;
  tabbdValue: unknown;
  cloverValue: unknown;
}

interface ChangedItem {
  cloverItem: CloverItem;
  tabbdItemId?: string;
  diffs?: FieldDiff[];
}

interface DeletedItem {
  id: string;
  name: string;
}

interface SyncPreviewResponse {
  newItems: CloverItem[];
  changedItems: ChangedItem[];
  deletedItems: DeletedItem[];
  unchangedItems: ChangedItem[];
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CloverSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

type Step = "loading" | "preview" | "applying" | "done";
type MergeMode = "replace" | "merge";

export default function CloverSyncDialog({ open, onOpenChange }: CloverSyncDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SyncPreviewResponse | null>(null);

  // first-time import: which new-item cloverItemIds are checked
  const [firstTimeSelected, setFirstTimeSelected] = useState<Set<string>>(new Set());

  // existing-menu mode selection
  const [mergeMode, setMergeMode] = useState<MergeMode>("merge");

  // merge: new items checked set
  const [newItemsSelected, setNewItemsSelected] = useState<Set<string>>(new Set());

  // merge: conflict resolutions map: tabbdItemId → "clover" | "tabbd"
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, "clover" | "tabbd">>(
    new Map()
  );

  // merge: which deleted items are checked for deletion
  const [deletedSelected, setDeletedSelected] = useState<Set<string>>(new Set());

  // ── Fetch preview when dialog opens ──────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    // reset all state when dialog opens
    setStep("loading");
    setLoadError(null);
    setPreview(null);
    setFirstTimeSelected(new Set());
    setMergeMode("merge");
    setNewItemsSelected(new Set());
    setConflictResolutions(new Map());
    setDeletedSelected(new Set());

    (async () => {
      try {
        const data = await postWithAuth<SyncPreviewResponse>("/api/clover/sync/preview");
        setPreview(data);

        // pre-select all new items by default
        setFirstTimeSelected(new Set(data.newItems.map((i) => i.id)));
        setNewItemsSelected(new Set(data.newItems.map((i) => i.id)));

        // default conflict resolution: use Clover for all
        const resolutions = new Map<string, "clover" | "tabbd">();
        for (const item of data.changedItems) {
          if (item.tabbdItemId) resolutions.set(item.tabbdItemId, "clover");
        }
        setConflictResolutions(resolutions);

        // deleted items default NOT selected
        setDeletedSelected(new Set());

        setStep("preview");
      } catch (e: any) {
        setLoadError(e?.message ?? "Failed to fetch preview");
      }
    })();
  }, [open]);

  // ── Is this a first-time import? ─────────────────────────────────────────

  const isFirstTime =
    preview !== null &&
    preview.changedItems.length === 0 &&
    preview.deletedItems.length === 0 &&
    preview.unchangedItems.length === 0;

  // ── Apply sync ───────────────────────────────────────────────────────────

  async function applySync() {
    if (!preview) return;
    setStep("applying");

    try {
      if (isFirstTime || mergeMode === "replace") {
        const selectedItemIds = isFirstTime
          ? Array.from(firstTimeSelected)
          : preview.newItems.map((i) => i.id);

        await postWithAuth("/api/clover/sync/apply", {
          mode: "replace",
          selectedItemIds,
        });
      } else {
        // merge
        const resolvedConflicts = Array.from(conflictResolutions.entries()).map(
          ([tabbdItemId, action]) => ({
            tabbdItemId,
            action: action === "clover" ? "use_clover" : "keep_tabbd",
          })
        );

        await postWithAuth("/api/clover/sync/apply", {
          mode: "merge",
          selectedItemIds: Array.from(newItemsSelected),
          confirmedDeletes: Array.from(deletedSelected),
          conflictResolutions: resolvedConflicts,
        });
      }

      setStep("done");
      await qc.invalidateQueries({ queryKey: ["menu"] });
      toast({ title: "Clover sync complete", description: "Menu updated successfully." });

      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (e: any) {
      toast({
        title: "Sync failed",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
      setStep("preview");
    }
  }

  // ── Toggle helpers ───────────────────────────────────────────────────────

  function toggleFirstTime(id: string) {
    setFirstTimeSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleNewItem(id: string) {
    setNewItemsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDeleted(id: string) {
    setDeletedSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setResolution(tabbdItemId: string, action: "clover" | "tabbd") {
    setConflictResolutions((prev) => {
      const next = new Map(prev);
      next.set(tabbdItemId, action);
      return next;
    });
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderLoading() {
    if (loadError) {
      return (
        <div className="space-y-4 py-4">
          <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4">
            <p className="text-sm text-destructive font-medium">Failed to fetch preview</p>
            <p className="text-xs text-muted-foreground mt-1">{loadError}</p>
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setLoadError(null);
                setStep("loading");
                (async () => {
                  try {
                    const data = await postWithAuth<SyncPreviewResponse>("/api/clover/sync/preview");
                    setPreview(data);
                    setFirstTimeSelected(new Set(data.newItems.map((i) => i.id)));
                    setNewItemsSelected(new Set(data.newItems.map((i) => i.id)));
                    const resolutions = new Map<string, "clover" | "tabbd">();
                    for (const item of data.changedItems) {
                      if (item.tabbdItemId) resolutions.set(item.tabbdItemId, "clover");
                    }
                    setConflictResolutions(resolutions);
                    setDeletedSelected(new Set());
                    setStep("preview");
                  } catch (e: any) {
                    setLoadError(e?.message ?? "Failed to fetch preview");
                  }
                })();
              }}
            >
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 py-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </div>
          <p className="text-sm text-muted-foreground">Fetching Clover menu...</p>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      </div>
    );
  }

  function renderFirstTimeImport() {
    if (!preview) return null;
    const count = firstTimeSelected.size;

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          No existing Tabbd menu detected. Select items to import from Clover.
        </p>

        <ScrollArea className="h-72 rounded-md border border-border/60">
          <div className="p-3 space-y-1">
            {preview.newItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No items found on Clover.
              </p>
            ) : (
              preview.newItems.map((item) => {
                const checked = firstTimeSelected.has(item.id);
                const cat = item.categories?.elements?.[0]?.name ?? "Miscellaneous";
                return (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFirstTime(item.id)}
                      className="accent-primary w-4 h-4 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{cat}</p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-primary shrink-0">
                      {fmtCents(item.price)}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            {count} of {preview.newItems.length} items selected
          </p>
          <Button onClick={applySync} disabled={count === 0}>
            Import Selected ({count} {count === 1 ? "item" : "items"})
          </Button>
        </div>
      </div>
    );
  }

  function renderExistingMenu() {
    if (!preview) return null;

    const existingCount =
      preview.changedItems.length + preview.deletedItems.length + preview.unchangedItems.length;

    return (
      <div className="space-y-4">
        {/* Mode selector */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMergeMode("merge")}
            className={[
              "flex-1 py-2 rounded-md text-sm font-medium border transition-colors",
              mergeMode === "merge"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:bg-muted/50",
            ].join(" ")}
          >
            Merge
          </button>
          <button
            type="button"
            onClick={() => setMergeMode("replace")}
            className={[
              "flex-1 py-2 rounded-md text-sm font-medium border transition-colors",
              mergeMode === "replace"
                ? "bg-destructive text-destructive-foreground border-destructive"
                : "bg-transparent text-muted-foreground border-border hover:bg-muted/50",
            ].join(" ")}
          >
            Replace
          </button>
        </div>

        {mergeMode === "replace" ? renderReplace(existingCount) : renderMerge()}
      </div>
    );
  }

  function renderReplace(existingCount: number) {
    if (!preview) return null;
    return (
      <div className="space-y-4">
        <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4 space-y-1.5">
          <p className="text-sm font-semibold text-destructive">Warning: destructive action</p>
          <p className="text-sm text-muted-foreground">
            This will delete all{" "}
            <span className="font-semibold text-foreground">{existingCount}</span> existing items and
            import{" "}
            <span className="font-semibold text-foreground">{preview.newItems.length}</span> items
            from Clover. This cannot be undone.
          </p>
        </div>
        <div className="flex justify-end">
          <Button variant="destructive" onClick={applySync}>
            Replace All &amp; Import
          </Button>
        </div>
      </div>
    );
  }

  function renderMerge() {
    if (!preview) return null;

    return (
      <ScrollArea className="h-[420px]">
        <div className="space-y-4 pr-1">

          {/* New Items */}
          <details open className="group">
            <summary className="flex items-center gap-2 cursor-pointer list-none select-none py-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                New Items
              </span>
              <Badge variant="secondary">{preview.newItems.length}</Badge>
            </summary>
            {preview.newItems.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-1 pt-1">No new items.</p>
            ) : (
              <div className="mt-2 space-y-1">
                {preview.newItems.map((item) => {
                  const checked = newItemsSelected.has(item.id);
                  const cat = item.categories?.elements?.[0]?.name ?? "Miscellaneous";
                  return (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleNewItem(item.id)}
                        className="accent-primary w-4 h-4 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{cat}</p>
                      </div>
                      <span className="font-mono text-sm font-semibold text-primary shrink-0">
                        {fmtCents(item.price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </details>

          <Separator />

          {/* Changed Items */}
          <details open className="group">
            <summary className="flex items-center gap-2 cursor-pointer list-none select-none py-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Changed Items
              </span>
              <Badge variant="secondary">{preview.changedItems.length}</Badge>
            </summary>
            {preview.changedItems.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-1 pt-1">No changed items.</p>
            ) : (
              <div className="mt-2 space-y-3">
                {preview.changedItems.map((item) => {
                  const key = item.tabbdItemId ?? item.cloverItem.id;
                  const resolution = item.tabbdItemId
                    ? (conflictResolutions.get(item.tabbdItemId) ?? "clover")
                    : "clover";
                  return (
                    <div
                      key={key}
                      className="rounded-lg border border-border/60 overflow-hidden"
                    >
                      <div className="px-3 py-2 border-b border-border/40 bg-muted/30">
                        <p className="text-sm font-semibold">{item.cloverItem.name}</p>
                      </div>
                      {item.tabbdItemId ? (
                        <div className="grid grid-cols-2">
                          {/* Tabbd side */}
                          <button
                            type="button"
                            onClick={() => setResolution(item.tabbdItemId!, "tabbd")}
                            className={[
                              "p-3 text-left transition-colors border-r border-border/40 relative",
                              resolution === "tabbd"
                                ? "bg-muted/60"
                                : "bg-transparent hover:bg-muted/20",
                            ].join(" ")}
                          >
                            <p className={[
                              "text-[10px] font-semibold uppercase tracking-widest mb-2",
                              resolution === "tabbd" ? "text-foreground" : "text-muted-foreground",
                            ].join(" ")}>
                              Current (Tabbd) {resolution === "tabbd" ? " \u2713" : ""}
                            </p>
                            <div className="space-y-1.5">
                              {(item.diffs ?? []).map((diff) => (
                                <div key={diff.field}>
                                  <p className="text-[10px] text-muted-foreground capitalize">{diff.field}</p>
                                  <p className="text-xs text-foreground/80 truncate" title={String(diff.tabbdValue ?? "—")}>
                                    {String(diff.tabbdValue ?? "—")}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </button>
                          {/* Clover side */}
                          <button
                            type="button"
                            onClick={() => setResolution(item.tabbdItemId!, "clover")}
                            className={[
                              "p-3 text-left transition-colors relative",
                              resolution === "clover"
                                ? "bg-primary/10"
                                : "bg-transparent hover:bg-muted/20",
                            ].join(" ")}
                          >
                            <p className={[
                              "text-[10px] font-semibold uppercase tracking-widest mb-2",
                              resolution === "clover" ? "text-primary" : "text-muted-foreground",
                            ].join(" ")}>
                              Clover {resolution === "clover" ? " \u2713" : ""}
                            </p>
                            <div className="space-y-1.5">
                              {(item.diffs ?? []).map((diff) => (
                                <div key={diff.field}>
                                  <p className="text-[10px] text-muted-foreground capitalize">{diff.field}</p>
                                  <p className={[
                                    "text-xs truncate",
                                    resolution === "clover" ? "text-primary font-medium" : "text-foreground/80",
                                  ].join(" ")} title={String(diff.cloverValue ?? "—")}>
                                    {String(diff.cloverValue ?? "—")}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 space-y-1">
                          {(item.diffs ?? []).map((diff) => (
                            <div key={diff.field} className="flex gap-2 text-xs">
                              <span className="text-muted-foreground capitalize w-16 shrink-0">{diff.field}</span>
                              <span className="text-primary truncate">{String(diff.cloverValue ?? "—")}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </details>

          <Separator />

          {/* Items Missing from Clover */}
          <details open className="group">
            <summary className="flex items-center gap-2 cursor-pointer list-none select-none py-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Items Missing from Clover
              </span>
              <Badge variant="secondary">{preview.deletedItems.length}</Badge>
            </summary>
            {preview.deletedItems.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-1 pt-1">No items missing from Clover.</p>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-muted-foreground">
                  These items exist in Tabbd but not on Clover. Check items you want to delete.
                </p>
                {preview.deletedItems.map((item) => {
                  const checked = deletedSelected.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDeleted(item.id)}
                        className="accent-destructive w-4 h-4 shrink-0"
                      />
                      <p className="text-sm flex-1">{item.name}</p>
                      {checked && (
                        <span className="text-xs text-destructive font-medium shrink-0">
                          Will delete
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </details>

        </div>
      </ScrollArea>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  function renderContent() {
    if (step === "loading") {
      return renderLoading();
    }

    if (step === "applying") {
      return (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
          </div>
          <p className="text-sm text-muted-foreground">Applying sync...</p>
        </div>
      );
    }

    if (step === "done") {
      return (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-chart-3/20">
            <svg
              className="w-6 h-6 text-chart-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium">Sync complete!</p>
          <p className="text-xs text-muted-foreground">Your menu has been updated.</p>
        </div>
      );
    }

    // step === "preview"
    if (!preview) return null;

    if (isFirstTime) {
      return renderFirstTimeImport();
    }

    return (
      <div className="space-y-4">
        {renderExistingMenu()}
        {mergeMode === "merge" && (
          <div className="flex justify-end pt-1">
            <Button onClick={applySync}>Apply Merge</Button>
          </div>
        )}
      </div>
    );
  }

  function getTitle(): string {
    if (step === "loading") return "Import / Sync from Clover";
    if (step === "applying") return "Applying Sync…";
    if (step === "done") return "Sync Complete";
    if (!preview) return "Import / Sync from Clover";
    if (isFirstTime) return "Import from Clover";
    return "Sync with Clover";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
}
