import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth, postWithAuth, patchWithAuth, deleteWithAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  stockQty: number;
  isActive: boolean;
  updatedAt: string;
};

function toNumber(v: string | number): number {
  return typeof v === "number" ? v : Number(v);
}

export default function MenuManagementPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: items, isLoading, error } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: () => fetchWithAuth<MenuItem[]>("/api/menu"),
    retry: false,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>("0");
  const [stockQty, setStockQty] = useState<string>("0");
  const [isActive, setIsActive] = useState(true);

  if (error) {
    window.location.replace("/signin");
    return null;
  }

  //Sort by UpdatedAt time
  const sorted = useMemo(() => {
    return [...(items ?? [])].sort((a, b) => {
      const aa = new Date(a.updatedAt).getTime();
      const bb = new Date(b.updatedAt).getTime();
      return bb - aa;
    });
  }, [items]);

  function resetForm() {
    setName("");
    setDescription("");
    setPrice("0");
    setStockQty("0");
    setIsActive(true);
  }

  function openCreate() {
    setEditing(null);
    resetForm();
    setOpen(true);
  }

  //Fill with existing Info
  function openEdit(item: MenuItem) {
    setEditing(item);
    setName(item.name);
    setDescription(item.description ?? "");
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
          price: p.toFixed(2),
          stockQty: q,
          isActive,
        });
        toast({ title: "Item created" });
      } else {
        await patchWithAuth(`/api/menu/${editing.id}`, {
          name: trimmed,
          description: description.trim() ? description.trim() : null,
          price: p.toFixed(2),
          stockQty: q,
          isActive,
        });
        toast({ title: "Item updated" });
      }

      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["menu"] });
      // also refresh stations so Add Items dialog reflects changes immediately
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Menu</h1>
            <p className="text-sm text-muted-foreground">Manage items, prices, and stock</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.assign("/dashboard")}>
              Back to Dashboard
            </Button>
            <Button onClick={openCreate}>Add Item</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {sorted.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            No menu items yet. Click “Add Item” to create your first one.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((it) => (
              <Card key={it.id} className="p-5 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{it.name}</h3>
                    {it.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">{it.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No description</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-semibold">${toNumber(it.price).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">
                      Stock: <span className="font-medium">{it.stockQty ?? 0}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Status: <span className="font-medium">{it.isActive ? "Active" : "Inactive"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => openEdit(it)}>
                    Edit
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={() => remove(it)}>
                    Delete
                  </Button>
                </div>
              </Card>
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
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Red Bull" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional Description" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Price</label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Stock Qty</label>
                <Input value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
              </div>
            </div>

            <div className="flex items-center justify-between border rounded-md p-3 gap-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Inactive items won’t show in Add Items.</div>
              </div>
              <Button type="button" variant={isActive ? "default" : "outline"} onClick={() => setIsActive((v) => !v)}>
                {isActive ? "Active" : "Inactive"}
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
