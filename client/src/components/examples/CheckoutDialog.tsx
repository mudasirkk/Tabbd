import { useState } from "react";
import { CheckoutDialog } from "../CheckoutDialog";
import { Button } from "@/components/ui/button";

const sampleItems = [
  { id: "1", name: "Vanilla Latte", price: 4.99, quantity: 2 },
  { id: "2", name: "Cookies", price: 1.99, quantity: 1 },
  { id: "3", name: "Milk Cake", price: 5.99, quantity: 1 },
];

export default function CheckoutDialogExample() {
  const [open, setOpen] = useState(false);

  return (
    <div className="p-8">
      <Button onClick={() => setOpen(true)}>Open Checkout Dialog</Button>
      <CheckoutDialog
        open={open}
        onOpenChange={setOpen}
        stationName="Pool Table 1"
        timeElapsed={3725}
        timeCharge={16.56}
        items={sampleItems}
        onConfirmCheckout={() => {
          console.log("Payment confirmed");
          setOpen(false);
        }}
      />
    </div>
  );
}
