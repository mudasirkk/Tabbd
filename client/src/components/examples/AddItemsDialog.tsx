import { useState } from "react";
import { AddItemsDialog } from "../AddItemsDialog";
import { Button } from "@/components/ui/button";

const sampleMenuItems = [
  { id: "1", name: "Vanilla Latte", price: 4.99, category: "Lattes" },
  { id: "2", name: "Caramel Latte", price: 4.99, category: "Lattes" },
  { id: "3", name: "Adeni Tea", price: 4.49, category: "Tea" },
  { id: "4", name: "Berry Hibiscus Refresher", price: 4.49, category: "Refreshers" },
  { id: "5", name: "Slushie", price: 2.99, category: "Slushies" },
  { id: "6", name: "Cookies", price: 1.99, category: "Dessert" },
  { id: "7", name: "Milk Cake", price: 5.99, category: "Dessert" },
];

export default function AddItemsDialogExample() {
  const [open, setOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});

  const handleAddItem = (itemId: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1,
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const newCount = (prev[itemId] || 0) - 1;
      if (newCount <= 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: newCount };
    });
  };

  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)}>Open Add Items Dialog</Button>
      <AddItemsDialog
        open={open}
        onOpenChange={setOpen}
        stationName="Pool Table 1"
        menuItems={sampleMenuItems}
        selectedItems={selectedItems}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onConfirm={() => {
          console.log("Items confirmed:", selectedItems);
          setOpen(false);
        }}
      />
    </div>
  );
}
