import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
            <Button onClick={handleOpenAddDialog} data-testid="button-add-menu-item">
              <Plus className="w-4 h-4 mr-2" />
              Add Menu Item
            </Button>
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
    </div>
  );
}
