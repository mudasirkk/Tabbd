import { Clock, ShoppingBag, DollarSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stationName: string;
  timeElapsed: number;
  timeCharge: number;
  items: CheckoutItem[];
  onConfirmCheckout: () => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  stationName,
  timeElapsed,
  timeCharge,
  items,
  onConfirmCheckout,
}: CheckoutDialogProps) {
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0
      ? `${hrs}h ${mins}m`
      : `${mins}m`;
  };

  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = timeCharge + itemsTotal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="dialog-checkout">
        <DialogHeader>
          <DialogTitle className="text-2xl" data-testid="text-checkout-title">
            Checkout - {stationName}
          </DialogTitle>
          <DialogDescription>
            Review the charges and complete payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Time Charge</p>
                  <p className="text-xs text-muted-foreground" data-testid="text-time-elapsed">
                    {formatTime(timeElapsed)} @ $16/hour
                  </p>
                </div>
              </div>
              <span className="text-lg font-mono font-semibold" data-testid="text-time-charge">
                ${timeCharge.toFixed(2)}
              </span>
            </div>

            {items.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShoppingBag className="w-4 h-4" />
                  <span>Items Purchased</span>
                </div>
                <ScrollArea className="max-h-40">
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-sm"
                        data-testid={`item-checkout-${item.id}`}
                      >
                        <span className="text-muted-foreground">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-mono" data-testid={`text-item-total-${item.id}`}>
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Items Subtotal</span>
                  <span className="font-mono font-medium" data-testid="text-items-subtotal">
                    ${itemsTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-primary" />
              <span className="text-lg font-semibold">Total Amount</span>
            </div>
            <span className="text-4xl font-mono font-bold text-primary" data-testid="text-grand-total">
              ${grandTotal.toFixed(2)}
            </span>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={onConfirmCheckout}
            data-testid="button-confirm-checkout"
          >
            Complete Payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
