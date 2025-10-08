import { ActiveSessionPanel } from "../ActiveSessionPanel";

const sampleItems = [
  { id: "1", name: "Vanilla Latte", price: 4.99, quantity: 2 },
  { id: "2", name: "Cookies", price: 1.99, quantity: 1 },
  { id: "3", name: "Milk Cake", price: 5.99, quantity: 1 },
];

export default function ActiveSessionPanelExample() {
  return (
    <div className="p-8 max-w-md">
      <ActiveSessionPanel
        stationName="Pool Table 1"
        timeElapsed={3725}
        timeCharge={16.56}
        items={sampleItems}
        onAddItems={() => console.log("Add items clicked")}
        onCheckout={() => console.log("Checkout clicked")}
      />
    </div>
  );
}
