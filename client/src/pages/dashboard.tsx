import { useState, useEffect } from "react";
import { Clock, UtensilsCrossed, Link as LinkIcon } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StationCard, StationType } from "@/components/StationCard";
import { ActiveSessionPanel, SessionItem } from "@/components/ActiveSessionPanel";
import { AddItemsDialog, MenuItem } from "@/components/AddItemsDialog";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { StartSessionDialog } from "@/components/StartSessionDialog";
import { TransferSessionDialog } from "@/components/TransferSessionDialog";
import { PaymentProcessingOverlay } from "@/components/PaymentProcessingOverlay";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthProvider";
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
import { queryClient, apiRequest } from "@/lib/queryClient";

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

const HOURLY_RATE = 16;
const RATE_PER_SECOND = HOURLY_RATE / 3600;


// IMPORTANT: When updating station definitions, also update the correctNames map
// in the station migration effect below (search for "correctNames")
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

const STORAGE_KEYS = {
  STATIONS: 'poolcafe_stations',
  MENU: 'poolcafe_menu',
};

function loadFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    
    const parsed = JSON.parse(stored);
    
    // No migration here - will be handled after menuItems loads
    return parsed;
  } catch (error) {
    console.error(`Error loading ${key} from localStorage:`, error);
    return defaultValue;
  }
}

interface SquareStatus {
  connected: boolean;
  merchantId: string | null;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const { logout } = useAuth();
  
  const { data: squareStatus, isLoading: squareStatusLoading } = useQuery<SquareStatus>({
    queryKey: ["/api/square/status"],
    staleTime: 30000,
  });

