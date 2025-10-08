import { useState } from "react";
import { AddItemsDialog } from "../AddItemsDialog";
import { Button } from "@/components/ui/button";

const sampleMenuItems = [
  { id: "1", name: "Candy Bar", price: 2.5 },
  { id: "2", name: "Coffee", price: 3.0 },
  { id: "3", name: "Cake Slice", price: 4.5 },
  { id: "4", name: "Soda", price: 2.0 },
  { id: "5", name: "Energy Drink", price: 3.5 },
  { id: "6", name: "Chips", price: 2.25 },
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
