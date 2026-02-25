import { useEffect, useMemo, useState } from "react";
import { useAuthReady } from "@/lib/useAuthReady";
import { Clock, LogOut, Hamburger, User as UserIcon, History as HistoryIcon, Lock, Unlock } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { StationCard, StationType } from "@/components/StationCard";
import { ActiveSessionPanel, SessionItem } from "@/components/ActiveSessionPanel";
import { SetupStationDialog } from "@/components/SetupStationDialog";
import { AddItemsDialog, MenuItem } from "@/components/AddItemsDialog";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { StartSessionDialog } from "@/components/StartSessionDialog";
import { TransferSessionDialog } from "@/components/TransferSessionDialog";
import { PaymentProcessingOverlay } from "@/components/PaymentProcessingOverlay";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth, postWithAuth, patchWithAuth, deleteWithAuth } from "@/lib/api";
import { auth } from "@/lib/firebaseClient";
import { signOut } from "firebase/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditStationDialog } from "@/components/EditStationDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

/* ============================= TYPES ============================= */

type PricingTier = "group" | "solo";

interface MeResponse {
  uid: string;
  email: string | null;
  storeName: string | null;
}

interface ApiSessionItem {
  id: string;
  sessionId: string;
  menuItemId: string;
  nameSnapshot: string;
  priceSnapshot: string | number;
  qty: number;
  createdAt: string;
}

interface ApiSession {
  id: string;
  userId: string;
  stationId: string;
  status: "active" | "paused" | "closed";
  startedAt: string;
  pausedAt: string | null;
  totalPausedSeconds: number;
  pricingTier: PricingTier;
  closedAt: string | null;
  items?: ApiSessionItem[];
  timeSegments?: Array<{
    id: string;
    sequence: number;
    stationId: string;
    stationName: string;
    stationType: string;
    startedAt: string;
    endedAt: string;
    effectiveSeconds: number;
    pricingTier: PricingTier;
    rateSoloHourlySnapshot: number;
    rateGroupHourlySnapshot: number;
    rateHourlyApplied: number;
    timeAmount: number;
  }>;
  accruedTimeSeconds?: number;
  accruedTimeCharge?: number;
}

interface ApiStation {
  id: string;
  userId: string;
  name: string;
  stationType: StationType;
  rateSoloHourly: string | number;
  rateGroupHourly: string | number;
  isEnabled: boolean;
  sortOrder: number;
  activeSession: (ApiSession & { items: ApiSessionItem[] }) | null;
}

