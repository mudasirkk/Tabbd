import { Plus, Minus, ShoppingBag } from "lucide-react";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]" data-testid="dialog-add-items">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Add Items to {stationName}</DialogTitle>
          <DialogDescription>
            Select items to add to the customer's tab
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-96 pr-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {menuItems.map((item) => (
              <Card
                key={item.id}
                className="p-4 hover-elevate cursor-pointer"
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
                    <span className="font-mono font-semibold text-primary" data-testid={`text-item-price-${item.id}`}>
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
        </ScrollArea>

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
