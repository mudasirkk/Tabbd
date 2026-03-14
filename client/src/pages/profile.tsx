import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/lib/useAuthReady";
import { fetchWithAuth, patchWithAuth, postWithAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun, ArrowLeft, Upload, X, Link2, Unlink, RefreshCw, Upload as UploadIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import CloverSyncDialog from "@/components/CloverSyncDialog";
import CloverPushDialog from "@/components/CloverPushDialog";

interface MeResponse {
  uid: string;
  email: string | null;
  storeName: string | null;
  logoDataUrl: string | null;
  discountThresholdSeconds: number;
  discountRate: string;
  cloverMerchantId: string | null;
  cloverConnectedAt: string | null;
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
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);

  useEffect(() => {
    if (me) setStoreName(me.storeName ?? "");
  }, [me]);

  useEffect(() => {
    if (me) setLogoPreview(me.logoDataUrl ?? null);
  }, [me]);
  useEffect(() => {
    if (me != null) {
      setDiscountThresholdHours(String(Math.round(me.discountThresholdSeconds / 3600)));
      const rateNum = parseFloat(me.discountRate);
      setDiscountRatePct(Number.isNaN(rateNum) ? "" : String(Math.round(rateNum * 100)));
    }
  }, [me]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cloverStatus = params.get("clover");
    if (cloverStatus === "connected") {
      toast({ title: "Clover connected", description: "Your Clover account has been linked." });
      qc.invalidateQueries({ queryKey: ["me"] });
    } else if (cloverStatus === "error") {
      const reason = params.get("reason") ?? "unknown";
      const messages: Record<string, string> = {
        auth_failed: "OAuth authentication failed. Please try again.",
        invalid_params: "Missing or invalid parameters from Clover.",
        api_error: "Could not communicate with Clover. Please try again later.",
        unknown: "Something went wrong connecting to Clover.",
      };
      toast({
        title: "Clover connection failed",
        description: messages[reason] ?? messages.unknown,
        variant: "destructive",
      });
    }
    if (cloverStatus) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function connectClover() {
    try {
      const data = await fetchWithAuth<{ url: string }>("/api/clover/auth-url");
      window.location.href = data.url;
    } catch (e: any) {
      toast({ title: "Failed to start Clover connection", description: e?.message, variant: "destructive" });
    }
  }

  async function disconnectClover() {
    if (!confirm("Disconnect Clover? This will remove the integration but keep your menu items.")) return;
    try {
      await postWithAuth("/api/clover/disconnect");
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast({ title: "Clover disconnected" });
    } catch (e: any) {
      toast({ title: "Failed to disconnect", description: e?.message, variant: "destructive" });
    }
  }

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

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 200KB.", variant: "destructive" });
      return;
    }
    if (!file.type.match(/^image\/(png|jpeg|svg\+xml|webp)$/)) {
      toast({ title: "Invalid file type", description: "Use PNG, JPEG, SVG, or WebP.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    // reset input so the same file can be re-selected
    e.target.value = "";
  }

  async function saveLogo() {
    setLogoSaving(true);
    try {
      await patchWithAuth("/api/profile/logo", { logoDataUrl: logoPreview });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast({ title: "Logo saved" });
    } catch (e: any) {
      toast({ title: "Failed to save logo", description: e?.message ?? "Please try again", variant: "destructive" });
    } finally {
      setLogoSaving(false);
    }
  }

  async function removeLogo() {
    setLogoPreview(null);
    setLogoSaving(true);
    try {
      await patchWithAuth("/api/profile/logo", { logoDataUrl: null });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast({ title: "Logo removed" });
    } catch (e: any) {
      toast({ title: "Failed to remove logo", description: e?.message ?? "Please try again", variant: "destructive" });
    } finally {
      setLogoSaving(false);
    }
  }

  const logoChanged = logoPreview !== (me?.logoDataUrl ?? null);

  async function saveLoyalty() {
    const hours = Number(discountThresholdHours);
    const pct = Number(discountRatePct);
    if (Number.isNaN(hours) || hours < 1) {
      toast({ title: "Threshold must be at least 1 hour", variant: "destructive" });
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

  if (!authReady || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/50 px-4 py-3">
          <div className="container mx-auto max-w-screen-xl flex items-center justify-between">
            <Skeleton className="h-8 w-24" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
        </div>
        <div className="container mx-auto max-w-screen-xl px-4 py-6 flex justify-center">
          <div className="w-full max-w-xl space-y-6">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-56 rounded-lg" />
          </div>
        </div>
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

            <div className="border-t border-border/50 pt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Store Logo
              </p>
              <p className="text-xs text-muted-foreground">
                Displayed in the dashboard navbar. Max 200KB.
              </p>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-16 w-16 rounded-lg object-cover border border-border/60"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                  {logoPreview && (
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                      onClick={removeLogo}
                    >
                      <X className="w-3 h-3" /> Remove logo
                    </button>
                  )}
                </div>
              </div>
              {logoChanged && (
                <div className="flex justify-end pt-1">
                  <Button onClick={saveLogo} disabled={logoSaving}>
                    {logoSaving ? "Saving…" : "Save Logo"}
                  </Button>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Integrations
              </p>
              <p className="text-sm text-muted-foreground">
                Connect external services to sync your menu.
              </p>
            </div>

            <div className="border-t border-border/50 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Clover POS</p>
                  {me?.cloverMerchantId ? (
                    <p className="text-xs text-muted-foreground">
                      Connected{me.cloverConnectedAt && (
                        <> since {new Date(me.cloverConnectedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not connected</p>
                  )}
                </div>
                {me?.cloverMerchantId ? (
                  <Button variant="outline" size="sm" onClick={disconnectClover}>
                    <Unlink className="w-4 h-4 mr-1.5" />
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm" onClick={connectClover}>
                    <Link2 className="w-4 h-4 mr-1.5" />
                    Connect Clover
                  </Button>
                )}
              </div>

              {me?.cloverMerchantId && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setSyncOpen(true)}>
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Import / Sync from Clover
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setPushOpen(true)}>
                    <UploadIcon className="w-4 h-4 mr-1.5" />
                    Push to Clover
                  </Button>
                </div>
              )}
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

      <CloverSyncDialog open={syncOpen} onOpenChange={setSyncOpen} />
      <CloverPushDialog open={pushOpen} onOpenChange={setPushOpen} />
    </div>
  );
}
