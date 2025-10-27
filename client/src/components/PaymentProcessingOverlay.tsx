import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import terminalImage from "@assets/image_1761539237100.png";

interface PaymentProcessingOverlayProps {
  show: boolean;
  onComplete: () => void;
  totalAmount: number;
  itemCount: number;
}

export function PaymentProcessingOverlay({ 
  show, 
  onComplete, 
  totalAmount, 
  itemCount 
}: PaymentProcessingOverlayProps) {
  const [stage, setStage] = useState<"payment" | "confirmed">("payment");

  useEffect(() => {
    if (!show) return;
    
    setStage("payment");
    
    // Transition to confirmed after 3 seconds
    const confirmTimer = setTimeout(() => {
      setStage("confirmed");
    }, 3000);

    // Hide overlay and call onComplete after 4 seconds total (3s payment + 1s confirmed)
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
      <div className="bg-card border rounded-lg shadow-2xl max-w-3xl w-full mx-4 animate-in zoom-in-95 fade-in-0">
        {stage === "payment" ? (
          <div className="flex flex-col md:flex-row gap-8 p-8 animate-in fade-in-0">
            {/* Left side - Instructions and terminal image */}
            <div className="flex-1 flex flex-col gap-6">
              <div className="space-y-3">
                <h2 className="text-2xl font-bold">Pay with credit or debit card</h2>
                <p className="text-lg text-muted-foreground">
                  Follow instructions on PIN pad below
                </p>
              </div>
              
              <div className="relative rounded-lg overflow-hidden">
                <img 
                  src={terminalImage} 
                  alt="Card reader terminal" 
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>

            {/* Right side - Total and items */}
            <div className="md:w-64 flex flex-col gap-4 border-l pl-8">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Amount</p>
                  <p className="text-4xl font-bold font-mono">
                    ${totalAmount.toFixed(2)}
                  </p>
                </div>
                
                {itemCount > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Items</p>
                    <p className="text-2xl font-semibold">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 p-12 animate-in zoom-in-95 fade-in-0">
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
