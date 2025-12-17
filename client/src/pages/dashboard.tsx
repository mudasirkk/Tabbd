import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { StationCard, StationType } from "@/components/StationCard";
import { ActiveSessionPanel, SessionItem } from "@/components/ActiveSessionPanel";
import { AddItemsDialog, MenuItem } from "@/components/AddItemsDialog";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { StartSessionDialog } from "@/components/StartSessionDialog";
import { TransferSessionDialog } from "@/components/TransferSessionDialog";
import { PaymentProcessingOverlay } from "@/components/PaymentProcessingOverlay";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useStore } from "@/contexts/StoreContext";

/* ============================= TYPES ============================= */

interface Store {
  id: string;
  name: string;
}

interface StoredSessionItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
}

interface Station {
  id: string;
  name: string;
  type: StationType;
  isActive: boolean;
  isPaused?: boolean;
  startTime?: number;
  pausedTime?: number;
  items: StoredSessionItem[];
}

/* ============================= CONSTANTS ============================= */

const HOURLY_RATE = 16;
const RATE_PER_SECOND = HOURLY_RATE / 3600;

const STORAGE_KEY = "poolcafe_stations";

const initialStations: Station[] = [
  { id: "P1", name: "Left 1", type: "pool", isActive: false, items: [] },
  { id: "P2", name: "Left 2", type: "pool", isActive: false, items: [] },
  { id: "P3", name: "Left 3", type: "pool", isActive: false, items: [] },
  { id: "P4", name: "Right 1", type: "pool", isActive: false, items: [] },
  { id: "P5", name: "Right 2", type: "pool", isActive: false, items: [] },
  { id: "P6", name: "Right 3", type: "pool", isActive: false, items: [] },
  { id: "G1", name: "Gaming Left", type: "gaming", isActive: false, items: [] },
  { id: "G2", name: "Gaming Right", type: "gaming", isActive: false, items: [] },
  { id: "G3", name: "Gaming Station 3", type: "gaming", isActive: false, items: [] },
  { id: "F1", name: "Foosball Table", type: "foosball", isActive: false, items: [] },
];

function loadStations(): Station[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : initialStations;
  } catch {
    return initialStations;
  }
}

/* ============================= COMPONENT ============================= */

