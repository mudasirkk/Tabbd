import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

interface PaymentProcessingOverlayProps {
  show: boolean;
  onComplete: () => void;
}

export function PaymentProcessingOverlay({ show, onComplete }: PaymentProcessingOverlayProps) {
  const [stage, setStage] = useState<"processing" | "confirmed">("processing");

  useEffect(() => {
    if (!show) return;
    
    setStage("processing");
    
    // Transition to confirmed after 1 second
    const confirmTimer = setTimeout(() => {
      setStage("confirmed");
    }, 1000);

    // Hide overlay and call onComplete after 2 seconds total
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => {
      clearTimeout(confirmTimer);
      clearTimeout(completeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0">
      <div className="bg-card border rounded-lg shadow-2xl p-12 max-w-md w-full mx-4 animate-in zoom-in-95 fade-in-0">
        {stage === "processing" ? (
          <div className="flex flex-col items-center gap-6 animate-in fade-in-0">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Processing Payment</h2>
              <p className="text-muted-foreground">Please wait...</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 animate-in zoom-in-95 fade-in-0">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
              <CheckCircle2 className="w-16 h-16 text-green-500 relative animate-in zoom-in-50" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-green-500">Payment Confirmed!</h2>
              <p className="text-muted-foreground">Transaction successful</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
