import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  Gift,
  ShoppingBag,
  User,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchWithAuth, postWithAuth } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface CheckoutItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CheckoutTimeSegment {
  id: string;
  stationName: string;
  effectiveSeconds: number;
  pricingTier: "group" | "solo";
  rateSoloHourlySnapshot: number;
  rateGroupHourlySnapshot: number;
}

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  stationName: string;
  activeSessions: Array<{ sessionId: string; stationName: string }>;
  onSessionChange: (sessionId: string) => void;
  currentSegmentSeconds: number;
  accruedTimeSeconds: number;
  groupHourlyRate: number;
  soloHourlyRate: number;
  items: CheckoutItem[];
  pricingTier: "group" | "solo";
  timeSegments: CheckoutTimeSegment[];
  onConfirmCheckout: (checkoutData: {
    timeCharge: number;
    grandTotal: number;
    pricingTier: "group" | "solo";
    currentSegmentPricingTier: "group" | "solo";
    segmentTierOverrides: Array<{ segmentId: string; pricingTier: "group" | "solo" }>;
  }) => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  sessionId,
  stationName,
  activeSessions,
  onSessionChange,
  currentSegmentSeconds,
  accruedTimeSeconds,
  groupHourlyRate,
  soloHourlyRate,
  items,
  pricingTier,
  timeSegments,
  onConfirmCheckout,
}: CheckoutDialogProps) {
  const MIN_SPLIT_COUNT = 2;
  const MAX_SPLIT_COUNT = 20;
  const [isSplitBill, setIsSplitBill] = useState(false);
  const [splitCountInput, setSplitCountInput] = useState(String(MIN_SPLIT_COUNT));
  const [selectedPricingTier, setSelectedPricingTier] = useState<"group" | "solo">(pricingTier);
  const [segmentTierSelections, setSegmentTierSelections] = useState<Record<string, "group" | "solo">>({});
  const [loyaltyPhone, setLoyaltyPhone] = useState("");
  const [discountApplied, setDiscountApplied] = useState(false);
  const [checkDiscountLoading, setCheckDiscountLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [discountConfirmOpen, setDiscountConfirmOpen] = useState(false);
  const [loyaltyPhoneError, setLoyaltyPhoneError] = useState<string | null>(null);
  const [timeExpanded, setTimeExpanded] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);
  const [loyaltyExpanded, setLoyaltyExpanded] = useState(false);
  const { toast } = useToast();

  const hasValidPhone = (value: string) => value.replace(/\D/g, "").length >= 10;

  const totalSecondsPlayed = Math.round(accruedTimeSeconds + currentSegmentSeconds);
  const currentHourlyRate = selectedPricingTier === "solo" ? soloHourlyRate : groupHourlyRate;
  const currentSegmentCharge = (currentSegmentSeconds / 3600) * currentHourlyRate;

  const segmentRows = useMemo(() => {
    return timeSegments.map((segment) => {
      const selectedTier = segmentTierSelections[segment.id] ?? segment.pricingTier;
      const appliedRate =
        selectedTier === "solo" ? segment.rateSoloHourlySnapshot : segment.rateGroupHourlySnapshot;
      const amount = (segment.effectiveSeconds / 3600) * appliedRate;
      return {
        ...segment,
        selectedTier,
        appliedRate,
        amount,
      };
    });
  }, [segmentTierSelections, timeSegments]);

  const accruedSegmentsCharge = segmentRows.reduce((sum, row) => sum + row.amount, 0);
  const recalculatedTimeCharge = accruedSegmentsCharge + currentSegmentCharge;

  const formatTime = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
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
    splitAmounts.length > 0 && splitAmounts.every((amount) => amount === splitAmounts[0]);

  useEffect(() => {
    if (open) return;
    setIsSplitBill(false);
    setSplitCountInput(String(MIN_SPLIT_COUNT));
    setLoyaltyPhone("");
    setDiscountApplied(false);
    setDiscountConfirmOpen(false);
    setLoyaltyPhoneError(null);
    setItemsExpanded(false);
    setTimeExpanded(false);
    setLoyaltyExpanded(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedPricingTier(pricingTier);
    const initial: Record<string, "group" | "solo"> = {};
    for (const segment of timeSegments) {
      initial[segment.id] = segment.pricingTier;
    }
    setSegmentTierSelections(initial);
    setLoyaltyPhone("");
    setDiscountApplied(false);
    setLoyaltyPhoneError(null);
    setIsSplitBill(false);
    setSplitCountInput(String(MIN_SPLIT_COUNT));
    setTimeExpanded(false);
    setItemsExpanded(false);
    setLoyaltyExpanded(false);
  }, [open, sessionId]);

  function handleSplitCountBlur() {
    const next = Number(splitCountInput);
    if (!Number.isFinite(next)) {
      setSplitCountInput(String(MIN_SPLIT_COUNT));
      return;
    }

    const clamped = Math.min(MAX_SPLIT_COUNT, Math.max(MIN_SPLIT_COUNT, Math.floor(next)));
    setSplitCountInput(String(clamped));
  }

  const tierOverrides = segmentRows
    .filter((row) => row.selectedTier !== row.pricingTier)
    .map((row) => ({ segmentId: row.id, pricingTier: row.selectedTier }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-[100vw] max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-[92vh] sm:max-h-[92vh] sm:w-[95vw] sm:max-w-3xl sm:rounded-lg"
        data-testid="dialog-checkout"
      >
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="space-y-2 border-b px-4 py-3 sm:space-y-3 sm:px-6 sm:py-5 sm:pb-4">
            <div className="space-y-1">
              <DialogTitle className="text-2xl" data-testid="text-checkout-title">
                Checkout - {stationName}
              </DialogTitle>
              <DialogDescription>Review charges and complete payment.</DialogDescription>
            </div>
            {activeSessions.length > 1 && (
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Switch active session</Label>
                <Select value={sessionId} onValueChange={onSessionChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeSessions.map((session) => (
                      <SelectItem key={session.sessionId} value={session.sessionId}>
                        {session.stationName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 pb-6 sm:px-6 sm:py-4 sm:pb-6">
            <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Time Charges</p>
                  <p className="text-xs text-muted-foreground">Current + transferred segments</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimeExpanded((prev) => !prev)}
                >
                  {timeExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              {timeExpanded && (
                <div className="mt-3 max-h-[38dvh] overflow-y-auto rounded-md border bg-background sm:max-h-[40vh]">
                  <div className="space-y-3 p-2 pr-3">
                    {segmentRows.length > 0 ? (
                      <div className="space-y-2">
                        {segmentRows.map((row) => (
                          <div key={row.id} className="rounded border bg-background p-3">
                            <div className="mb-2 flex items-center justify-between text-sm">
                              <span className="font-medium">{row.stationName}</span>
                              <span className="font-mono text-xs">{formatTime(row.effectiveSeconds)}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Select
                                value={row.selectedTier}
                                onValueChange={(value: "group" | "solo") =>
                                  setSegmentTierSelections((prev) => ({ ...prev, [row.id]: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="solo">Solo</SelectItem>
                                  <SelectItem value="group">Group</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="text-right text-sm">
                                <div className="text-muted-foreground">@ ${row.appliedRate.toFixed(2)}/hr</div>
                                <div className="font-mono">${row.amount.toFixed(2)}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No prior transfer segments.</p>
                    )}

                    <div className="rounded border bg-background p-3">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">Current: {stationName}</span>
                        <span className="font-mono text-xs">{formatTime(currentSegmentSeconds)}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Select
                          value={selectedPricingTier}
                          onValueChange={(value: "group" | "solo") => setSelectedPricingTier(value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="solo">Solo</SelectItem>
                            <SelectItem value="group">Group</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-right text-sm">
                          <div className="text-muted-foreground">@ ${currentHourlyRate.toFixed(2)}/hr</div>
                          <div className="font-mono">${currentSegmentCharge.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded bg-muted/50 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>Total time: {formatTime(totalSecondsPlayed)}</span>
                      </div>
                      <span className="font-mono font-semibold" data-testid="text-time-charge">
                        ${recalculatedTimeCharge.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!timeExpanded && (
                <div className="mt-3 flex items-center justify-between rounded bg-muted/50 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Total time: {formatTime(totalSecondsPlayed)}</span>
                  </div>
                  <span className="font-mono font-semibold" data-testid="text-time-charge">
                    ${recalculatedTimeCharge.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShoppingBag className="h-4 w-4" />
                    <span>Items Purchased ({items.length})</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setItemsExpanded((prev) => !prev)}
                  >
                    {itemsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>

                {itemsExpanded && (
                  <div className="mt-3 space-y-2">
                    <div className="max-h-44 overflow-y-auto rounded-md border bg-background p-2">
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
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Items Subtotal</span>
                      <span className="font-mono font-medium" data-testid="text-items-subtotal">
                        ${itemsTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Gift className="h-4 w-4 text-muted-foreground" />
                  Loyalty
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setLoyaltyExpanded((prev) => !prev)}
                >
                  {loyaltyExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              {loyaltyExpanded && (
                <div className="mt-3 space-y-2">
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={checkDiscountLoading || discountApplied}
                    onClick={async () => {
                      setLoyaltyPhoneError(null);
                      const phone = loyaltyPhone.trim();
                      if (!phone || !hasValidPhone(phone)) {
                        setLoyaltyPhoneError("Please enter a valid phone number");
                        return;
                      }
                      setCheckDiscountLoading(true);
                      try {
                        const res = await fetchWithAuth<{ discountAvailable: boolean }>(
                          `/api/customers/${encodeURIComponent(phone)}/discounts/check?secondsPlayed=${encodeURIComponent(totalSecondsPlayed)}`
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
                    {checkDiscountLoading ? "Checking..." : discountApplied ? "Discount Applied" : "Check for discount"}
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Split Bill</span>
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
                <div className="mt-3 space-y-3" data-testid="section-split-bill">
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
                      <p className="text-sm text-muted-foreground">Split between {splitCount} people</p>
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
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-3 w-3" />
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
            </div>
          </div>

          <div className="space-y-3 border-t bg-background px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center justify-between rounded-lg bg-primary/10 p-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-lg font-semibold">Total Amount</span>
                </div>
                {discountApplied && (
                  <span className="text-xs text-muted-foreground">20% loyalty discount applied</span>
                )}
              </div>
              <span className="text-3xl font-mono font-bold text-primary" data-testid="text-grand-total">
                ${finalTotal.toFixed(2)}
              </span>
            </div>

            <Separator />

            <Button
              className="w-full"
              size="lg"
              disabled={checkoutLoading}
              onClick={async () => {
                setLoyaltyPhoneError(null);
                const phone = loyaltyPhone.trim();
                if (phone && !discountApplied && !hasValidPhone(phone)) {
                  setLoyaltyPhoneError("Please enter a valid phone number");
                  return;
                }

                setCheckoutLoading(true);
                try {
                  if (phone && !discountApplied) {
                    await postWithAuth(`/api/customers/${encodeURIComponent(phone)}/seconds`, {
                      seconds: totalSecondsPlayed,
                    });
                  }
                  onConfirmCheckout({
                    timeCharge: recalculatedTimeCharge,
                    grandTotal: finalTotal,
                    pricingTier: selectedPricingTier,
                    currentSegmentPricingTier: selectedPricingTier,
                    segmentTierOverrides: tierOverrides,
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
              {checkoutLoading ? "Completing..." : "Complete Checkout"}
            </Button>
          </div>
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
                  await postWithAuth(`/api/customers/${encodeURIComponent(phone)}/discounts/apply`, {
                    secondsPlayed: totalSecondsPlayed,
                  });
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
