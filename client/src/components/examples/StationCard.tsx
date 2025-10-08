import { StationCard } from "../StationCard";

export default function StationCardExample() {
  return (
    <div className="p-8 space-y-4 max-w-sm">
      <StationCard
        id="pool-1"
        name="Pool Table 1"
        type="pool"
        isActive={false}
        onStart={() => console.log("Start session")}
        onStop={() => console.log("Stop session")}
      />
      <StationCard
        id="pool-2"
        name="Pool Table 2"
        type="pool"
        isActive={true}
        timeElapsed={3725}
        currentCharge={16.56}
        onStart={() => console.log("Start session")}
        onStop={() => console.log("Stop session")}
      />
      <StationCard
        id="gaming-1"
        name="Gaming Station 1"
        type="gaming"
        isActive={true}
        timeElapsed={1805}
        currentCharge={8.02}
        onStart={() => console.log("Start session")}
        onStop={() => console.log("Stop session")}
      />
    </div>
  );
}
