import { useState, useEffect } from "react";
import { Clock, ShoppingBag, DollarSign, Users, User, CreditCard } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface SquareDevice {
  id: string;
  device_id: string;
  name: string;
  status: string;
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stationName: string;
  stationType?: string;
  timeElapsed: number;
  timeCharge: number;
  items: CheckoutItem[];
  devices: SquareDevice[];
  squareConnected: boolean;
  onConfirmCheckout: (checkoutData: { 
    pricingTier: "group" | "solo"; 
    timeCharge: number; 
    grandTotal: number;
    deviceId?: string;
  }) => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  stationName,
  stationType,
  timeElapsed,
  timeCharge,
  items,
  devices,
  squareConnected,
  onConfirmCheckout,
}: CheckoutDialogProps) {
  const [pricingTier, setPricingTier] = useState<"group" | "solo">("group");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  
  // Reset to group and select first device when dialog opens
  useEffect(() => {
    if (open) {
      setPricingTier("group");
      if (devices.length > 0) {
        setSelectedDeviceId(devices[0].device_id);
      }
    }
  }, [open, devices]);
  
  const isPoolOrFoosball = stationType === "pool" || stationType === "foosball";
  const hourlyRate = isPoolOrFoosball && pricingTier === "solo" ? 10 : 16;
  const recalculatedTimeCharge = (timeElapsed / 3600) * hourlyRate;
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0
      ? `${hrs}h ${mins}m`
      : `${mins}m`;
  };

  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = recalculatedTimeCharge + itemsTotal;

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
            {isPoolOrFoosball && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Pricing Option</Label>
                <RadioGroup
                  value={pricingTier}
                  onValueChange={(value) => setPricingTier(value as "group" | "solo")}
                  className="grid grid-cols-2 gap-3"
                >
                  <div>
                    <RadioGroupItem
                      value="group"
                      id="group"
                      className="peer sr-only"
                      data-testid="radio-pricing-group"
                    />
                    <Label
                      htmlFor="group"
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-muted/50 p-4 hover-elevate cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
                      data-testid="label-pricing-group"
                    >
                      <Users className="w-5 h-5" />
                      <div className="text-center">
                        <p className="font-semibold">Group</p>
                        <p className="text-sm text-muted-foreground">$16.00/HR</p>
                      </div>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="solo"
                      id="solo"
                      className="peer sr-only"
                      data-testid="radio-pricing-solo"
                    />
                    <Label
                      htmlFor="solo"
                      className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-muted bg-muted/50 p-4 hover-elevate cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10"
                      data-testid="label-pricing-solo"
                    >
                      <User className="w-5 h-5" />
                      <div className="text-center">
                        <p className="font-semibold">Solo</p>
                        <p className="text-sm text-muted-foreground">$10.00/HR</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {squareConnected && devices.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Square Terminal Device
                </Label>
                <Select
                  value={selectedDeviceId}
                  onValueChange={setSelectedDeviceId}
                >
                  <SelectTrigger data-testid="select-device">
                    <SelectValue placeholder="Select a terminal" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem 
                        key={device.id} 
                        value={device.device_id}
                        data-testid={`device-option-${device.id}`}
                      >
                        {device.name} ({device.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Time Charge</p>
                  <p className="text-xs text-muted-foreground" data-testid="text-time-elapsed">
                    {formatTime(timeElapsed)} @ ${hourlyRate}/hour
                  </p>
                </div>
              </div>
              <span className="text-lg font-mono font-semibold" data-testid="text-time-charge">
                ${recalculatedTimeCharge.toFixed(2)}
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
            onClick={() => onConfirmCheckout({ 
              pricingTier, 
              timeCharge: recalculatedTimeCharge,
              grandTotal,
              deviceId: squareConnected && devices.length > 0 ? selectedDeviceId : undefined
            })}
            data-testid="button-confirm-checkout"
            disabled={squareConnected && devices.length > 0 && !selectedDeviceId}
          >
            {squareConnected && devices.length > 0 ? "Send to Terminal" : "Complete Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
