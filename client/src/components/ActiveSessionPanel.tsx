import { Clock, ShoppingBag, Receipt, ArrowRightLeft, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export interface SessionItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

interface ActiveSessionPanelProps {
  stationName: string;
  timeElapsed: number;
  timeCharge: number;
  startTime?: number;
  items: SessionItem[];
  onAddItems: () => void;
  onCheckout: () => void;
  onTransfer: () => void;
  onRequestRemoveItem: (item: SessionItem) => void;
}

export function ActiveSessionPanel({
  stationName,
  timeElapsed,
  timeCharge,
  startTime,
  items,
  onAddItems,
  onCheckout,
  onTransfer,
  onRequestRemoveItem,
}: ActiveSessionPanelProps) {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatStartTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = timeCharge + itemsTotal;
  const sortedItems = [...items].sort((a, b) => {
    const aCategory = (a.category ?? "").trim() || "Miscellaneous";
    const bCategory = (b.category ?? "").trim() || "Miscellaneous";

    if (aCategory === "Miscellaneous" && bCategory !== "Miscellaneous") return 1;
    if (bCategory === "Miscellaneous" && aCategory !== "Miscellaneous") return -1;

    const categoryCompare = aCategory.localeCompare(bCategory);
    if (categoryCompare !== 0) return categoryCompare;

    return a.name.localeCompare(b.name);
  });

  return (
    <Card className="p-6" data-testid="panel-active-session">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold" data-testid="text-panel-station-name">
            {stationName}
          </h2>
          <Badge variant="default" className="mt-2">
            Active Session
          </Badge>
        </div>

        <div className="space-y-4">
          {startTime && (
            <div className="text-sm text-muted-foreground" data-testid="text-panel-start-time">
              Started at {formatStartTime(startTime)}
            </div>
          )}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time Elapsed</p>
                <p className="text-3xl font-mono font-bold" data-testid="text-panel-timer">
                  {formatTime(timeElapsed)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Time Charge</p>
              <p className="text-2xl font-mono font-semibold text-primary" data-testid="text-panel-time-charge">
                ${timeCharge.toFixed(2)}
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" />
                <h3 className="font-medium">Items on Tab</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onAddItems}
                data-testid="button-add-items"
              >
                Add Items
              </Button>
            </div>

            {sortedItems.length > 0 ? (
              <div className="max-h-[260px] overflow-y-auto pr-2">
                <div className="space-y-2">
                  {sortedItems.map((item, index) => (
                    <div
                      key={`${item.id}-${index}`}
                      className="flex items-center justify-between p-2 rounded-md hover-elevate"
                      data-testid={`item-session-${item.id}-${index}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {item.quantity}x {item.name}
                        </span>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRequestRemoveItem(item)}
                          aria-label={`Remove ${item.name}`}
                          data-testid={`button-remove-session-item-${item.id}-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                    <span className="text-sm font-mono" data-testid={`text-session-item-total-${item.id}-${index}`}>
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No items added yet
              </p>
            )}

            {items.length > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm font-medium">Items Subtotal</span>
                <span className="text-sm font-mono font-medium" data-testid="text-panel-items-subtotal">
                  ${itemsTotal.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
            <span className="text-lg font-semibold">Total Amount</span>
            <span className="text-3xl font-mono font-bold text-primary" data-testid="text-panel-grand-total">
              ${grandTotal.toFixed(2)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={onTransfer}
              data-testid="button-transfer-session"
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Transfer
            </Button>
            <Button
              size="lg"
              onClick={onCheckout}
              data-testid="button-end-session"
            >
              <Receipt className="w-4 h-4 mr-2" />
              Checkout
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
