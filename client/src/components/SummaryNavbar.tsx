import {
  LogOut,
  Moon,
  Pause,
  Sun,
  Search,
  Settings as SettingsIcon,
  History as HistoryIcon,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SummaryNavbarProps {
  storeName: string;
  logoUrl: string | null;
  activeCount: number;
  openCount: number;
  pausedCount: number;
  onLookup: () => void;
  onMenu: () => void;
  onHistory: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  theme: "light" | "dark";
}

export function SummaryNavbar({
  storeName,
  logoUrl,
  activeCount,
  openCount,
  pausedCount,
  onLookup,
  onMenu,
  onHistory,
  onSettings,
  onLogout,
  onToggleTheme,
  theme,
}: SummaryNavbarProps) {
  return (
    <header className="border-b border-border/50 sticky top-0 bg-background/90 backdrop-blur-sm z-10">
      <div className="container mx-auto max-w-screen-xl px-4 py-3 flex justify-between items-center gap-4">
        {/* Left: Logo + Store Name */}
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Store logo"
              className="h-10 w-10 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted/50 border border-border/60 flex items-center justify-center flex-shrink-0">
              <span className="text-muted-foreground text-lg font-bold font-display">
                {storeName.charAt(0).toUpperCase() || "T"}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold font-display leading-tight truncate">
              {storeName}
            </h1>
            <p className="text-[10px] text-muted-foreground leading-tight tracking-wide uppercase hidden sm:block">
              Station & Tab Dashboard
            </p>
          </div>
        </div>

        {/* Center: Stats Pill */}
        <div className="hidden lg:flex items-center gap-3 rounded-full bg-card/60 border border-border/50 px-5 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            <span className="text-xs font-medium font-mono">{openCount}</span>
            <span className="text-xs text-muted-foreground">Available</span>
          </div>
          <div className="w-px h-4 bg-border/60" />
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium font-mono">{activeCount}</span>
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <div className="w-px h-4 bg-border/60" />
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-xs font-medium font-mono">{pausedCount}</span>
            <span className="text-xs text-muted-foreground">Paused</span>
          </div>
        </div>

        {/* Right: Nav Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button variant="outline" size="sm" onClick={onLookup}>
            <Search className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Lookup</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onMenu}>
            <UtensilsCrossed className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Menu</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onHistory}>
            <HistoryIcon className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">History</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onSettings}>
            <SettingsIcon className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="destructive" size="sm" onClick={onLogout}>
            <LogOut className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
