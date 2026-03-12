import { useMemo, useState } from "react";
import { Plus, Minus, ShoppingBag, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
  description?: string | null;
  stockQty?: number;
  isActive?: boolean;
  isVariablePrice?: boolean;
}

export interface VariableItemEntry {
  menuItemId: string;
  customName: string;
  customPrice: string;
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
  variableItems?: VariableItemEntry[];
  onAddVariableItem?: (item: VariableItemEntry) => void;
  onRemoveVariableItem?: (index: number) => void;
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
  variableItems = [],
  onAddVariableItem,
  onRemoveVariableItem,
}: AddItemsDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [variableTarget, setVariableTarget] = useState<MenuItem | null>(null);
  const [variableCustomName, setVariableCustomName] = useState("");
  const [variableCustomPrice, setVariableCustomPrice] = useState("");

  const totalItems = Object.values(selectedItems).reduce((sum, count) => sum + count, 0);
  const variableItemCount = variableItems.length;
  const totalItemsCount = totalItems + variableItemCount;

  const groupedMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const activeMenu = (menuItems ?? []).filter((i) => {
      if (!(i.isActive ?? true)) return false;
      if (!q) return true;
      const nameMatch = i.name.toLowerCase().includes(q);
      const catMatch = (i.category ?? "Miscellaneous").toLowerCase().includes(q);
      return nameMatch || catMatch;
    });

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
  }, [menuItems, searchQuery]);


  function handleOpenChange(o: boolean) {
    if (!o) {
      setSearchQuery("");
      setVariableModalOpen(false);
      setVariableTarget(null);
    }
    onOpenChange(o);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" data-testid="dialog-add-items">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Add Items to {stationName}</DialogTitle>
          <DialogDescription>
            Select items from your menu to add to the customer's tab
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-item-search"
          />
        </div>

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
                    const isVariable = !!item.isVariablePrice;
                    const stock = item.stockQty ?? 0;
                    const selectedQty = selectedItems[item.id] ?? 0;
                    const variableCount = variableItems.filter((vi) => vi.menuItemId === item.id).length;
                    const outOfStock = !isVariable && stock <= 0;
                    const atLimit = !isVariable && selectedQty >= stock && stock > 0;

                    return (
                      <Card
                        key={item.id}
                        className={`p-3 hover-elevate cursor-pointer ${outOfStock ? "opacity-60 cursor-not-allowed" : ""}`}
                        onClick={() => {
                          if (isVariable) {
                            setVariableTarget(item);
                            setVariableCustomName(item.name);
                            setVariableCustomPrice(
                              typeof item.price === "number"
                                ? item.price.toFixed(2)
                                : parseFloat(String(item.price)).toFixed(2)
                            );
                            setVariableModalOpen(true);
                            return;
                          }
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
                            {(selectedQty > 0 || variableCount > 0) && (
                              <Badge variant="default" className="text-xs" data-testid={`badge-item-count-${item.id}`}>
                                {isVariable ? variableCount : selectedQty}
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

                            {isVariable ? (
                              <span className="text-xs text-primary font-medium">Variable Price</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Stock: <span className="font-medium">{stock}</span>
                              </span>
                            )}

                            {!isVariable && selectedQty > 0 && (
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

        {variableItems.length > 0 && (
          <div className="w-full space-y-1 pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Variable Items</p>
            {variableItems.map((vi, index) => (
              <div key={index} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
                <span className="truncate">{vi.customName} - ${parseFloat(vi.customPrice).toFixed(2)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => onRemoveVariableItem?.(index)}
                  data-testid={`button-remove-variable-item-${index}`}
                >
                  <Minus className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground" data-testid="text-total-items">
              {totalItemsCount} {totalItemsCount === 1 ? "item" : "items"} selected
            </span>
          </div>
          <Button onClick={onConfirm} data-testid="button-confirm-items">
            Confirm Items
          </Button>
        </div>
      </DialogContent>

      <Dialog open={variableModalOpen} onOpenChange={setVariableModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Custom Item</DialogTitle>
            <DialogDescription>
              Set the name and price for this item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="variable-item-name">Item Name</Label>
              <Input
                id="variable-item-name"
                value={variableCustomName}
                onChange={(e) => setVariableCustomName(e.target.value)}
                placeholder="e.g., Chicken Biryani"
                maxLength={200}
                data-testid="input-variable-item-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="variable-item-price">Price</Label>
              <Input
                id="variable-item-price"
                value={variableCustomPrice}
                onChange={(e) => setVariableCustomPrice(e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                data-testid="input-variable-item-price"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVariableModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const price = parseFloat(variableCustomPrice);
                if (!variableCustomName.trim() || !Number.isFinite(price) || price <= 0) return;
                onAddVariableItem?.({
                  menuItemId: variableTarget!.id,
                  customName: variableCustomName.trim(),
                  customPrice: price.toFixed(2),
                });
                setVariableModalOpen(false);
              }}
              disabled={!variableCustomName.trim() || !Number.isFinite(parseFloat(variableCustomPrice)) || parseFloat(variableCustomPrice) <= 0}
              data-testid="button-confirm-variable-item"
            >
              Add Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
