import { useEffect, useMemo, useState } from "react";
import { Clock, ShoppingBag, DollarSign, Users, User, Gift } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { fetchWithAuth, postWithAuth } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

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
  groupHourlyRate: number;
  soloHourlyRate: number;
  items: CheckoutItem[];
  pricingTier: "group" | "solo";
  onConfirmCheckout: (checkoutData: {
    timeCharge: number;
    grandTotal: number;
    pricingTier: "group" | "solo";
  }) => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  stationName,
  timeElapsed,
  groupHourlyRate,
  soloHourlyRate,
  items,
  pricingTier,
  onConfirmCheckout,
}: CheckoutDialogProps) {  
  const MIN_SPLIT_COUNT = 2;
  const MAX_SPLIT_COUNT = 20;
  const [isSplitBill, setIsSplitBill] = useState(false);
  const [splitCountInput, setSplitCountInput] = useState(String(MIN_SPLIT_COUNT));
  const [selectedPricingTier, setSelectedPricingTier] = useState<"group" | "solo">(pricingTier);
  const [loyaltyPhone, setLoyaltyPhone] = useState("");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [checkDiscountLoading, setCheckDiscountLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [discountConfirmOpen, setDiscountConfirmOpen] = useState(false);
  const [loyaltyPhoneError, setLoyaltyPhoneError] = useState<string | null>(null);
  const { toast } = useToast();

  const hasValidPhone = (value: string) => value.replace(/\D/g, "").length >= 10;

  const hourlyRate = selectedPricingTier === "solo" ? soloHourlyRate : groupHourlyRate;
  const recalculatedTimeCharge = (timeElapsed / 3600) * hourlyRate;
  // timeElapsed is in seconds (from computeElapsedSeconds); loyalty APIs use seconds
  const secondsPlayed = Math.round(timeElapsed);
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0
      ? `${hrs}h ${mins}m`
      : `${mins}m`;
  };

  const itemsTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const grandTotal = recalculatedTimeCharge + itemsTotal;
  const finalTotal = discountApplied ? grandTotal * 0.8 : grandTotal;
  const parsedSplitCount = Number(splitCountInput);
  const isValidSplitCount =
    Number.isInteger(parsedSplitCount) &&
    parsedSplitCount >= MIN_SPLIT_COUNT &&
    parsedSplitCount <= MAX_SPLIT_COUNT;
  const splitCount = isValidSplitCount ? parsedSplitCount : MIN_SPLIT_COUNT;
  const splitAmounts = useMemo(() => {
    if (!isSplitBill || !isValidSplitCount) return [];
    const totalCents = Math.max(0, Math.round(finalTotal * 100));
    const base = Math.floor(totalCents / splitCount);
    const remainder = totalCents % splitCount;

    return Array.from({ length: splitCount }, (_, index) =>
      (base + (index < remainder ? 1 : 0)) / 100
    );
  }, [finalTotal, isSplitBill, isValidSplitCount, splitCount]);

  const allSplitAmountsEqual =
    splitAmounts.length > 0 &&
    splitAmounts.every((amount) => amount === splitAmounts[0]);

  useEffect(() => {
    if (open) return;
    setIsSplitBill(false);
    setSplitCountInput(String(MIN_SPLIT_COUNT));
    setLoyaltyPhone("");
    setDiscountApplied(false);
    setDiscountConfirmOpen(false);
    setLoyaltyPhoneError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedPricingTier(pricingTier);
  }, [open, pricingTier]);

  function handleSplitCountBlur() {
    const next = Number(splitCountInput);
    if (!Number.isFinite(next)) {
      setSplitCountInput(String(MIN_SPLIT_COUNT));
      return;
    }

    const clamped = Math.min(MAX_SPLIT_COUNT, Math.max(MIN_SPLIT_COUNT, Math.floor(next)));
    setSplitCountInput(String(clamped));
  }

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
            <div className="space-y-2">
              <Label className="text-sm font-medium">Pricing Tier</Label>
              <div className="grid grid-cols-2 gap-2" data-testid="text-checkout-pricing-tier">
                <Button
                  type="button"
                  variant={selectedPricingTier === "solo" ? "default" : "outline"}
                  onClick={() => setSelectedPricingTier("solo")}
                  data-testid="button-checkout-tier-solo"
                >
                  Solo
                </Button>
                <Button
                  type="button"
                  variant={selectedPricingTier === "group" ? "default" : "outline"}
                  onClick={() => setSelectedPricingTier("group")}
                  data-testid="button-checkout-tier-group"
                >
                  Group
                </Button>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Time Charge</p>
                  <p className="text-xs text-muted-foreground" data-testid="text-time-elapsed">
                    {formatTime(timeElapsed)} @ ${hourlyRate.toFixed(2)}/hour
                  </p>
                </div>
              </div>
              <span className="text-lg font-mono font-semibold" data-testid="text-time-charge">
                ${recalculatedTimeCharge.toFixed(2)}
              </span>
            </div>

            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Gift className="w-4 h-4 text-muted-foreground" />
                Loyalty
              </Label>
              <Input
                placeholder="Phone number"
                value={loyaltyPhone}
                onChange={(e) => {
                  setLoyaltyPhone(e.target.value);
                  setLoyaltyPhoneError(null);
                }}
                className={loyaltyPhoneError ? "border-destructive" : undefined}
                data-testid="input-loyalty-phone"
              />
              {loyaltyPhoneError && (
                <p className="text-sm text-destructive" data-testid="text-loyalty-phone-error">
                  {loyaltyPhoneError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={checkDiscountLoading || discountApplied}
                  onClick={async () => {
                    setLoyaltyPhoneError(null);
                    const phone = loyaltyPhone.trim();
                    if (!phone) {
                      setLoyaltyPhoneError("Please enter a valid phone number");
                      return;
                    }
                    if (!hasValidPhone(phone)) {
                      setLoyaltyPhoneError("Please enter a valid phone number");
                      return;
                    }
                    setCheckDiscountLoading(true);
                    try {
                      const res = await fetchWithAuth<{ discountAvailable: boolean }>(
                        `/api/customers/${encodeURIComponent(phone)}/discounts/check?secondsPlayed=${encodeURIComponent(secondsPlayed)}`
                      );
                      if (res.discountAvailable) {
                        setDiscountConfirmOpen(true);
                      } else {
                        toast({
                          title: "No discount",
                          description: "This customer does not qualify for a discount yet.",
                        });
                      }
                    } catch (e: unknown) {
                      const message = e instanceof Error ? e.message : "Please try again";
                      if (message.toLowerCase().includes("phone") || message.toLowerCase().includes("invalid")) {
                        setLoyaltyPhoneError("Please enter a valid phone number");
                      } else {
                        toast({
                          title: "Check failed",
                          description: message,
                          variant: "destructive",
                        });
                      }
                    } finally {
                      setCheckDiscountLoading(false);
                    }
                  }}
                  data-testid="button-check-discount"
                >
                  {checkDiscountLoading ? "Checking…" : "Check for discount"}
                </Button>
              </div>
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
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <DollarSign className="w-6 h-6 text-primary" />
                <span className="text-lg font-semibold">Total Amount</span>
              </div>
              {discountApplied && (
                <span className="text-sm text-muted-foreground">20% loyalty discount applied</span>
              )}
            </div>
            <span className="text-4xl font-mono font-bold text-primary" data-testid="text-grand-total">
              ${finalTotal.toFixed(2)}
            </span>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Split Bill</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={isSplitBill ? "default" : "outline"}
                onClick={() => {
                  setIsSplitBill((prev) => {
                    const next = !prev;
                    if (!next) setSplitCountInput(String(MIN_SPLIT_COUNT));
                    return next;
                  });
                }}
                data-testid="button-toggle-split-bill"
              >
                {isSplitBill ? "Disable" : "Enable"}
              </Button>
            </div>

            {isSplitBill && (
              <div className="space-y-3" data-testid="section-split-bill">
                <div className="space-y-1">
                  <Label htmlFor="split-count">Number of people</Label>
                  <Input
                    id="split-count"
                    type="text"
                    inputMode="numeric"
                    value={splitCountInput}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      if (value === "" || /^\d+$/.test(value)) {
                        setSplitCountInput(value);
                      }
                    }}
                    onBlur={handleSplitCountBlur}
                    placeholder={String(MIN_SPLIT_COUNT)}
                    data-testid="input-split-count"
                  />
                  {!isValidSplitCount && (
                    <p className="text-xs text-destructive" data-testid="text-split-count-error">
                      Enter a whole number between {MIN_SPLIT_COUNT} and {MAX_SPLIT_COUNT}.
                    </p>
                  )}
                </div>

                {isValidSplitCount && (
                  <div className="space-y-2" data-testid="section-split-breakdown">
                    <p className="text-sm text-muted-foreground">
                      Split between {splitCount} people
                    </p>
                    {allSplitAmountsEqual ? (
                      <p className="text-sm font-medium" data-testid="text-split-each">
                        ${splitAmounts[0].toFixed(2)} each
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {splitAmounts.map((amount, index) => (
                          <div
                            key={`split-person-${index}`}
                            className="flex items-center justify-between text-sm"
                            data-testid={`text-split-person-${index + 1}`}
                          >
                            <span className="text-muted-foreground flex items-center gap-2">
                              <User className="w-3 h-3" />
                              Person {index + 1}
                            </span>
                            <span className="font-mono">${amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={checkoutLoading}
            onClick={async () => {
              setLoyaltyPhoneError(null);
              const phone = loyaltyPhone.trim();
              if (phone && !discountApplied) {
                if (!hasValidPhone(phone)) {
                  setLoyaltyPhoneError("Please enter a valid phone number");
                  return;
                }
              }
              setCheckoutLoading(true);
              try {
                if (phone && !discountApplied) {
                  await postWithAuth(`/api/customers/${encodeURIComponent(phone)}/seconds`, {
                    seconds: secondsPlayed,
                  });
                }
                onConfirmCheckout({
                  timeCharge: recalculatedTimeCharge,
                  grandTotal: finalTotal,
                  pricingTier: selectedPricingTier,
                });
              } catch (e: unknown) {
                const message = e instanceof Error ? e.message : "Please try again";
                if (message.toLowerCase().includes("phone") || message.toLowerCase().includes("invalid")) {
                  setLoyaltyPhoneError("Please enter a valid phone number");
                } else {
                  toast({
                    title: "Checkout failed",
                    description: message,
                    variant: "destructive",
                  });
                }
              } finally {
                setCheckoutLoading(false);
              }
            }}
            data-testid="button-confirm-checkout"
          >
            {checkoutLoading ? "Completing…" : "Complete Checkout"}
          </Button>
        </div>
      </DialogContent>

      <Dialog open={discountConfirmOpen} onOpenChange={setDiscountConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apply discount?</DialogTitle>
            <DialogDescription>
              Do you want to apply the loyalty discount? The total will be reduced by 20%.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDiscountConfirmOpen(false)}
              data-testid="button-discount-no"
            >
              No
            </Button>
            <Button
              onClick={async () => {
                const phone = loyaltyPhone.trim();
                if (!phone) return;
                try {
                  await postWithAuth(
                    `/api/customers/${encodeURIComponent(phone)}/discounts/apply`,
                    { secondsPlayed }
                  );
                  setDiscountApplied(true);
                  setDiscountConfirmOpen(false);
                  toast({ title: "Discount applied", description: "20% discount has been applied to the total." });
                } catch (e: unknown) {
                  toast({
                    title: "Failed to apply discount",
                    description: e instanceof Error ? e.message : "Please try again",
                    variant: "destructive",
                  });
                }
              }}
              data-testid="button-discount-yes"
            >
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
