import { useState } from "react";
import { Plus, Edit, Trash2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
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

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

const STORAGE_KEY = 'poolcafe_menu';

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

function loadMenuItems(): MenuItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading menu items:', error);
    return [];
  }
}

function saveMenuItems(items: MenuItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Error saving menu items:', error);
  }
}

export default function MenuManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [menuItems, setMenuItems] = useState<MenuItem[]>(() => loadMenuItems());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    category: "Custom",
  });

  const handleSaveItems = (items: MenuItem[]) => {
    setMenuItems(items);
    saveMenuItems(items);
  };

  const handleOpenAddDialog = () => {
    setEditingItem(null);
    setFormData({ name: "", price: "", category: "Custom" });
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      price: item.price.toString(),
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
      const updatedItems = menuItems.map((item) =>
        item.id === editingItem.id
          ? { ...item, name: formData.name.trim(), price, category: formData.category }
          : item
      );
      handleSaveItems(updatedItems);
      toast({
        title: "Item Updated",
        description: `${formData.name} has been updated`,
      });
    } else {
      const newItem: MenuItem = {
        id: `menu-${Date.now()}`,
        name: formData.name.trim(),
        price,
        category: formData.category,
      };
      handleSaveItems([...menuItems, newItem]);
      toast({
        title: "Item Added",
        description: `${formData.name} has been added to the menu`,
      });
    }

    setDialogOpen(false);
    setFormData({ name: "", price: "", category: "Custom" });
  };

  const handleDeleteItem = (item: MenuItem) => {
    const updatedItems = menuItems.filter((i) => i.id !== item.id);
    handleSaveItems(updatedItems);
    toast({
      title: "Item Deleted",
      description: `${item.name} has been removed from the menu`,
    });
  };

  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

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
                          ${item.price.toFixed(2)}
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
            <Button onClick={handleSaveMenuItem} data-testid="button-save">
              {editingItem ? "Update" : "Add"} Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
