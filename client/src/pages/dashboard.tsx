import { useState, useEffect } from "react";
import { Clock, Menu } from "lucide-react";
import { StationCard, StationType } from "@/components/StationCard";
import { ActiveSessionPanel, SessionItem } from "@/components/ActiveSessionPanel";
import { AddItemsDialog, MenuItem } from "@/components/AddItemsDialog";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { StartSessionDialog } from "@/components/StartSessionDialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Station {
  id: string;
  name: string;
  type: StationType;
  isActive: boolean;
  isPaused?: boolean;
  startTime?: number;
  pausedTime?: number;
  items: { [itemId: string]: number };
}

const HOURLY_RATE = 16;
const RATE_PER_SECOND = HOURLY_RATE / 3600;

const initialMenuItems: MenuItem[] = [
  { id: "1", name: "Vanilla Latte", price: 4.99, category: "Lattes" },
  { id: "2", name: "Caramel Latte", price: 4.99, category: "Lattes" },
  { id: "3", name: "Brown Sugar Latte", price: 4.99, category: "Lattes" },
  { id: "4", name: "Biscoff Latte", price: 4.99, category: "Lattes" },
  { id: "5", name: "Pistachio Latte", price: 4.99, category: "Lattes" },
  { id: "6", name: "Adeni Tea", price: 4.49, category: "Tea" },
  { id: "7", name: "Berry Hibiscus Refresher", price: 4.49, category: "Refreshers" },
  { id: "8", name: "Mango Dragon Fruit Refresher", price: 4.49, category: "Refreshers" },
  { id: "9", name: "Strawberry Acai Refresher", price: 4.49, category: "Refreshers" },
  { id: "10", name: "Pomegranate Refresher", price: 4.49, category: "Refreshers" },
  { id: "11", name: "Blue Citrus Refresher", price: 4.49, category: "Refreshers" },
  { id: "12", name: "Slushie", price: 2.99, category: "Slushies" },
  { id: "13", name: "Cookies", price: 1.99, category: "Dessert" },
  { id: "14", name: "Milk Cake", price: 5.99, category: "Dessert" },
  { id: "15", name: "Banana Pudding", price: 4.49, category: "Dessert" },
];

const initialStations: Station[] = [
  { id: "P1", name: "Left 1", type: "pool", isActive: false, items: {} },
  { id: "P2", name: "Left 2", type: "pool", isActive: false, items: {} },
  { id: "P3", name: "Left 3", type: "pool", isActive: false, items: {} },
  { id: "P4", name: "Right 1", type: "pool", isActive: false, items: {} },
  { id: "P5", name: "Right 2", type: "pool", isActive: false, items: {} },
  { id: "P6", name: "Right 3", type: "pool", isActive: false, items: {} },
  { id: "G1", name: "Gaming Station 1", type: "gaming", isActive: false, items: {} },
  { id: "G2", name: "Gaming Station 2", type: "gaming", isActive: false, items: {} },
  { id: "G3", name: "Gaming Station 3", type: "gaming", isActive: false, items: {} },
  { id: "F1", name: "Foosball Table", type: "foosball", isActive: false, items: {} },
];

const STORAGE_KEYS = {
  STATIONS: 'poolcafe_stations',
  MENU: 'poolcafe_menu',
};

function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
    return defaultValue;
  }
}

