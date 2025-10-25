import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, ArrowLeft, RefreshCw, Download } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { MenuItem } from "@shared/schema";

const CATEGORIES = [
  "Lattes",
  "Tea",
  "Refreshers",
  "Slushies",
  "Dessert",
  "Food",
  "Snacks",
  "Custom",
];

export default function MenuManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clearAllDialogOpen, setClearAllDialogOpen] = useState(false);
  const [squareItemsDialogOpen, setSquareItemsDialogOpen] = useState(false);
  const [selectedSquareItems, setSelectedSquareItems] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "Custom",
  });

  const { data: menuItems = [], isLoading, error } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
    retry: 3,
    retryDelay: 1000,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  const { data: squareStatus } = useQuery<{ connected: boolean; merchantId: string | null }>({
    queryKey: ["/api/square/status"],
  });

  const { data: squareCatalog, isLoading: squareCatalogLoading, refetch: refetchSquareCatalog } = useQuery<any>({
    queryKey: ["/api/square/catalog/items"],
    enabled: false,
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error Loading Menu",
        description: "Unable to load menu items. Please refresh the page.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; price: string; category: string }) => {
      return await apiRequest("POST", "/api/menu-items", {
        name: data.name,
        price: data.price,
        category: data.category,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      toast({
        title: "Item Added",
        description: `${formData.name} has been added to the menu`,
      });
      setDialogOpen(false);
      setFormData({ name: "", price: "", category: "Custom" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add menu item",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; price: string; category: string } }) => {
      return await apiRequest("PATCH", `/api/menu-items/${id}`, {
        name: data.name,
        price: data.price,
        category: data.category,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      toast({
        title: "Item Updated",
        description: `${formData.name} has been updated`,
      });
      setDialogOpen(false);
      setFormData({ name: "", price: "", category: "Custom" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update menu item",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/menu-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      toast({
        title: "Item Deleted",
        description: "Menu item has been successfully deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete menu item",
        variant: "destructive",
      });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/menu-items");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      toast({
        title: "All Items Cleared",
        description: "All menu items have been deleted",
      });
      setClearAllDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear menu items",
        variant: "destructive",
      });
    },
  });

  const importSquareItemsMutation = useMutation({
    mutationFn: async (items: { name: string; price: string; category: string }[]) => {
      const promises = items.map(item => apiRequest("POST", "/api/menu-items", item));
      return await Promise.all(promises);
    },
    onSuccess: (_, items) => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      toast({
        title: "Items Imported",
        description: `Successfully imported ${items.length} item${items.length > 1 ? 's' : ''} from Square`,
      });
      setSquareItemsDialogOpen(false);
      setSelectedSquareItems(new Set());
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to import items from Square",
        variant: "destructive",
      });
    },
  });

  const handleOpenAddDialog = () => {
    setEditingItem(null);
    setFormData({ name: "", price: "", category: "Custom" });
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (item: MenuItem) => {
    setEditingItem(item);
    const priceValue = typeof item.price === 'string' ? parseFloat(item.price) : item.price;
    setFormData({
      name: item.name,
      price: priceValue.toFixed(2),
      category: item.category,
    });
    setDialogOpen(true);
  };

  const handleSaveMenuItem = () => {
    const price = parseFloat(formData.price);
    if (!formData.name.trim() || isNaN(price) || price <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please enter a valid name and price",
        variant: "destructive",
      });
      return;
    }

    if (editingItem) {
      updateMutation.mutate({
        id: editingItem.id,
        data: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteItem = (item: MenuItem) => {
    deleteMutation.mutate(item.id);
  };

  const handleImportSelectedItems = () => {
    if (!squareCatalog?.objects || selectedSquareItems.size === 0) {
      toast({
        title: "No Items Selected",
        description: "Please select at least one item to import",
        variant: "destructive",
      });
      return;
    }

    const itemsToImport: { name: string; price: string; category: string }[] = [];
    
    // Build category lookup map
    const categories = squareCatalog.objects.filter((obj: any) => obj.type === "CATEGORY");
    const categoryMap = new Map();
    categories.forEach((cat: any) => {
      categoryMap.set(cat.id, cat.category_data?.name || "Custom");
    });

    squareCatalog.objects.forEach((item: any) => {
      if (item.type === "ITEM" && item.item_data.variations) {
        item.item_data.variations.forEach((variation: any) => {
          const variationKey = `${item.id}-${variation.id}`;
          if (selectedSquareItems.has(variationKey)) {
            const price = variation.item_variation_data.price_money?.amount || 0;
            const variationName = variation.item_variation_data.name;
            const itemName = variationName === "Regular" 
              ? item.item_data.name 
              : `${item.item_data.name} - ${variationName}`;
            
            // Get category name from reporting_category (primary category)
            const categoryId = item.item_data.reporting_category?.id;
            const categoryName = categoryId 
              ? categoryMap.get(categoryId) || "Custom"
              : "Custom";
            
            itemsToImport.push({
              name: itemName,
              price: (price / 100).toFixed(2),
              category: categoryName,
            });
          }
        });
      }
    });

    importSquareItemsMutation.mutate(itemsToImport);
  };

  const toggleSquareItem = (itemId: string, variationId: string) => {
    const key = `${itemId}-${variationId}`;
    setSelectedSquareItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const selectAllSquareItems = () => {
    if (!squareCatalog?.objects) return;
    
    const allKeys = new Set<string>();
    squareCatalog.objects.forEach((item: any) => {
      if (item.type === "ITEM" && item.item_data?.variations) {
        item.item_data.variations.forEach((variation: any) => {
          allKeys.add(`${item.id}-${variation.id}`);
        });
      }
    });
    setSelectedSquareItems(allKeys);
  };

  const deselectAllSquareItems = () => {
    setSelectedSquareItems(new Set());
  };

  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading menu items...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation("/")}
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold" data-testid="text-page-title">
                  Menu Management
                </h1>
                <p className="text-sm text-muted-foreground">
                  Add, edit, and organize menu items
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {squareStatus?.connected && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSquareItemsDialogOpen(true);
                    refetchSquareCatalog();
                  }}
                  data-testid="button-sync-square"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Import from Square
                </Button>
              )}
              {menuItems.length > 0 && (
                <Button
                  variant="destructive"
                  onClick={() => setClearAllDialogOpen(true)}
                  data-testid="button-clear-all"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Items
                </Button>
              )}
              <Button onClick={handleOpenAddDialog} data-testid="button-add-menu-item">
                <Plus className="w-4 h-4 mr-2" />
                Add Menu Item
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {Object.keys(groupedItems).length === 0 ? (
            <Card className="p-12 text-center">
              <div className="space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                  <Plus className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">No Menu Items</h3>
                  <p className="text-muted-foreground mb-4">
                    Get started by adding your first menu item
                  </p>
                  <Button onClick={handleOpenAddDialog} data-testid="button-add-first-item">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Menu Item
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            Object.entries(groupedItems).map(([category, items]) => (
              <Card key={category} className="p-6" data-testid={`category-${category.toLowerCase()}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-primary">
                    {category}
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                      data-testid={`menu-item-${item.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-semibold" data-testid={`text-item-name-${item.id}`}>
                          {item.name}
                        </p>
                        <p className="text-lg font-mono text-green-600 dark:text-green-400" data-testid={`text-item-price-${item.id}`}>
                          ${parseFloat(item.price).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditDialog(item)}
                          data-testid={`button-edit-${item.id}`}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteItem(item)}
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="dialog-menu-item">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingItem ? "Edit Menu Item" : "Add Menu Item"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the details of this menu item"
                : "Add a new item to your menu"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-name">Item Name</Label>
              <Input
                id="item-name"
                placeholder="e.g., Burger, Fries, Latte"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-item-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-price">Price</Label>
              <Input
                id="item-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                data-testid="input-item-price"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMenuItem}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {editingItem ? "Update" : "Add"} Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={clearAllDialogOpen} onOpenChange={setClearAllDialogOpen}>
        <AlertDialogContent data-testid="dialog-clear-all-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Menu Items?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all {menuItems.length} menu items from your database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearAllMutation.mutate()}
              disabled={clearAllMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-clear"
            >
              {clearAllMutation.isPending ? "Clearing..." : "Clear All Items"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={squareItemsDialogOpen} onOpenChange={setSquareItemsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]" data-testid="dialog-square-items">
          <DialogHeader>
            <DialogTitle>Import from Square</DialogTitle>
            <DialogDescription>
              Select items to import into your menu
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {squareCatalogLoading ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading Square menu items...</p>
              </div>
            ) : squareCatalog?.objects && squareCatalog.objects.length > 0 ? (
              <>
                <div className="flex items-center justify-between border-b pb-3">
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={selectAllSquareItems}
                      data-testid="button-select-all-square"
                    >
                      Select All
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={deselectAllSquareItems}
                      data-testid="button-deselect-all-square"
                    >
                      Deselect All
                    </Button>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {selectedSquareItems.size} selected
                  </span>
                </div>
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                  {(() => {
                    // Build category lookup map
                    const categories = squareCatalog.objects.filter((obj: any) => obj.type === "CATEGORY");
                    const categoryMap = new Map();
                    categories.forEach((cat: any) => {
                      categoryMap.set(cat.id, cat.category_data?.name || "Uncategorized");
                    });

                    // Filter only ITEM type objects
                    const items = squareCatalog.objects.filter((obj: any) => obj.type === "ITEM");

                    // Group items by their reporting category
                    const groupedItems = new Map<string, any[]>();
                    items.forEach((item: any) => {
                      const categoryId = item.item_data.reporting_category?.id || "uncategorized";
                      if (!groupedItems.has(categoryId)) {
                        groupedItems.set(categoryId, []);
                      }
                      groupedItems.get(categoryId)!.push(item);
                    });

                    // Render items grouped by category
                    return Array.from(groupedItems.entries()).map(([categoryId, categoryItems]) => {
                      const categoryName = categoryMap.get(categoryId) || "Uncategorized";
                      
                      return (
                        <div key={categoryId} className="space-y-3">
                          <div className="sticky top-0 bg-background z-10 pb-2 border-b">
                            <h3 className="font-bold text-lg">{categoryName}</h3>
                            <p className="text-xs text-muted-foreground">
                              {categoryItems.length} item{categoryItems.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          
                          <div className="space-y-2 pl-2">
                            {categoryItems.map((item: any) => (
                              <Card key={item.id} className="p-3">
                                <div className="space-y-2">
                                  <h4 className="font-semibold text-sm">{item.item_data.name}</h4>
                                  {item.item_data.variations && item.item_data.variations.length > 0 && (
                                    <div className="space-y-1.5">
                                      {item.item_data.variations.map((variation: any) => {
                                        const variationKey = `${item.id}-${variation.id}`;
                                        const isSelected = selectedSquareItems.has(variationKey);
                                        const price = variation.item_variation_data.price_money?.amount || 0;
                                        const variationName = variation.item_variation_data.name;
                                        
                                        return (
                                          <div
                                            key={variation.id}
                                            className="flex items-center justify-between p-2.5 rounded-md border hover-elevate cursor-pointer"
                                            onClick={() => toggleSquareItem(item.id, variation.id)}
                                            data-testid={`square-item-${variationKey}`}
                                          >
                                            <div className="flex items-center gap-3 flex-1">
                                              <Checkbox
                                                checked={isSelected}
                                                onCheckedChange={() => toggleSquareItem(item.id, variation.id)}
                                                data-testid={`checkbox-${variationKey}`}
                                              />
                                              <div className="flex-1">
                                                <p className="font-medium text-sm">{variationName}</p>
                                              </div>
                                            </div>
                                            <span className="font-mono font-bold text-primary">
                                              ${(price / 100).toFixed(2)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No items found in your Square catalog</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSquareItemsDialogOpen(false)}
              data-testid="button-close-square-dialog"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportSelectedItems}
              disabled={importSquareItemsMutation.isPending || selectedSquareItems.size === 0}
              data-testid="button-import-selected"
            >
              <Download className="w-4 h-4 mr-2" />
              {importSquareItemsMutation.isPending 
                ? "Importing..." 
                : `Import ${selectedSquareItems.size > 0 ? `(${selectedSquareItems.size})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
