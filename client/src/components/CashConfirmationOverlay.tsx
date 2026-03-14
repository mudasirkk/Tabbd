import { useEffect, useState } from "react";
import { Banknote, CheckCircle2 } from "lucide-react";

interface CashConfirmationOverlayProps {
  show: boolean;
  onComplete: () => void;
  totalAmount: number;
  itemCount: number;
}

export function CashConfirmationOverlay({
  show,
  onComplete,
  totalAmount,
  itemCount,
}: CashConfirmationOverlayProps) {
  const [stage, setStage] = useState<"summary" | "confirmed">("summary");

  useEffect(() => {
    if (!show) return;

    setStage("summary");

    const confirmTimer = setTimeout(() => {
      setStage("confirmed");
    }, 3000);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => {
      clearTimeout(confirmTimer);
      clearTimeout(completeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0">
      <div className="bg-card border rounded-lg shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95 fade-in-0">
        {stage === "summary" ? (
          <div className="flex flex-col items-center gap-6 p-10 animate-in fade-in-0">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Banknote className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Collect Payment</h2>
              <p className="text-muted-foreground">Cash or manual payment</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-4xl font-bold font-mono text-primary">
                ${totalAmount.toFixed(2)}
              </p>
              {itemCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 p-12 animate-in zoom-in-95 fade-in-0">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
              <CheckCircle2 className="w-16 h-16 text-green-500 relative animate-in zoom-in-50" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-green-500">Session Closed!</h2>
              <p className="text-muted-foreground">Transaction complete</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
