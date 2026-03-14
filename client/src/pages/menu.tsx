import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/lib/useAuthReady";
import { fetchWithAuth, postWithAuth, patchWithAuth, deleteWithAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTheme } from "@/hooks/useTheme";
import { Skeleton } from "@/components/ui/skeleton";
import { Moon, Sun, ArrowLeft, Package, Pencil, Trash2, Search, X } from "lucide-react";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: string | number;
  stockQty: number;
  isActive: boolean;
  isVariablePrice: boolean;
  updatedAt: string;
};

function toNumber(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

export default function MenuManagementPage() {
  const { ready: authReady, user } = useAuthReady();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!authReady) return;
    if (!user) window.location.replace("/signin");
  }, [authReady, user]);

  const { data: items, isLoading, error } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: () => fetchWithAuth<MenuItem[]>("/api/menu"),
    retry: false,
    enabled: authReady && !!user,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [menuSearch, setMenuSearch] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Miscellaneous");
  const [price, setPrice] = useState<string>("0");
  const [stockQty, setStockQty] = useState<string>("0");
  const [isActive, setIsActive] = useState(true);
  const [isVariablePrice, setIsVariablePrice] = useState(false);

  const grouped = useMemo(() => {
    const list = items ?? [];
    const searchLower = menuSearch.trim().toLowerCase();
    const filtered = searchLower
      ? list.filter((it) => it.name.toLowerCase().includes(searchLower))
      : list;
    const groups = new Map<string, MenuItem[]>();

    for (const it of filtered) {
      const cat = (it.category ?? "").trim() || "Miscellaneous";
      const arr = groups.get(cat) ?? [];
      arr.push(it);
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
  }, [items, menuSearch]);

  function resetForm() {
    setName("");
    setDescription("");
    setCategory("Miscellaneous");
    setPrice("0");
    setStockQty("0");
    setIsActive(true);
    setIsVariablePrice(false);
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setName(item.name);
    setDescription(item.description ?? "");
    setCategory(item.category?.trim() ? item.category : "Miscellaneous");
    setPrice(String(toNumber(item.price).toFixed(2)));
    setStockQty(String(item.stockQty ?? 0));
    setIsActive(!!item.isActive);
    setIsVariablePrice(!!item.isVariablePrice);
    setOpen(true);
  }

  async function save() {
    const trimmed = name.trim();
    const p = Number(price);
    const q = isVariablePrice ? 0 : Number(stockQty);

    if (!trimmed) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      toast({ title: "Price must be a valid number", variant: "destructive" });
      return;
    }
    if (!isVariablePrice && (!Number.isInteger(q) || q < 0)) {
      toast({ title: "Stock must be a whole number (0+)", variant: "destructive" });
      return;
    }

    try {
      if (!editing) {
        await postWithAuth("/api/menu", {
          name: trimmed,
          description: description.trim() ? description.trim() : null,
          category: category.trim() ? category.trim() : "Miscellaneous",
          price: p.toFixed(2),
          stockQty: q,
          isActive,
          isVariablePrice,
        });
        toast({ title: "Item created" });
      } else {
        await patchWithAuth(`/api/menu/${editing.id}`, {
          name: trimmed,
          description: description.trim() ? description.trim() : null,
          category: category.trim() ? category.trim() : "Miscellaneous",
          price: p.toFixed(2),
          stockQty: q,
          isActive,
          isVariablePrice,
        });
        toast({ title: "Item updated" });
      }

      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["menu"] });
      await qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      toast({
        title: "Failed to save",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }

  async function remove(item: MenuItem) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await deleteWithAuth(`/api/menu/${item.id}`);
      toast({ title: "Item deleted" });
      await qc.invalidateQueries({ queryKey: ["menu"] });
      await qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      toast({
        title: "Failed to delete",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }

  if (!authReady || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/50 px-4 py-3">
          <div className="container mx-auto max-w-screen-xl flex items-center justify-between">
            <Skeleton className="h-8 w-24" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>
        <div className="container mx-auto max-w-screen-xl px-4 py-6 space-y-8">
          {[1, 2].map((g) => (
            <div key={g} className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-36 rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 max-w-lg w-full space-y-3">
          <h2 className="text-lg font-semibold">Couldn&apos;t load menu</h2>
          <p className="text-sm text-muted-foreground">
            Please refresh. If this keeps happening, sign out and sign back in.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>Refresh</Button>
            <Button onClick={() => window.location.replace("/signin")}>Go to Sign in</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <div className="container mx-auto max-w-screen-xl px-4 py-3 flex justify-between items-center gap-4">
          <h1 className="text-3xl font-bold font-display leading-tight">Menu</h1>
          <div className="flex items-center gap-1.5">
            <Button onClick={openCreate} size="sm">Add Item</Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.assign("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-screen-xl px-4 py-6">
        {/* Search bar */}
        {(items ?? []).length > 0 && (
          <div className="mb-5 relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search menu items..."
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              className="h-9 pl-9 pr-8 text-sm"
            />
            {menuSearch && (
              <button
                type="button"
                onClick={() => setMenuSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-card/30 p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
              {menuSearch ? <Search className="w-7 h-7 text-muted-foreground" /> : <Package className="w-7 h-7 text-muted-foreground" />}
            </div>
            <p className="font-medium text-foreground/60">
              {menuSearch ? "No items match your search" : "No menu items yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {menuSearch ? "Try a different search term." : "Click \"Add Item\" to create your first one."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <div key={group.category} className="space-y-3">
                <div className="flex items-center gap-2 border-l-2 border-primary/40 pl-3">
                  <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.category}
                  </p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {group.items.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {group.items.map((it) => (
                    <Card key={it.id} className="border-t-2 border-t-primary/40 p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold leading-tight">{it.name}</h3>
                          {it.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {it.description}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-lg font-mono font-bold text-primary">
                            ${toNumber(it.price).toFixed(2)}
                          </div>
                          {it.isVariablePrice ? (
                            <div className="text-xs text-primary font-medium">Variable Price</div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Stock:{" "}
                              <span className="font-medium text-foreground/80">{it.stockQty ?? 0}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              className={[
                                "w-1.5 h-1.5 rounded-full",
                                it.isActive ? "bg-chart-3" : "bg-muted-foreground/40",
                              ].join(" ")}
                            />
                            <span className="text-xs text-muted-foreground">
                              {it.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 border-t border-border/40 pt-3">
                        <Button variant="outline" className="flex-1" size="sm" onClick={() => openEdit(it)}>
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          size="sm"
                          onClick={() => remove(it)}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Red Bull" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Category</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Drinks"
              />
              <p className="text-xs text-muted-foreground">Default: Miscellaneous</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {isVariablePrice ? "Default Variable Price" : "Price"}
                </label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Stock Qty</label>
                {isVariablePrice ? (
                  <Input value="VARIABLE" disabled className="text-primary font-medium" />
                ) : (
                  <Input value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border border-border/60 rounded-md p-3 gap-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Inactive items won&apos;t show in Add Items.</div>
              </div>
              <Button
                type="button"
                variant={isActive ? "default" : "outline"}
                onClick={() => setIsActive((v) => !v)}
              >
                {isActive ? "Active" : "Inactive"}
              </Button>
            </div>

            <div className="flex items-center justify-between border border-border/60 rounded-md p-3 gap-3">
              <div>
                <div className="text-sm font-medium">Variable Price</div>
                <div className="text-xs text-muted-foreground">Operator sets custom name and price when adding to a session.</div>
              </div>
              <Button
                type="button"
                variant={isVariablePrice ? "default" : "outline"}
                onClick={() => setIsVariablePrice((v) => !v)}
              >
                {isVariablePrice ? "Yes" : "No"}
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
