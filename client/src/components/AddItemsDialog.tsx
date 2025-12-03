import { Plus, Minus, ShoppingBag, Link as LinkIcon } from "lucide-react";
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
  squareConnected?: boolean;
  onConnectSquare?: () => void;
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
  squareConnected = true,
  onConnectSquare,
}: AddItemsDialogProps) {

  const totalItems = Object.values(selectedItems).reduce((sum, count) => sum + count, 0);

  if (!squareConnected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md" data-testid="dialog-connect-square">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">Connect to Square</DialogTitle>
            <DialogDescription>
              Square connection is required to access the menu and process payments.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <LinkIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-center text-muted-foreground">
              Connect your Square account to add menu items to customer tabs.
            </p>
            {onConnectSquare && (
              <Button onClick={onConnectSquare} data-testid="button-connect-square-dialog">
                Connect to Square
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const groupedItems = menuItems.reduce((acc, item) => {
    const category = item.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as { [key: string]: MenuItem[] });

  const categories = Object.keys(groupedItems)
    .filter(category => category.toUpperCase() !== "GAMING")
    .sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col" data-testid="dialog-add-items">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Add Items to {stationName}</DialogTitle>
          <DialogDescription>
            Select items from your Square catalog to add to the customer's tab
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          <div className="space-y-6 pb-4">
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
                            ${typeof item.price === 'number' ? item.price.toFixed(2) : parseFloat(item.price).toFixed(2)}
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