/* ============================= Helpers ============================= */
function toNumber(v: string | number | null | undefined): number {
  if(v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

function aggregateSessionItems(items: ApiSessionItem[], menuItems: MenuItem[] = []): SessionItem[] {
  const menuCategoryById = new Map(
    (menuItems ?? []).map((menuItem) => [menuItem.id, (menuItem.category ?? "").trim() || "Miscellaneous"])
  );
  const map = new Map<string, SessionItem>();
  for (const row of items) {
    const key = row.menuItemId; // Aggregate by menu item
    const price = toNumber(row.priceSnapshot);
    const category = menuCategoryById.get(row.menuItemId) ?? "Miscellaneous";
    const existing = map.get(key);
    if(!existing) {
      map.set(key, {
        id: row.menuItemId,
        name: row.nameSnapshot,
        price,
        quantity: row.qty,
        category,
      });
    } else {
      existing.quantity += row.qty;
    }
  }
  return Array.from(map.values());
}

function computeElapsedSeconds(session: ApiSession, nowMs: number): number {
  const startMs = new Date(session.startedAt).getTime();
  const endMs = 
    session.status === "paused" && session.pausedAt
      ? new Date(session.pausedAt).getTime()
      : nowMs;
  const total = Math.max(0, Math.floor((endMs - startMs) / 1000));
  return Math.max(0, total - (session.totalPausedSeconds ?? 0));
}

/* ============================= COMPONENT ============================= */

export default function Dashboard() {
  const { ready: authReady, user } = useAuthReady();
  const { toast } = useToast();
  const qc = useQueryClient();

  const[now, setNow] = useState(Date.now());

  //Station Creation
  const [setupStationOpen, setSetupStationOpen] = useState(false);
  const [creatingStation, setCreatingStation] = useState(false);

  //right side panel selection
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  //dialogs
  const [startSessionOpen, setStartSessionOpen] = useState(false);
  const [stationToStart, setStationToStart] = useState<ApiStation | null>(null);

  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  //add-items local selection before confirm
  const [tempItems, setTempItems] = useState<Record<string, number>>({});

  // payment overlay (still optional UI)
  const [showPaymentProcessing, setShowPaymentProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState({ totalAmount: 0, itemCount: 0 });

  const [editStationOpen, setEditStationOpen] = useState(false);
  const [stationToEdit, setStationToEdit] = useState<ApiStation | null>(null);

  const [removeItemOpen, setRemoveItemOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SessionItem | null>(null);
  const [removeQty, setRemoveQty] = useState<number>(1);
  const [isDragUnlocked, setIsDragUnlocked] = useState(false);
  const [dragStationId, setDragStationId] = useState<string | null>(null);
  const [dragOverStationId, setDragOverStationId] = useState<string | null>(null);
  const [reorderingStations, setReorderingStations] = useState(false);
  const [localStationOrder, setLocalStationOrder] = useState<string[] | null>(null);


  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ---------- DATA ---------- */

  const{ data: me, isLoading: meLoading, } = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: () => fetchWithAuth<MeResponse>("/api/me"),
    retry: false,
    enabled: authReady && !!user,
  });

  const { data: menu } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: () => fetchWithAuth<MenuItem[]>("/api/menu"),
    retry: false,
    enabled: authReady && !!user,
  });

  const { data: stations, isLoading: stationsLoading } = useQuery<ApiStation[]>({
    queryKey: ["stations"],
    queryFn: () => fetchWithAuth<ApiStation[]>("/api/stations"),
    retry: false,
    enabled: authReady && !!user,
  });

  // If token expired / logged out
  useEffect(() => {
    if (!authReady) return;
    if(!user) window.location.replace("/signin");
  }, [authReady, user]);

  const selectedStation = useMemo(() => {
    if (!stations || !selectedStationId) return null;
    return stations.find((s) => s.id === selectedStationId) ?? null;
  }, [stations, selectedStationId]);

  const activeStations = useMemo(
    () => (stations ?? []).filter((s) => s.activeSession && s.activeSession.status !== "closed"),
    [stations]
  );

  const orderedStations = useMemo(() => {
    const base = [...(stations ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    if (!localStationOrder || localStationOrder.length !== base.length) return base;

    const byId = new Map(base.map((station) => [station.id, station]));
    const reordered = localStationOrder
      .map((id) => byId.get(id))
      .filter((station): station is ApiStation => !!station);

    if (reordered.length !== base.length) return base;
    return reordered;
  }, [stations, localStationOrder]);

  useEffect(() => {
    if (!localStationOrder || !stations) return;
    const stationIds = new Set(stations.map((station) => station.id));
    const hasMismatch =
      localStationOrder.length !== stations.length ||
      localStationOrder.some((id) => !stationIds.has(id));

    if (hasMismatch) setLocalStationOrder(null);
  }, [localStationOrder, stations]);

  const activeStationsCount = activeStations.length;
  
  function getCurrentSegmentElapsedForStation(st: ApiStation): number {
    if (!st.activeSession) return 0;
    return computeElapsedSeconds(st.activeSession, now);
  }

  function getCurrentSegmentChargeForStation(st: ApiStation, pricingTier: PricingTier = "group"): number {
    if (!st.activeSession) return 0;
  
    const elapsed = computeElapsedSeconds(st.activeSession, now);

    const rate =
      pricingTier === "solo" ? toNumber(st.rateSoloHourly) : toNumber(st.rateGroupHourly);
  
    return (elapsed / 3600) * rate;
  }

  function getAccruedTimeSeconds(st: ApiStation): number {
    return st.activeSession?.accruedTimeSeconds ?? 0;
  }

  function getAccruedTimeCharge(st: ApiStation): number {
    return st.activeSession?.accruedTimeCharge ?? 0;
  }

  function getTotalElapsedForStation(st: ApiStation): number {
    return getAccruedTimeSeconds(st) + getCurrentSegmentElapsedForStation(st);
  }

  function getTotalTimeChargeForStation(st: ApiStation, pricingTier: PricingTier = "group"): number {
    return getAccruedTimeCharge(st) + getCurrentSegmentChargeForStation(st, pricingTier);
  }
  

  async function handleLogout() {
    try {
      await signOut(auth);
    } finally {
      window.location.replace("/signin");
    }
  }

  async function handleConfirmAddItems(st: ApiStation) {
    const session = st.activeSession;
    if (!session) return;

    const entries = Object.entries(tempItems).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      setAddItemsOpen(false);
      return;
    }

    try {
      // send items sequentially (simple + predictable). You can batch later if desired.
      for (const [menuItemId, qty] of entries) {
        await postWithAuth(`/api/sessions/${session.id}/items`, { menuItemId, qty });
      }

      toast({ title: "Items added", description: "Stock updated and items added to the tab." });
      setTempItems({});
      setAddItemsOpen(false);

      // refresh stations + menu stock
      await qc.invalidateQueries({ queryKey: ["stations"] });
      await qc.invalidateQueries({ queryKey: ["menu"] });
    } catch (e: any) {
      toast({
        title: "Couldn’t add items",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }

  function openRemoveItemDialog(item: SessionItem) {
    setRemoveTarget(item);
    setRemoveQty(1);
    setRemoveItemOpen(true);
  }
  
  async function submitRemoveQty(qty: number) {
    const st = selectedStation;
    const session = st?.activeSession;
    if (!st || !session || !removeTarget) return;
  
    const clamped = Math.max(1, Math.min(qty, removeTarget.quantity));
  
    try {
      const res = await postWithAuth<{ removedQty: number; menuItemId: string }>(
        `/api/sessions/${session.id}/items/remove`,
        { menuItemId: removeTarget.id, qty: clamped }
      );
  
      toast({
        title: "Item removed",
        description:
          res.removedQty >= removeTarget.quantity
            ? `Removed all ${removeTarget.name}.`
            : `Removed ${res.removedQty} of ${removeTarget.name}.`,
      });
  
      setRemoveItemOpen(false);
      setRemoveTarget(null);
  
      await qc.invalidateQueries({ queryKey: ["stations"] });
      await qc.invalidateQueries({ queryKey: ["menu"] });
    } catch (e: any) {
      toast({
        title: "Failed to remove item",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }  

  async function handleStartSession(st: ApiStation, pricingTier: PricingTier, customStartTime?: number | null) {
    try {
      await postWithAuth("/api/sessions/start", {
        stationId: st.id,
        pricingTier,
        startedAt: customStartTime ? new Date(customStartTime).toISOString() : undefined,
      });

      toast({ title: "Session started", description: `${st.name} is now active.` });

      setStartSessionOpen(false);
      setStationToStart(null);
      setSelectedStationId(st.id);

      await qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      toast({
        title: "Failed to start session",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }

  async function handlePause(st: ApiStation) {
    if (!st.activeSession) return;
    try {
      await postWithAuth(`/api/sessions/${st.activeSession.id}/pause`);
      await qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      toast({
        title: "Failed to pause",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }

  async function handleResume(st: ApiStation) {
    if (!st.activeSession) return;
    try {
      await postWithAuth(`/api/sessions/${st.activeSession.id}/resume`);
      await qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      toast({
        title: "Failed to resume",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }

  async function handleConfirmTransfer(payload: {
    destinationStationId: string;
    endingPricingTier: PricingTier;
    nextPricingTier: PricingTier;
  }) {
    const st = selectedStation;
    const session = st?.activeSession;
  
    if (!st || !session) return;
    const { destinationStationId, endingPricingTier, nextPricingTier } = payload;
    const destination = stations?.find((s) => s.id === destinationStationId);
    if (!destination) {
      toast({
        title: "Failed to transfer",
        description: "Please select an available station.",
        variant: "destructive",
      });
      return;
    }
  
    try {
      await postWithAuth(`/api/sessions/${session.id}/transfer`, {
        destinationStationId,
        endingPricingTier,
        nextPricingTier,
      });
  
      toast({
        title: "Session transferred",
        description: `Moved Session from ${st.name} to ${destination?.name ?? "selected station"}.`,
      });
  
      setTransferOpen(false);
      setSelectedStationId(destinationStationId);
  
      await qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      toast({
        title: "Failed to transfer",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }
  

  async function handleCheckoutConfirm(
    st: ApiStation,
    payload: {
      pricingTier: PricingTier;
      currentSegmentPricingTier: PricingTier;
      segmentTierOverrides: Array<{ segmentId: string; pricingTier: PricingTier }>;
      grandTotal: number;
    }
  ) {
    if (!st.activeSession) return;
    const { pricingTier, currentSegmentPricingTier, segmentTierOverrides, grandTotal } = payload;

    try {
      await postWithAuth(`/api/sessions/${st.activeSession.id}/close`, {
        pricingTier,
        currentSegmentPricingTier,
        segmentTierOverrides,
      });

      setCheckoutOpen(false);
      setPaymentData({
        totalAmount: grandTotal,
        itemCount: (st.activeSession.items ?? []).reduce((sum, row) => sum + row.qty, 0),
      });
      setShowPaymentProcessing(true);

      await qc.invalidateQueries({ queryKey: ["stations"] });
      await qc.invalidateQueries({ queryKey: ["session-history"] });
    } catch (e: any) {
      toast({
        title: "Failed to checkout",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }

  if(!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (meLoading || stationsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }
  
  async function createStation(payload: {
    name: string;
    stationType: StationType;
    rateSoloHourly: string;
    rateGroupHourly: string;
    isEnabled: boolean;
  }) {
    setCreatingStation(true);
    try {
      await postWithAuth("/api/stations", payload);

      toast({ title: "Station created" });
      await qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      toast({
        title: "Failed to create station",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
      throw e;
    } finally {
      setCreatingStation(false);
    }
  }


  function openEditStation(st: ApiStation) {
    setStationToEdit(st);
    setEditStationOpen(true);
  }

  async function handleSaveStation(patch: {
    id: string;
    name: string;
    stationType: StationType;
    rateSoloHourly: string;
    rateGroupHourly: string;
    isEnabled: boolean;
  }) {
    try{
      await patchWithAuth(`/api/stations/${patch.id}`, {
        name: patch.name,
        stationType: patch.stationType,
        rateSoloHourly: patch.rateSoloHourly,
        rateGroupHourly: patch.rateGroupHourly,
        isEnabled: patch.isEnabled,
      });

      toast({ title: "Station updated" });
      setEditStationOpen(false);
      setStationToEdit(null);
      await qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      toast({
        title: "Failed to update station",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
      throw e;
    }
  }

  async function handleDeleteStation(st: ApiStation) {
    if(!confirm(`Delete station "${st.name}"?`)) return;
    try {
      await deleteWithAuth(`/api/stations/${st.id}`);
      toast({ title: "Station deleted" });

      if(selectedStationId === st.id) setSelectedStationId(null);

      await qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      toast({
        title: "Failed to delete station",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
    }
  }

  async function persistStationOrder(stationIds: string[]) {
    setReorderingStations(true);
    try {
      await patchWithAuth("/api/stations/reorder", { stationIds });
      await qc.invalidateQueries({ queryKey: ["stations"] });
    } catch (e: any) {
      setLocalStationOrder(null);
      toast({
        title: "Failed to reorder stations",
        description: e?.message ?? "Please try again",
        variant: "destructive",
      });
      await qc.invalidateQueries({ queryKey: ["stations"] });
    } finally {
      setReorderingStations(false);
    }
  }

  function handleStationDragStart(stationId: string) {
    if (!isDragUnlocked || reorderingStations) return;
    setDragStationId(stationId);
    setDragOverStationId(stationId);
  }

  function handleStationDragOver(stationId: string) {
    if (!isDragUnlocked || !dragStationId || reorderingStations) return;
    setDragOverStationId(stationId);
  }

  function handleStationDragEnd() {
    setDragStationId(null);
    setDragOverStationId(null);
  }

  async function handleStationDrop(dropStationId: string) {
    if (!isDragUnlocked || !dragStationId || dragStationId === dropStationId || reorderingStations) {
      handleStationDragEnd();
      return;
    }

    const ids = orderedStations.map((station) => station.id);
    const fromIndex = ids.indexOf(dragStationId);
    const toIndex = ids.indexOf(dropStationId);
    if (fromIndex === -1 || toIndex === -1) {
      handleStationDragEnd();
      return;
    }

    const nextIds = [...ids];
    const [moved] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, moved);

    setLocalStationOrder(nextIds);
    handleStationDragEnd();
    await persistStationOrder(nextIds);
  }

  /* ============================= RENDER ============================= */

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">{me?.storeName ?? "Tabb'd"}</h1>
            <p className="text-sm text-muted-foreground">
              Station & Tab Dashboard
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => window.location.assign("/menu")}>
              <Hamburger className="w-4 h-4 mr-2" />
              Menu
            </Button>
            <Button variant="outline" onClick={() => window.location.assign("/history")}>
              <HistoryIcon className="w-4 h-4 mr-2" />
              History
            </Button>
            <Button variant="outline" onClick={() => window.location.assign("/profile")}>
              <UserIcon className="w-4 h-4 mr-2" />
              Profile
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stations grid*/}
          <div className="lg:col-span-2">

            {/*Add Station Button*/}
            <div className="flex gap-2 mb-4">
              <Button onClick={() => setSetupStationOpen(true)} disabled={creatingStation}>
                Add Station
              </Button>
            </div>


            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">All Stations</h2>
              <Button
                variant={isDragUnlocked ? "default" : "outline"}
                onClick={() => setIsDragUnlocked((prev) => !prev)}
                disabled={reorderingStations}
                data-testid="button-toggle-station-order-lock"
              >
                {isDragUnlocked ? (
                  <>
                    <Unlock className="w-4 h-4 mr-2" />
                    Unlocked
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Locked
                  </>
                )}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {orderedStations.map((st) => {
                const session = st.activeSession;
                const isActive = !!session && session.status !== "closed";
                const isPaused = session?.status === "paused";

                return(
                  <StationCard
                    key={st.id}
                    id={st.id}
                    name={st.name}
                    type={st.stationType}
                    isActive={isActive}
                    isPaused={isPaused}
                    rateSoloHourly={st.rateSoloHourly}
                    rateGroupHourly={st.rateGroupHourly}
                    currentPricingTier={session?.pricingTier}
                    startTime={session ? new Date(session.startedAt).getTime() : undefined}
                    timeElapsed={isActive ? getTotalElapsedForStation(st) : 0}
                    currentCharge={isActive ? getTotalTimeChargeForStation(st, (session?.pricingTier ?? "group") as PricingTier) : 0}
                    onEdit={() => openEditStation(st)}
                    onDelete={() => handleDeleteStation(st)}
                    onStart={() => {
                      setStationToStart(st);
                      setStartSessionOpen(true);
                    }}
                    onStop={() => handlePause(st)}
                    onResume={() => handleResume(st)}
                    onCompletePayment={() => {
                      setSelectedStationId(st.id);
                      setCheckoutOpen(true);
                    }}
                    onClick={() => isActive && setSelectedStationId(st.id)}
                    dragEnabled={isDragUnlocked}
                    isDragOver={isDragUnlocked && dragOverStationId === st.id && dragStationId !== st.id}
                    dragHandleProps={{
                      draggable: isDragUnlocked && !reorderingStations,
                      onDragStart: (e) => {
                        e.stopPropagation();
                        e.dataTransfer.effectAllowed = "move";
                        handleStationDragStart(st.id);
                      },
                      onDragEnd: () => handleStationDragEnd(),
                    }}
                    dropZoneProps={{
                      onDragOver: (e) => {
                        if (!isDragUnlocked || reorderingStations) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        handleStationDragOver(st.id);
                      },
                      onDrop: (e) => {
                        if (!isDragUnlocked || reorderingStations) return;
                        e.preventDefault();
                        void handleStationDrop(st.id);
                      },
                    }}
                    />
                );
              })}
            </div>
          </div>

          {/* Right Panel */}
          <div className="lg:col-span-1">
            {selectedStation?.activeSession && selectedStation.activeSession.status !== "closed" ? (
              <div className="sticky top-24 space-y-4">
                {activeStationsCount > 1 && (
                  <Select
                    value={selectedStationId ?? undefined}
                    onValueChange={setSelectedStationId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {activeStations.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <ActiveSessionPanel
                  stationName={selectedStation.name}
                  timeElapsed={getTotalElapsedForStation(selectedStation)}
                  timeCharge={getTotalTimeChargeForStation(selectedStation, selectedStation.activeSession.pricingTier)}
                  startTime={new Date(selectedStation.activeSession.startedAt).getTime()}
                  timeSegments={(selectedStation.activeSession.timeSegments ?? []).map((segment) => ({
                    id: segment.id,
                    stationName: segment.stationName,
                    effectiveSeconds: segment.effectiveSeconds,
                    pricingTier: segment.pricingTier,
                    rateHourlyApplied: toNumber(segment.rateHourlyApplied),
                    timeAmount: toNumber(segment.timeAmount),
                  }))}
                  currentPricingTier={selectedStation.activeSession.pricingTier}
                  currentHourlyRate={
                    selectedStation.activeSession.pricingTier === "solo"
                      ? toNumber(selectedStation.rateSoloHourly)
                      : toNumber(selectedStation.rateGroupHourly)
                  }
                  currentSegmentCharge={getCurrentSegmentChargeForStation(selectedStation, selectedStation.activeSession.pricingTier)}
                  items={aggregateSessionItems(selectedStation.activeSession.items ?? [], menu ?? [])}
                  onAddItems={() => setAddItemsOpen(true)}
                  onCheckout={() => setCheckoutOpen(true)}
                  onTransfer={() => setTransferOpen(true)}
                  onRequestRemoveItem={openRemoveItemDialog}
                />
              </div>
            ) : (
              <div className="sticky top-24 border-2 border-dashed rounded-lg p-8 text-center">
                <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Select an active station to view details
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Setup Station (Create) */}
      <SetupStationDialog
        open={setupStationOpen}
        onOpenChange={setSetupStationOpen}
        onCreate={(payload) => createStation(payload)}
      />


      {/* Edit Session */}
      <EditStationDialog
        open={editStationOpen}
        onOpenChange={setEditStationOpen}
        station={stationToEdit}
        onSave={handleSaveStation}
      />

      {/* Start Session */}
      <StartSessionDialog
        open={startSessionOpen}
        onOpenChange={setStartSessionOpen}
        stationName={stationToStart?.name ?? ""}
        rateSoloHourly={stationToStart?.rateSoloHourly}
        rateGroupHourly={stationToStart?.rateGroupHourly}
        onConfirmStart={(customStartTime, pricingTier) => {
          if(!stationToStart) return;
          handleStartSession(stationToStart, pricingTier, customStartTime ?? null);
        }}
      />

      {/* Active station dialogs */}
      {selectedStation?.activeSession && selectedStation.activeSession.status !== "closed" ? (
        <>
          <AddItemsDialog
            open={addItemsOpen}
            onOpenChange={setAddItemsOpen}
            stationName={selectedStation.name}
            menuItems={menu ?? []}
            selectedItems={tempItems}
            onAddItem={(id) => setTempItems((p) => ({ ...p, [id]: (p[id] || 0) + 1 }))}
            onRemoveItem={(id) =>
              setTempItems((p) => {
                const v = (p[id] || 0) -1;
                if(v <= 0) {
                  const { [id]: _, ...rest } = p;
                  return rest;
                }
                return { ...p, [id]: v };
              })
            }
            onConfirm={() => handleConfirmAddItems(selectedStation)}
        />

        <CheckoutDialog
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
            stationName={selectedStation.name}
            currentSegmentSeconds={getCurrentSegmentElapsedForStation(selectedStation)}
            accruedTimeSeconds={getAccruedTimeSeconds(selectedStation)}
            groupHourlyRate={toNumber(selectedStation.rateGroupHourly)}
            soloHourlyRate={toNumber(selectedStation.rateSoloHourly)}
            pricingTier={selectedStation.activeSession.pricingTier}
            timeSegments={(selectedStation.activeSession.timeSegments ?? []).map((segment) => ({
              id: segment.id,
              stationName: segment.stationName,
              effectiveSeconds: segment.effectiveSeconds,
              pricingTier: segment.pricingTier,
              rateSoloHourlySnapshot: toNumber(segment.rateSoloHourlySnapshot),
              rateGroupHourlySnapshot: toNumber(segment.rateGroupHourlySnapshot),
            }))}
            items={aggregateSessionItems(selectedStation.activeSession.items ?? [], menu ?? [])}
            onConfirmCheckout={({ grandTotal, pricingTier, currentSegmentPricingTier, segmentTierOverrides }) =>
              handleCheckoutConfirm(selectedStation, {
                grandTotal,
                pricingTier,
                currentSegmentPricingTier,
                segmentTierOverrides,
              })
            }
          />

        <TransferSessionDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        currentStationName={selectedStation.name}
        currentPricingTier={selectedStation.activeSession.pricingTier}
        availableStations={(stations ?? []).filter((s) => 
          s.id !== selectedStationId && 
          (!s.activeSession || s.activeSession.status === "closed")
        )
        .map((s) => ({id: s.id, name: s.name, stationType: s.stationType }))}
        onConfirmTransfer={handleConfirmTransfer}
        />

<Dialog open={removeItemOpen} onOpenChange={setRemoveItemOpen}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>Remove Item</DialogTitle>
      <DialogDescription>
        {removeTarget ? (
          <>
            How many <span className="font-semibold text-foreground">{removeTarget.name}</span> do you want to remove?
            <div className="mt-1 text-xs text-muted-foreground">
              On tab: {removeTarget.quantity}
            </div>
          </>
        ) : (
          "Select an item to remove."
        )}
      </DialogDescription>
    </DialogHeader>

    {removeTarget && (
      <div className="space-y-2 py-2">
        <Label htmlFor="remove-qty">Quantity</Label>
        <Input
          id="remove-qty"
          type="number"
          min={1}
          max={removeTarget.quantity}
          value={removeQty}
          onChange={(e) => setRemoveQty(Number(e.target.value))}
        />
      </div>
    )}

    <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            disabled={!removeTarget}
            onClick={() => removeTarget && submitRemoveQty(removeTarget.quantity)}
          >
            Remove All
          </Button>

          <Button
            disabled={!removeTarget}
            onClick={() => submitRemoveQty(removeQty)}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
        </>
      ) : null}

      

      <PaymentProcessingOverlay
        show={showPaymentProcessing}
        onComplete={() => {
          setShowPaymentProcessing(false);
          setSelectedStationId(null);
        }}
        totalAmount={paymentData.totalAmount}
        itemCount={paymentData.itemCount}
      />
    </div>
  );
}
