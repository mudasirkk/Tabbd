import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthReady } from "@/lib/useAuthReady";
import { fetchWithAuth, patchWithAuth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface MeResponse {
    uid: string;
    email: string | null;
    storeName: string | null;
  }

  export default function ProfilePage() {
    const { ready: authReady, user } = useAuthReady();
    const { toast } = useToast();
    const qc = useQueryClient();
  
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
  
    useEffect(() => {
      if (me) setStoreName(me.storeName ?? "");
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
        toast({ title: "Profile updated", description: "Store name saved." });
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
            <h2 className="text-lg font-semibold">Couldn’t load profile</h2>
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
        <header className="border-b sticky top-0 bg-background z-10">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Profile</h1>
              <p className="text-sm text-muted-foreground">Account settings</p>
            </div>
            <Button variant="outline" onClick={() => window.location.assign("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </header>
  
        <main className="container mx-auto px-4 py-6">
          <Card className="max-w-xl p-6 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{me?.email ?? "—"}</p>
            </div>
  
            <div className="space-y-2">
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
  
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStoreName(me?.storeName ?? "")}>
                Reset
              </Button>
              <Button onClick={save}>Save</Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }