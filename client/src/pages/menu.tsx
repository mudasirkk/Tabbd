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
import { Moon, Sun, ArrowLeft, Package } from "lucide-react";

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: string | number;
  stockQty: number;
  isActive: boolean;
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Miscellaneous");
  const [price, setPrice] = useState<string>("0");
  const [stockQty, setStockQty] = useState<string>("0");
  const [isActive, setIsActive] = useState(true);

  const grouped = useMemo(() => {
    const list = items ?? [];
    const groups = new Map<string, MenuItem[]>();

    for (const it of list) {
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
  }, [items]);

  function resetForm() {
    setName("");
    setDescription("");
    setCategory("Miscellaneous");
    setPrice("0");
    setStockQty("0");
    setIsActive(true);
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
    setOpen(true);
  }

  async function save() {
    const trimmed = name.trim();
    const p = Number(price);
    const q = Number(stockQty);

    if (!trimmed) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      toast({ title: "Price must be a valid number", variant: "destructive" });
      return;
    }
    if (!Number.isInteger(q) || q < 0) {
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

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
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
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-card/30 p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
              <Package className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground/60">No menu items yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Click &quot;Add Item&quot; to create your first one.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <div key={group.category} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {group.category}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {group.items.map((it) => (
                    <Card key={it.id} className="border-t-2 border-t-primary/40 p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold leading-tight">{it.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {it.description || "No description"}
                          </p>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <div className="text-lg font-mono font-bold text-primary">
                            ${toNumber(it.price).toFixed(2)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Stock:{" "}
                            <span className="font-medium text-foreground/80">{it.stockQty ?? 0}</span>
                          </div>
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
                          Edit
                        </Button>
                        <Button variant="destructive" className="flex-1" size="sm" onClick={() => remove(it)}>
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
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Price</label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Stock Qty</label>
                <Input value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
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