export default function Dashboard() {
  const { toast } = useToast();
  const { store, setStore } = useStore();

  /* ---------- AUTH (SINGLE SOURCE) ---------- */

  const {
    data: storeData,
    isLoading: authLoading,
  } = useQuery<Store>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  useEffect(() => {
    if (window.location.hash === "#_=_") {
      history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (storeData) {
      setStore(storeData);
    }
  }, [storeData, setStore]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading…</p>
      </div>
    );
  }

  /* ---------- STATE ---------- */

  const [currentTime, setCurrentTime] = useState(Date.now());
  const [stations, setStations] = useState<Station[]>(loadStations);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const [startSessionOpen, setStartSessionOpen] = useState(false);
  const [stationToStart, setStationToStart] = useState<string | null>(null);

  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const [tempItems, setTempItems] = useState<Record<string, number>>({});
  const [showPaymentProcessing, setShowPaymentProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState({ totalAmount: 0, itemCount: 0 });

  /* ---------- DATA ---------- */

  const { data: menuItems } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
  });

  const { data: squareDevices } = useQuery<any>({
    queryKey: ["/api/square/devices"],
  });

  /* ---------- EFFECTS ---------- */

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stations));
  }, [stations]);

  /* ---------- HELPERS ---------- */

  const selectedStation = stations.find((s) => s.id === selectedStationId);

  const getTimeElapsed = (station: Station) => {
    if (!station.isActive || !station.startTime) return 0;
    const end =
      station.isPaused && station.pausedTime ? station.pausedTime : currentTime;
    return Math.floor((end - station.startTime) / 1000);
  };

  const getTimeCharge = (station: Station) =>
    getTimeElapsed(station) * RATE_PER_SECOND;

  const getSessionItems = (station: Station): SessionItem[] =>
    station.items.map((i) => ({
      id: i.itemId,
      name: i.name,
      price: i.price,
      quantity: i.quantity,
    }));

  const activeStationsCount = stations.filter((s) => s.isActive).length;

  /* ============================= RENDER ============================= */

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Rack Em Up</h1>
            <p className="text-sm text-muted-foreground">Pool Cafe Management</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden sm:block text-right">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="font-semibold">{store?.name ?? "Store"}</p>
            </div>

            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await apiRequest("POST", "/api/auth/disconnect");
                } finally {
                  window.location.replace("/signin");
                }
              }}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">All Stations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {stations.map((station) => (
                <StationCard
                  key={station.id}
                  {...station}
                  timeElapsed={getTimeElapsed(station)}
                  currentCharge={getTimeCharge(station)}
                  onStart={() => {
                    setStationToStart(station.id);
                    setStartSessionOpen(true);
                  }}
                  onStop={() =>
                    setStations((p) =>
                      p.map((s) =>
                        s.id === station.id
                          ? { ...s, isPaused: true, pausedTime: Date.now() }
                          : s
                      )
                    )
                  }
                  onResume={() =>
                    setStations((p) =>
                      p.map((s) =>
                        s.id === station.id && s.pausedTime && s.startTime
                          ? {
                              ...s,
                              isPaused: false,
                              startTime:
                                s.startTime + (Date.now() - s.pausedTime),
                              pausedTime: undefined,
                            }
                          : s
                      )
                    )
                  }
                  onCompletePayment={() => {
                    setSelectedStationId(station.id);
                    setCheckoutOpen(true);
                  }}
                  onClick={() =>
                    station.isActive && setSelectedStationId(station.id)
                  }
                />
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            {selectedStation?.isActive ? (
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
                      {stations
                        .filter((s) => s.isActive)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}

                <ActiveSessionPanel
                  stationName={selectedStation.name}
                  timeElapsed={getTimeElapsed(selectedStation)}
                  timeCharge={getTimeCharge(selectedStation)}
                  startTime={selectedStation.startTime}
                  items={getSessionItems(selectedStation)}
                  onAddItems={() => setAddItemsOpen(true)}
                  onCheckout={() => setCheckoutOpen(true)}
                  onTransfer={() => setTransferOpen(true)}
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

      <StartSessionDialog
        open={startSessionOpen}
        onOpenChange={setStartSessionOpen}
        stationName={
          stationToStart
            ? stations.find((s) => s.id === stationToStart)?.name || ""
            : ""
        }
        onConfirmStart={(customStartTime) => {
          if (!stationToStart) return;
          setStations((p) =>
            p.map((s) =>
              s.id === stationToStart
                ? {
                    ...s,
                    isActive: true,
                    startTime: customStartTime ?? Date.now(),
                    items: [],
                  }
                : s
            )
          );
          setSelectedStationId(stationToStart);
        }}
      />

      {selectedStation && (
        <>
          <AddItemsDialog
            open={addItemsOpen}
            onOpenChange={setAddItemsOpen}
            stationName={selectedStation.name}
            menuItems={menuItems || []}
            selectedItems={tempItems}
            onAddItem={(id) =>
              setTempItems((p) => ({ ...p, [id]: (p[id] || 0) + 1 }))
            }
            onRemoveItem={(id) =>
              setTempItems((p) => {
                const v = (p[id] || 0) - 1;
                if (v <= 0) {
                  const { [id]: _, ...rest } = p;
                  return rest;
                }
                return { ...p, [id]: v };
              })
            }
            onConfirm={() => setAddItemsOpen(false)}
            squareConnected={true}
            onConnectSquare={() => {}}
          />

          <CheckoutDialog
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
            stationName={selectedStation.name}
            stationType={selectedStation.type}
            timeElapsed={getTimeElapsed(selectedStation)}
            timeCharge={getTimeCharge(selectedStation)}
            items={getSessionItems(selectedStation)}
            devices={squareDevices?.device_codes || []}
            squareConnected={true}
            onConfirmCheckout={({ grandTotal }) => {
              setPaymentData({
                totalAmount: grandTotal,
                itemCount: selectedStation.items.reduce(
                  (s, i) => s + i.quantity,
                  0
                ),
              });
              setShowPaymentProcessing(true);
              setCheckoutOpen(false);
            }}
          />

          <TransferSessionDialog
            open={transferOpen}
            onOpenChange={setTransferOpen}
            currentStationName={selectedStation.name}
            availableStations={stations.filter((s) => !s.isActive)}
            onConfirmTransfer={() => setTransferOpen(false)}
          />
        </>
      )}

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
