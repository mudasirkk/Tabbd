import { useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithAuth } from "@/lib/api";

interface Customer {
  id: string;
  phoneNumber: string;
  firstName: string | null;
  lastName: string | null;
  totalSeconds: number;
  isDiscountAvailable: boolean;
}

interface LookupResult {
  customer: Customer;
  thresholdSeconds: number;
}

interface LoyaltyLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

export function LoyaltyLookupDialog({ open, onOpenChange }: LoyaltyLookupDialogProps) {
  const [phone, setPhone] = useState("");

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits.length ? `(${digits}` : "";
    if (digits.length <= 6) return `(${digits.slice(0, 3)})${digits.slice(3)}`;
    return `(${digits.slice(0, 3)})${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  const [result, setResult] = useState<LookupResult | "new" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchWithAuth<LookupResult | { customer: null }>(`/api/customers/phone/${normalized}`);
      if ("customer" in data && data.customer === null) {
        setResult("new");
      } else {
        setResult(data as LookupResult);
      }
    } catch (e: any) {
      const raw = e?.message ?? "";
      if (raw.toLowerCase().includes("not found") || raw.includes("404")) {
        setResult("new");
      } else if (raw.toLowerCase().includes("network") || raw.toLowerCase().includes("fetch")) {
        setError("Unable to reach the server. Check your connection and try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose(o: boolean) {
    if (!o) {
      setPhone("");
      setResult(null);
      setError(null);
    }
    onOpenChange(o);
  }

  const hoursPlayed = result && result !== "new"
    ? (result.customer.totalSeconds / 3600).toFixed(1)
    : null;

  const progressPct = result && result !== "new" && !result.customer.isDiscountAvailable
    ? Math.min(100, Math.round((result.customer.totalSeconds / result.thresholdSeconds) * 100))
    : 0;

  const hoursUntil = result && result !== "new" && !result.customer.isDiscountAvailable
    ? ((result.thresholdSeconds - result.customer.totalSeconds) / 3600).toFixed(1)
    : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Loyalty Lookup</DialogTitle>
          <DialogDescription>Enter a customer's phone number to check their loyalty status.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="font-mono"
          />
          <Button onClick={handleSearch} disabled={loading || !phone.trim()} size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {result === "new" && (
          <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 text-sm">
            <p className="font-medium">New customer</p>
            <p className="text-muted-foreground text-xs mt-0.5">No loyalty record found for this number.</p>
          </div>
        )}

        {result && result !== "new" && (
          <div className="rounded-md border border-border/60 bg-muted/20 px-4 py-3 space-y-3">
            <div>
              <p className="font-semibold text-sm">
                {[result.customer.firstName, result.customer.lastName].filter(Boolean).join(" ") || result.customer.phoneNumber}
              </p>
              <p className="text-xs text-muted-foreground">{result.customer.phoneNumber}</p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Hours played</span>
              <span className="font-mono font-medium">{hoursPlayed} hrs</span>
            </div>

            {result.customer.isDiscountAvailable ? (
              <div className="rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-sm font-medium text-primary">
                ✓ Discount available
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress to discount</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{hoursUntil} hrs until next discount</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