  const { data: menuItems, isLoading: menuLoading, error: menuError, refetch } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
    retry: 3,
    retryDelay: 1000,
    staleTime: 0,
    refetchOnMount: 'always',
    enabled: !!squareStatus?.connected,
  });

  const { data: squareLocations, isLoading: locationsLoading, error: locationsError } = useQuery<any>({
    queryKey: ["/api/square/locations"],
    enabled: !!squareStatus?.connected,
    staleTime: 60000,
  });

  const { data: squareDevices, isLoading: devicesLoading } = useQuery<any>({
    queryKey: ["/api/square/devices"],
    enabled: !!squareStatus?.connected,
    staleTime: 60000,
  });
  
  
  const [stations, setStations] = useState<Station[]>(() => 
    loadFromLocalStorage(STORAGE_KEYS.STATIONS, initialStations)
  );
  const [migrationDone, setMigrationDone] = useState(false);
  const [namesMigrated, setNamesMigrated] = useState(false);

  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [startSessionOpen, setStartSessionOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [showPaymentProcessing, setShowPaymentProcessing] = useState(false);
  const [paymentData, setPaymentData] = useState<{ totalAmount: number; itemCount: number }>({ 
    totalAmount: 0, 
    itemCount: 0 
  });
  const [stationToStart, setStationToStart] = useState<string | null>(null);
  const [tempItems, setTempItems] = useState<{ [itemId: string]: number }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('square_connected') === 'true') {
      toast({
        title: "Square Connected",
        description: "Your Square account has been successfully connected!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/square/status"] });
      window.history.replaceState({}, '', '/');
    }
  }, [toast]);

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

  
  // Migration effect: Convert old items format to new format
  useEffect(() => {
    if (migrationDone) return;
    
    let needsUpdate = false;
    let hasPlaceholders = false;
    
    const updatedStations = stations.map((station: any) => {
      if (station.items && !Array.isArray(station.items)) {
        // Old format: { [itemId]: number } - convert to array
        needsUpdate = true;
        const oldItems = station.items as { [itemId: string]: number };
        const newItems: StoredSessionItem[] = [];
        
        Object.entries(oldItems).forEach(([itemId, quantity]) => {
          if (quantity <= 0) return;
          
          const menuItem = menuItems?.find((m) => m.id === itemId);
          if (menuItem) {
            const price = typeof menuItem.price === 'number' ? menuItem.price : parseFloat(menuItem.price);
            newItems.push({ itemId, name: menuItem.name, quantity, price });
          } else {
            hasPlaceholders = true;
            newItems.push({ itemId, name: `Unknown Item (${itemId})`, quantity, price: 0 });
          }
        });
        
        return { ...station, items: newItems };
      } else if (Array.isArray(station.items) && menuItems && menuItems.length > 0) {
        // Already migrated - check for placeholders to update
        const updatedItems = station.items.map((item: StoredSessionItem) => {
          if (item.price === 0 && item.name.startsWith('Unknown Item')) {
            const menuItem = menuItems.find((m) => m.id === item.itemId);
            if (menuItem) {
              needsUpdate = true;
              const price = typeof menuItem.price === 'number' ? menuItem.price : parseFloat(menuItem.price);
              return { ...item, name: menuItem.name, price };
            } else {
              hasPlaceholders = true;
            }
          } else if (item.price === 0) {
            hasPlaceholders = true;
          }
          return item;
        });
        
        if (needsUpdate) {
          return { ...station, items: updatedItems };
        }
      }
      return station;
    });
    
    if (needsUpdate) {
      setStations(updatedStations);
      if (!hasPlaceholders) {
        setMigrationDone(true);
      }
    } else {
      // No updates needed - check if we can mark migration as done
      const hasLegacyFormat = stations.some((s: any) => s.items && !Array.isArray(s.items));
      const hasAnyPlaceholders = stations.some((s: Station) => 
        Array.isArray(s.items) && s.items.some(item => item.price === 0)
      );
      
      if (!hasLegacyFormat && !hasAnyPlaceholders) {
        setMigrationDone(true);
      }
    }
  }, [menuItems, stations, migrationDone]);

  // Station name and missing stations migration effect
  useEffect(() => {
    if (namesMigrated) return;

    const correctNames: { [id: string]: string } = {
      P1: "Left 1",
      P2: "Left 2",
      P3: "Left 3",
      P4: "Right 1",
      P5: "Right 2",
      P6: "Right 3",
      G1: "Gaming Left",
      G2: "Gaming Right",
      G3: "Gaming Station 3",
      F1: "Foosball Table",
    };

    let needsUpdate = false;
    
    // First, update names of existing stations
    let updatedStations = stations.map((station) => {
      const correctName = correctNames[station.id];
      if (correctName && station.name !== correctName) {
        needsUpdate = true;
        return { ...station, name: correctName };
      }
      return station;
    });

    // Then, check for missing stations and add them
    const existingIds = new Set(updatedStations.map(s => s.id));
    const missingStations = initialStations.filter(s => !existingIds.has(s.id));
    
    if (missingStations.length > 0) {
      needsUpdate = true;
      updatedStations = [...updatedStations, ...missingStations];
    }

    // Ensure stations are in the correct order based on initialStations
    const correctOrder = initialStations.map(s => s.id);
    const currentOrder = updatedStations.map(s => s.id).join(',');
    const expectedOrder = updatedStations.slice().sort((a, b) => {
      const aIndex = correctOrder.indexOf(a.id);
      const bIndex = correctOrder.indexOf(b.id);
      return aIndex - bIndex;
    }).map(s => s.id).join(',');
    
    if (currentOrder !== expectedOrder) {
      needsUpdate = true;
      updatedStations = updatedStations.slice().sort((a, b) => {
        const aIndex = correctOrder.indexOf(a.id);
        const bIndex = correctOrder.indexOf(b.id);
        return aIndex - bIndex;
      });
    }

    if (needsUpdate) {
      setStations(updatedStations);
      setNamesMigrated(true);
    } else {
      setNamesMigrated(true);
    }
  }, [stations, namesMigrated]);

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
          ? { ...s, isActive: true, startTime, items: [] }
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
      // Convert array of items to temporary quantity map
      const quantities: { [itemId: string]: number } = {};
      selectedStation.items.forEach((item) => {
        quantities[item.itemId] = (quantities[item.itemId] || 0) + item.quantity;
      });
      setTempItems(quantities);
      setAddItemsOpen(true);
    }
  };

  const handleConfirmItems = () => {
    if (selectedStationId && menuItems) {
      const station = stations.find((s) => s.id === selectedStationId);
      if (!station) return;
      
      // Calculate existing quantities
      const existingQuantities: { [itemId: string]: number } = {};
      station.items.forEach((item) => {
        existingQuantities[item.itemId] = (existingQuantities[item.itemId] || 0) + item.quantity;
      });
      
      // Start with existing items
      const updatedItems: StoredSessionItem[] = [...station.items];
      
      // For each item in tempItems, compare with existing and add new entries if quantity increased
      Object.entries(tempItems).forEach(([itemId, newTotal]) => {
        const existingTotal = existingQuantities[itemId] || 0;
        const addedQuantity = newTotal - existingTotal;
        
        if (addedQuantity > 0) {
          // New items added - create new entry with current price
          const menuItem = menuItems.find((m) => m.id === itemId);
          if (menuItem) {
            const price = typeof menuItem.price === 'number' ? menuItem.price : parseFloat(menuItem.price);
            updatedItems.push({
              itemId,
              name: menuItem.name,
              quantity: addedQuantity,
              price,
            });
          }
        } else if (addedQuantity < 0) {
          // Items removed - remove from the end until we've removed enough
          let toRemove = Math.abs(addedQuantity);
          for (let i = updatedItems.length - 1; i >= 0 && toRemove > 0; i--) {
            if (updatedItems[i].itemId === itemId) {
              if (updatedItems[i].quantity <= toRemove) {
                toRemove -= updatedItems[i].quantity;
                updatedItems.splice(i, 1);
              } else {
                updatedItems[i].quantity -= toRemove;
                toRemove = 0;
              }
            }
          }
        }
      });
      
      setStations((prev) =>
        prev.map((s) =>
          s.id === selectedStationId ? { ...s, items: updatedItems } : s
        )
      );
      setAddItemsOpen(false);
      toast({
        title: "Items Added",
        description: "Items have been added to the tab",
      });
    }
  };

  const handleOpenCheckout = (stationId: string) => {
    const station = stations.find((s) => s.id === stationId);
    if (station?.isActive && !station.isPaused) {
      setStations((prev) =>
        prev.map((s) =>
          s.id === stationId
            ? { ...s, isPaused: true, pausedTime: Date.now() }
            : s
        )
      );
    }
    setSelectedStationId(stationId);
    setCheckoutOpen(true);
  };

  const handleConfirmCheckout = async (checkoutData: { 
    pricingTier: "group" | "solo"; 
    timeCharge: number; 
    grandTotal: number;
    deviceId?: string;
  }) => {
    if (!selectedStationId) return;

    const station = stations.find((s) => s.id === selectedStationId);
    if (!station) return;

    // Calculate total item count
    const itemCount = station.items.reduce((sum, item) => sum + item.quantity, 0);

    // Store payment data for overlay
    setPaymentData({
      totalAmount: checkoutData.grandTotal,
      itemCount: itemCount
    });

    // Close checkout dialog and show payment processing overlay
    setCheckoutOpen(false);
    setShowPaymentProcessing(true);

    // If Square is connected and deviceId is provided, send to terminal (fire and forget)
    if (squareStatus?.connected && checkoutData.deviceId) {
      const timeElapsed = getTimeElapsed(station);
      const hours = (timeElapsed / 3600).toFixed(2);
      const tierLabel = checkoutData.pricingTier === "solo" ? "Solo" : "Group";
      
      apiRequest("POST", "/api/square/terminals/checkouts", {
        deviceId: checkoutData.deviceId,
        amount: checkoutData.grandTotal,
        referenceId: `${station.name}-${Date.now()}`,
        note: `${station.name} - ${tierLabel} - ${hours}hrs`
      }).catch((error) => {
        console.error("[Terminal Checkout] Error:", error);
      });
    }
  };

  const handlePaymentComplete = () => {
    if (!selectedStationId) return;

    // End session after payment processing animation completes
    setStations((prev) =>
      prev.map((s) =>
        s.id === selectedStationId
          ? { ...s, isActive: false, isPaused: false, startTime: undefined, pausedTime: undefined, items: [] }
          : s
      )
    );
    setShowPaymentProcessing(false);
    setSelectedStationId(null);

    toast({
      title: "Payment Sent to Reader",
      description: "Session ended successfully",
    });
  };

  const handleTransferSession = (destinationStationId: string) => {
    if (!selectedStationId) return;
    
    const sourceStation = stations.find((s) => s.id === selectedStationId);
    const destinationStation = stations.find((s) => s.id === destinationStationId);
    
    if (!sourceStation || !destinationStation || !sourceStation.isActive) return;
    
    // Calculate elapsed time in seconds
    const elapsedSeconds = getTimeElapsed(sourceStation);
    
    // Calculate backdated start time for destination
    // If source was paused, use pausedTime, otherwise use current time
    const now = sourceStation.isPaused && sourceStation.pausedTime 
      ? sourceStation.pausedTime 
      : Date.now();
    const backdatedStartTime = now - (elapsedSeconds * 1000);
    
    // Transfer items (preserve price snapshots)
    const transferredItems = [...sourceStation.items];
    
    setStations((prev) =>
      prev.map((s) => {
        if (s.id === selectedStationId) {
          // End source station
          return { 
            ...s, 
            isActive: false, 
            isPaused: false,
            startTime: undefined, 
            pausedTime: undefined, 
            items: [] 
          };
        } else if (s.id === destinationStationId) {
          // Start destination station with backdated time and items
          return {
            ...s,
            isActive: true,
            isPaused: sourceStation.isPaused,
            startTime: backdatedStartTime,
            pausedTime: sourceStation.isPaused ? now : undefined,
            items: transferredItems,
          };
        }
        return s;
      })
    );
    
    setSelectedStationId(destinationStationId);
    toast({
      title: "Session Transferred",
      description: `Transferred from ${sourceStation.name} to ${destinationStation.name}`,
    });
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
    if (!menuItems) return [];
    
    return station.items.map((item) => ({
      id: item.itemId,
      name: item.name,
      price: item.price, // Use stored price snapshot
      quantity: item.quantity,
    }));
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

      {/* RIGHT SIDE CONTROLS */}
      <div className="flex items-center gap-4">

        {/* 🔥 LOGOUT BUTTON (NEW) */}
        <Button
          variant="outline"
          onClick={async () => {
          await logout();
          window.location.href = "/signin";
          }}
        >
        Logout
        </Button>


        {/* SQUARE LOGIC – unchanged */}
        {squareStatus?.connected ? (
          <Button
            variant="destructive"
            onClick={async () => {
              try {
                await apiRequest("DELETE", "/api/square/disconnect");
                queryClient.invalidateQueries({ queryKey: ["/api/square/status"] });
                toast({
                  title: "Disconnected",
                  description: "Square account has been disconnected",
                });
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to disconnect Square account",
                  variant: "destructive",
                });
              }
            }}
            data-testid="button-disconnect-square"
          >
            Disconnect Square
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const response = await fetch('/api/square/oauth/start');
                const data = await response.json();
                const scopes = 'MERCHANT_PROFILE_READ+PAYMENTS_WRITE+INVENTORY_READ+ITEMS_READ+DEVICE_CREDENTIAL_MANAGEMENT';
                const redirectUri = 'https://pool-cafe-manager-TalhaNadeem001.replit.app/api/square/oauth/callback';
                const authUrl = `${data.baseURL}oauth2/authorize?client_id=${data.appId}&session=false&scope=${scopes}&state=${data.state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
                window.location.href = authUrl;
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to start OAuth flow",
                  variant: "destructive",
                });
              }
            }}
            data-testid="button-connect-square"
          >
            Connect to Square
          </Button>
        )}

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
                    startTime={station.startTime}
                    onStart={() => handleOpenStartDialog(station.id)}
                    onStop={() => handleStopSession(station.id)}
                    onResume={() => handleResumeSession(station.id)}
                    onCompletePayment={() => handleOpenCheckout(station.id)}
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
                  startTime={selectedStation.startTime}
                  items={getSessionItems(selectedStation)}
                  onAddItems={handleAddItems}
                  onCheckout={() => handleOpenCheckout(selectedStation.id)}
                  onTransfer={() => setTransferOpen(true)}
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
            menuItems={menuItems || []}
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
            onConfirm={handleConfirmItems}
            squareConnected={!!squareStatus?.connected}
            onConnectSquare={async () => {
              try {
                const response = await fetch('/api/square/oauth/start');
                const data = await response.json();
                const scopes = 'MERCHANT_PROFILE_READ+PAYMENTS_WRITE+INVENTORY_READ+ITEMS_READ+DEVICE_CREDENTIAL_MANAGEMENT';
                const redirectUri = 'https://pool-cafe-manager-TalhaNadeem001.replit.app/api/square/oauth/callback';
                const authUrl = `${data.baseURL}oauth2/authorize?client_id=${data.appId}&session=false&scope=${scopes}&state=${data.state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
                window.location.href = authUrl;
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to start OAuth flow",
                  variant: "destructive",
                });
              }
            }}
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
            squareConnected={!!squareStatus?.connected}
            onConfirmCheckout={handleConfirmCheckout}
          />

          <TransferSessionDialog
            open={transferOpen}
            onOpenChange={setTransferOpen}
            currentStationName={selectedStation.name}
            availableStations={stations.filter((s) => !s.isActive)}
            onConfirmTransfer={handleTransferSession}
          />
        </>
      )}

      <PaymentProcessingOverlay
        show={showPaymentProcessing}
        onComplete={handlePaymentComplete}
        totalAmount={paymentData.totalAmount}
        itemCount={paymentData.itemCount}
      />
    </div>
  );
}
