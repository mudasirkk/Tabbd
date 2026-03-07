import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/lib/useAuthReady";
import { fetchWithAuth, patchWithAuth, postWithAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun, ArrowLeft } from "lucide-react";

interface MeResponse {
  uid: string;
  email: string | null;
  storeName: string | null;
  discountThresholdSeconds: number;
  discountRate: string;
}

export default function ProfilePage() {
  const { ready: authReady, user } = useAuthReady();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!authReady) return;
    if (!user) window.location.replace("/signin");
  }, [authReady, user]);

  const { data: me, isLoading, error } = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => fetchWithAuth<MeResponse>("/api/me"),
    retry: false,
    enabled: authReady && !!user,
  });

  const [storeName, setStoreName] = useState("");
  const [discountThresholdHours, setDiscountThresholdHours] = useState("");
  const [discountRatePct, setDiscountRatePct] = useState("");

  useEffect(() => {
    if (me) setStoreName(me.storeName ?? "");
  }, [me]);
  useEffect(() => {
    if (me != null) {
      setDiscountThresholdHours(String(Math.round(me.discountThresholdSeconds / 3600)));
      const rateNum = parseFloat(me.discountRate);
      setDiscountRatePct(Number.isNaN(rateNum) ? "" : String(Math.round(rateNum * 100)));
    }
  }, [me]);

  async function save() {
    const trimmed = storeName.trim();
    if (!trimmed) {
      toast({ title: "Store name required", variant: "destructive" });
      return;
    }
    try {
      await patchWithAuth("/api/profile", { storeName: trimmed });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast({ title: "Settings updated", description: "Store name saved." });
    } catch (e: any) {
      toast({
        title: "Failed to save",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }

  async function saveLoyalty() {
    const hours = Number(discountThresholdHours);
    const pct = Number(discountRatePct);
    if (Number.isNaN(hours) || hours < 0) {
      toast({ title: "Enter valid hours (0 or more)", variant: "destructive" });
      return;
    }
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      toast({ title: "Discount rate must be between 0 and 100%", variant: "destructive" });
      return;
    }
    try {
      await postWithAuth("/api/settings/discount", {
        discountThresholdHours: hours,
        discountRate: pct / 100,
      });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast({ title: "Loyalty settings saved", description: "Discount rules updated." });
    } catch (e: any) {
      toast({
        title: "Failed to save",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="p-6 max-w-lg w-full space-y-3">
          <h2 className="text-lg font-semibold">Couldn’t load settings</h2>
          <p className="text-sm text-muted-foreground">
            Please refresh. If this keeps happening, sign out and sign back in.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh
            </Button>
            <Button onClick={() => window.location.replace("/signin")}>Go to Sign in</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <div className="container mx-auto max-w-screen-xl px-4 py-3 flex justify-between items-center gap-4">
          <h1 className="text-3xl font-bold font-display leading-tight">Settings</h1>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.assign("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-screen-xl px-4 py-6 flex justify-center">
        <div className="w-full max-w-xl space-y-6">

          <Card className="p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Account
              </p>
              <p className="text-xs text-muted-foreground mb-1">Email</p>
              <p className="font-mono text-sm text-foreground/80">{me?.email ?? "—"}</p>
            </div>

            <div className="border-t border-border/50 pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Store Settings
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Store Name</label>
                <Input
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="e.g., Rack Em Up"
                />
                <p className="text-xs text-muted-foreground">
                  This name appears in your Dashboard header.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setStoreName(me?.storeName ?? "")}>
                  Reset
                </Button>
                <Button onClick={save}>Save</Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Loyalty Program
              </p>
              <p className="text-sm text-muted-foreground">
                Set when customers qualify for a discount and how much they receive.
              </p>
            </div>

            <div className="border-t border-border/50 pt-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Hours to qualify for discount</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={discountThresholdHours}
                  onChange={(e) => setDiscountThresholdHours(e.target.value)}
                  placeholder="e.g. 20"
                />
                <p className="text-xs text-muted-foreground">
                  Customers become eligible for the discount after this many hours of play.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Discount rate (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={discountRatePct}
                  onChange={(e) => setDiscountRatePct(e.target.value)}
                  placeholder="e.g. 10"
                />
                <p className="text-xs text-muted-foreground">
                  Percentage off when the customer qualifies (e.g. 10 = 10% off).
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (me != null) {
                      setDiscountThresholdHours(String(Math.round(me.discountThresholdSeconds / 3600)));
                      const rateNum = parseFloat(me.discountRate);
                      setDiscountRatePct(Number.isNaN(rateNum) ? "" : String(Math.round(rateNum * 100)));
                    }
                  }}
                >
                  Reset
                </Button>
                <Button onClick={saveLoyalty}>Save</Button>
              </div>
            </div>
          </Card>

        </div>
      </main>
    </div>
  );
}
