import { useMemo } from "react";
import { Plus, Minus, ShoppingBag, } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  description?: string | null;
  stockQty?: number;
  isActive?: boolean;
}

interface AddItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stationName: string;
  menuItems: MenuItem[];
  selectedItems: { [itemId: string]: number };
  onAddItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onConfirm: () => void;
}

export function AddItemsDialog({
  open,
  onOpenChange,
  stationName,
  menuItems,
  selectedItems,
  onAddItem,
  onRemoveItem,
  onConfirm,
}: AddItemsDialogProps) {

  const totalItems = Object.values(selectedItems).reduce((sum, count) => sum + count, 0);

  const groupedMenu = useMemo(() => {
    const activeMenu = (menuItems ?? []).filter((i) => i.isActive ?? true);

    const groups = new Map<string, MenuItem[]>();
    for (const item of activeMenu) {
      const cat = (item.category ?? "").trim() || "Miscellaneous";
      const arr = groups.get(cat) ?? [];
      arr.push(item);
      groups.set(cat, arr);
    }

    // Sort categories A→Z, but keep Miscellaneous last
    const categories = Array.from(groups.keys()).sort((a, b) => {
      if (a === "Miscellaneous") return 1;
      if (b === "Miscellaneous") return -1;
      return a.localeCompare(b);
    });

    // Optional: sort items alphabetically within each category
    return categories.map((category) => ({
      category,
      items: (groups.get(category) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [menuItems]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" data-testid="dialog-add-items">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Add Items to {stationName}</DialogTitle>
          <DialogDescription>
            Select items from your menu to add to the customer's tab
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          <div className="space-y-6 pb-4">
          <div className="space-y-6">
            {groupedMenu.map((group) => (
              <div key={group.category} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {group.category}
                  </h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {group.items.map((item) => {
                    const stock = item.stockQty ?? 0;
                    const selectedQty = selectedItems[item.id] ?? 0;
                    const outOfStock = stock <= 0;
                    const atLimit = selectedQty >= stock && stock > 0;

                    return (
                      <Card
                        key={item.id}
                        className={`p-3 hover-elevate cursor-pointer ${outOfStock ? "opacity-60 cursor-not-allowed" : ""}`}
                        onClick={() => {
                          if (outOfStock || atLimit) return;
                          onAddItem(item.id);
                        }}
                        data-testid={`card-menu-item-${item.id}`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm leading-tight" data-testid={`text-item-name-${item.id}`}>
                              {item.name}
                            </h4>
                            {selectedQty > 0 && (
                              <Badge variant="default" className="text-xs" data-testid={`badge-item-count-${item.id}`}>
                                {selectedQty}
                              </Badge>
                            )}
                          </div>

                          {item.description ? (
                            <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                          ) : null}

                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold text-primary text-sm" data-testid={`text-item-price-${item.id}`}>
                              ${typeof item.price === "number" ? item.price.toFixed(2) : parseFloat(String(item.price)).toFixed(2)}
                            </span>

                            <span className="text-xs text-muted-foreground">
                              Stock: <span className="font-medium">{stock}</span>
                            </span>

                            {selectedQty > 0 && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveItem(item.id);
                                  }}
                                  data-testid={`button-decrease-${item.id}`}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!atLimit) onAddItem(item.id);
                                  }}
                                  data-testid={`button-increase-${item.id}`}
                                  disabled={atLimit}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground" data-testid="text-total-items">
              {totalItems} {totalItems === 1 ? "item" : "items"} selected
            </span>
          </div>
          <Button onClick={onConfirm} data-testid="button-confirm-items">
            Confirm Items
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