export default function Dashboard() {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => 
    loadFromLocalStorage(STORAGE_KEYS.MENU, initialMenuItems)
  );
  const [stations, setStations] = useState<Station[]>(() => 
    loadFromLocalStorage(STORAGE_KEYS.STATIONS, initialStations)
  );

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [startSessionOpen, setStartSessionOpen] = useState(false);
  const [stationToStart, setStationToStart] = useState<string | null>(null);
  const [tempItems, setTempItems] = useState<{ [itemId: string]: number }>({});

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STATIONS, JSON.stringify(stations));
    } catch (error) {
      console.error('Error saving stations to localStorage:', error);
    }
  }, [stations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menuItems));
    } catch (error) {
      console.error('Error saving menu items to localStorage:', error);
    }
  }, [menuItems]);

  const selectedStation = stations.find((s) => s.id === selectedStationId);

  const handleOpenStartDialog = (stationId: string) => {
    setStationToStart(stationId);
    setStartSessionOpen(true);
  };

  const handleStartSession = (stationId: string, customStartTime?: number) => {
    const startTime = customStartTime || Date.now();
    setStations((prev) =>
      prev.map((s) =>
        s.id === stationId
          ? { ...s, isActive: true, startTime, items: {} }
          : s
      )
    );
    setSelectedStationId(stationId);
    toast({
      title: "Session Started",
      description: `Timer started for ${stations.find((s) => s.id === stationId)?.name}`,
    });
  };

  const handleStopSession = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    if (station?.isActive && !station.isPaused) {
      setStations((prev) =>
        prev.map((s) =>
          s.id === stationId
            ? { ...s, isPaused: true, pausedTime: Date.now() }
            : s
        )
      );
      toast({
        title: "Session Paused",
        description: `Timer paused for ${station.name}`,
      });
    }
  };

  const handleResumeSession = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    if (station?.isActive && station.isPaused && station.pausedTime && station.startTime) {
      const pausedDuration = Date.now() - station.pausedTime;
      setStations((prev) =>
        prev.map((s) =>
          s.id === stationId
            ? { 
                ...s, 
                isPaused: false, 
                pausedTime: undefined,
                startTime: s.startTime! + pausedDuration
              }
            : s
        )
      );
      toast({
        title: "Session Resumed",
        description: `Timer resumed for ${station.name}`,
      });
    }
  };

  const handleAddItems = () => {
    if (selectedStation) {
      setTempItems({ ...selectedStation.items });
      setAddItemsOpen(true);
    }
  };

  const handleAddCustomItem = (name: string, price: number) => {
    const customId = `custom-${Date.now()}`;
    const newItem: MenuItem = {
      id: customId,
      name,
      price,
      category: "Custom",
    };
    setMenuItems((prev) => [...prev, newItem]);
    setTempItems((prev) => ({ ...prev, [customId]: 1 }));
    toast({
      title: "Custom Item Added",
      description: `${name} ($${price.toFixed(2)}) added to cart`,
    });
  };

  const handleConfirmItems = () => {
    if (selectedStationId) {
      setStations((prev) =>
        prev.map((s) =>
          s.id === selectedStationId ? { ...s, items: { ...tempItems } } : s
        )
      );
      setAddItemsOpen(false);
      toast({
        title: "Items Added",
        description: "Items have been added to the tab",
      });
    }
  };

  const handleConfirmCheckout = () => {
    if (selectedStationId) {
      setStations((prev) =>
        prev.map((s) =>
          s.id === selectedStationId
            ? { ...s, isActive: false, isPaused: false, startTime: undefined, pausedTime: undefined, items: {} }
            : s
        )
      );
      setCheckoutOpen(false);
      setSelectedStationId(null);
      toast({
        title: "Payment Complete",
        description: "Session ended successfully",
      });
    }
  };

  const getTimeElapsed = (station: Station): number => {
    if (!station.isActive || !station.startTime) return 0;
    if (station.isPaused && station.pausedTime) {
      return Math.floor((station.pausedTime - station.startTime) / 1000);
    }
    return Math.floor((currentTime - station.startTime) / 1000);
  };

  const getTimeCharge = (station: Station): number => {
    const seconds = getTimeElapsed(station);
    return seconds * RATE_PER_SECOND;
  };

  const getSessionItems = (station: Station): SessionItem[] => {
    return Object.entries(station.items)
      .filter(([_, quantity]) => quantity > 0)
      .map(([itemId, quantity]) => {
        const menuItem = menuItems.find((m) => m.id === itemId)!;
        return {
          id: itemId,
          name: menuItem.name,
          price: menuItem.price,
          quantity,
        };
      });
  };

  const activeStationsCount = stations.filter((s) => s.isActive).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" data-testid="text-app-title">
                Rack Em Up
              </h1>
              <p className="text-sm text-muted-foreground">Pool Cafe Management</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm text-muted-foreground">Active Stations</p>
                <p className="text-xl font-mono font-bold" data-testid="text-active-count">
                  {activeStationsCount} / {stations.length}
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-sm text-muted-foreground">Current Time</p>
                <p className="text-xl font-mono font-bold" data-testid="text-current-time">
                  {new Date(currentTime).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">All Stations</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {stations.map((station) => (
                  <StationCard
                    key={station.id}
                    id={station.id}
                    name={station.name}
                    type={station.type}
                    isActive={station.isActive}
                    isPaused={station.isPaused}
                    timeElapsed={getTimeElapsed(station)}
                    currentCharge={getTimeCharge(station)}
                    onStart={() => handleOpenStartDialog(station.id)}
                    onStop={() => handleStopSession(station.id)}
                    onResume={() => handleResumeSession(station.id)}
                    onCompletePayment={() => {
                      setSelectedStationId(station.id);
                      setCheckoutOpen(true);
                    }}
                    onClick={() => {
                      if (station.isActive) {
                        setSelectedStationId(station.id);
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            {selectedStation?.isActive ? (
              <div className="sticky top-24 space-y-4">
                {activeStationsCount > 1 && (
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">
                      Active Session
                    </label>
                    <Select
                      value={selectedStationId || undefined}
                      onValueChange={(value) => setSelectedStationId(value)}
                    >
                      <SelectTrigger data-testid="select-active-session">
                        <SelectValue placeholder="Select a session" />
                      </SelectTrigger>
                      <SelectContent>
                        {stations
                          .filter((s) => s.isActive)
                          .map((station) => (
                            <SelectItem key={station.id} value={station.id}>
                              {station.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <ActiveSessionPanel
                  stationName={selectedStation.name}
                  timeElapsed={getTimeElapsed(selectedStation)}
                  timeCharge={getTimeCharge(selectedStation)}
                  items={getSessionItems(selectedStation)}
                  onAddItems={handleAddItems}
                  onCheckout={() => setCheckoutOpen(true)}
                />
              </div>
            ) : (
              <div className="sticky top-24">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Select an active station to view details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <StartSessionDialog
        open={startSessionOpen}
        onOpenChange={setStartSessionOpen}
        stationName={stationToStart ? stations.find((s) => s.id === stationToStart)?.name || "" : ""}
        onConfirmStart={(customStartTime) => {
          if (stationToStart) {
            handleStartSession(stationToStart, customStartTime);
          }
        }}
      />

      {selectedStation && (
        <>
          <AddItemsDialog
            open={addItemsOpen}
            onOpenChange={setAddItemsOpen}
            stationName={selectedStation.name}
            menuItems={menuItems}
            selectedItems={tempItems}
            onAddItem={(itemId) =>
              setTempItems((prev) => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }))
            }
            onRemoveItem={(itemId) =>
              setTempItems((prev) => {
                const newCount = (prev[itemId] || 0) - 1;
                if (newCount <= 0) {
                  const { [itemId]: _, ...rest } = prev;
                  return rest;
                }
                return { ...prev, [itemId]: newCount };
              })
            }
            onAddCustomItem={handleAddCustomItem}
            onConfirm={handleConfirmItems}
          />

          <CheckoutDialog
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
            stationName={selectedStation.name}
            timeElapsed={getTimeElapsed(selectedStation)}
            timeCharge={getTimeCharge(selectedStation)}
            items={getSessionItems(selectedStation)}
            onConfirmCheckout={handleConfirmCheckout}
          />
        </>
      )}
    </div>
  );
}
