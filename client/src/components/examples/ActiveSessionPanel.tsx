import { ActiveSessionPanel } from "../ActiveSessionPanel";

const sampleItems = [
  { id: "1", name: "Coffee", price: 3.0, quantity: 2 },
  { id: "2", name: "Candy Bar", price: 2.5, quantity: 1 },
  { id: "3", name: "Cake Slice", price: 4.5, quantity: 1 },
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
