import { useState, useEffect } from "react";
import { Clock, Menu, UtensilsCrossed } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { StationCard, StationType } from "@/components/StationCard";
import { ActiveSessionPanel, SessionItem } from "@/components/ActiveSessionPanel";
import { AddItemsDialog, MenuItem } from "@/components/AddItemsDialog";
import { CheckoutDialog } from "@/components/CheckoutDialog";
import { StartSessionDialog } from "@/components/StartSessionDialog";
import { TransferSessionDialog } from "@/components/TransferSessionDialog";
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

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  const { data: menuItems, isLoading: menuLoading, error: menuError, refetch } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
    retry: 3,
    retryDelay: 1000,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always', // Always refetch when component mounts
  });
  
  const addCustomItemMutation = useMutation({
    mutationFn: async (data: { name: string; price: string; category: string }) => {
      return await apiRequest("POST", "/api/menu-items", data);
    },
    onSuccess: (newItem) => {
      // Optimistically update the cache with the new item
      queryClient.setQueryData<MenuItem[]>(["/api/menu-items"], (old = []) => [...old, newItem]);
    },
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

  const handleAddCustomItem = async (name: string, price: number) => {
    try {
      const result = await addCustomItemMutation.mutateAsync({
        name,
        price: price.toFixed(2),
        category: "Custom",
      });
      
      setTempItems((prev) => ({ ...prev, [result.id]: 1 }));
      toast({
        title: "Custom Item Added",
        description: `${name} ($${price.toFixed(2)}) added to cart`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add custom item",
        variant: "destructive",
      });
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

  const handleConfirmCheckout = () => {
    if (selectedStationId) {
      setStations((prev) =>
        prev.map((s) =>
          s.id === selectedStationId
            ? { ...s, isActive: false, isPaused: false, startTime: undefined, pausedTime: undefined, items: [] }
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
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    // Fetch auth values from backend
                    const response = await fetch('/api/square/auth-values');
                    const {
                      squareCodeChallenge,
                      squareCodeVerifier,
                      squareState,
                      baseURL,
                      appId
                    } = await response.json();

                    // Store code verifier and state in cookies
                    document.cookie = `square-code-verifier=${squareCodeVerifier}; path=/; max-age=600`;
                    document.cookie = `square-state=${squareState}; path=/; max-age=600`;

                    // Scopes needed for the application
                    const scopes = [
                      'MERCHANT_PROFILE_READ',
                      'ORDERS_WRITE',
                      'INVENTORY_READ',
                      'ITEMS_READ',
                      'PAYMENTS_READ'
                    ];

                    // Redirect to Square OAuth page
                    const authUrl = `${baseURL}oauth2/authorize?client_id=${appId}&session=false&scope=${scopes.join('+')}&state=${squareState}&code_challenge=${squareCodeChallenge}`;
                    window.location.href = authUrl;
                  } catch (error) {
                    console.error('Error initiating OAuth:', error);
                    toast({
                      title: "Connection Failed",
                      description: "Failed to connect to Square. Please try again.",
                      variant: "destructive",
                    });
                  }
                }}
                data-testid="button-connect-square"
              >
                Connect to Square
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/menu")}
                data-testid="button-menu-management"
              >
                <UtensilsCrossed className="w-4 h-4 mr-2" />
                Menu
              </Button>
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
        {menuLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-muted-foreground">Loading menu items...</p>
            </div>
          </div>
        ) : menuError ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4 max-w-md">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <UtensilsCrossed className="w-8 h-8 text-destructive" />
              </div>
              <h3 className="text-xl font-semibold">Failed to Load Menu</h3>
              <p className="text-muted-foreground">
                Unable to load menu items from the database. Please check your connection and try again.
              </p>
              <Button onClick={() => refetch()} data-testid="button-retry-menu">
                Retry
              </Button>
            </div>
          </div>
        ) : (
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
        )}
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

      {selectedStation && menuItems && (
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
            stationType={selectedStation.type}
            timeElapsed={getTimeElapsed(selectedStation)}
            timeCharge={getTimeCharge(selectedStation)}
            items={getSessionItems(selectedStation)}
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
    </div>
  );
}
