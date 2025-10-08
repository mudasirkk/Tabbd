import { useState } from "react";
import { Plus, Minus, ShoppingBag, DollarSign } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: string;
}

interface AddItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stationName: string;
  menuItems: MenuItem[];
  selectedItems: { [itemId: string]: number };
  onAddItem: (itemId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onAddCustomItem: (name: string, price: number) => void;
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
  onAddCustomItem,
  onConfirm,
}: AddItemsDialogProps) {
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");

  const totalItems = Object.values(selectedItems).reduce((sum, count) => sum + count, 0);

  const groupedItems = menuItems.reduce((acc, item) => {
    const category = item.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as { [key: string]: MenuItem[] });

  const categories = Object.keys(groupedItems).sort();

  const handleAddCustomItem = () => {
    const price = parseFloat(customItemPrice);
    if (customItemName.trim() && !isNaN(price) && price > 0) {
      onAddCustomItem(customItemName.trim(), price);
      setCustomItemName("");
      setCustomItemPrice("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]" data-testid="dialog-add-items">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Add Items to {stationName}</DialogTitle>
          <DialogDescription>
            Select items or add a custom item to the customer's tab
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-4 bg-muted/50">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Add Custom Item</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="custom-item-name" className="text-xs">Item Name</Label>
                  <Input
                    id="custom-item-name"
                    placeholder="e.g., Extra napkins, Custom order"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    data-testid="input-custom-item-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="custom-item-price" className="text-xs">Price</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="custom-item-price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        className="pl-8"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value)}
                        data-testid="input-custom-item-price"
                      />
                    </div>
                    <Button
                      onClick={handleAddCustomItem}
                      disabled={!customItemName.trim() || !customItemPrice || parseFloat(customItemPrice) <= 0}
                      data-testid="button-add-custom-item"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Separator />

          <ScrollArea className="max-h-96 pr-4">
            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category} className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide" data-testid={`text-category-${category}`}>
                    {category}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {groupedItems[category].map((item) => (
                      <Card
                        key={item.id}
                        className="p-3 hover-elevate cursor-pointer"
                        onClick={() => onAddItem(item.id)}
                        data-testid={`card-menu-item-${item.id}`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm leading-tight" data-testid={`text-item-name-${item.id}`}>
                              {item.name}
                            </h4>
                            {selectedItems[item.id] > 0 && (
                              <Badge variant="default" className="text-xs" data-testid={`badge-item-count-${item.id}`}>
                                {selectedItems[item.id]}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold text-primary text-sm" data-testid={`text-item-price-${item.id}`}>
                              ${item.price.toFixed(2)}
                            </span>
                            {selectedItems[item.id] > 0 && (
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
                                    onAddItem(item.id);
                                  }}
                                  data-testid={`button-increase-${item.id}`}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
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
