import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { splitAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Users, Calendar, Clock, MapPin, IndianRupee, Check, CreditCard } from "lucide-react";

export default function SplitPaymentPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payerName, setPayerName] = useState("");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    splitAPI.getInfo(token)
      .then(res => setData(res.data))
      .catch(() => toast.error("Invalid or expired split link"))
      .finally(() => setLoading(false));
  }, [token]);

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (document.getElementById("razorpay-script")) { resolve(true); return; }
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePay = async () => {
    if (!payerName.trim()) { toast.error("Enter your name"); return; }
    setPaying(true);
    try {
      const res = await splitAPI.pay(token, { payer_name: payerName });
      const result = res.data;

      if (result.payment_gateway === "razorpay" && result.razorpay_order_id) {
        const loaded = await loadRazorpayScript();
        if (!loaded) { toast.error("Payment gateway failed to load"); setPaying(false); return; }
        const options = {
          key: result.razorpay_key_id,
          amount: result.amount * 100,
          currency: "INR",
          order_id: result.razorpay_order_id,
          name: "Horizon Sports",
          description: `Split Payment - ${payerName}`,
          handler: async (response) => {
            try {
              await splitAPI.verifyPayment(token, {
                payer_name: payerName,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success("Payment successful!");
              setPaid(true);
              const r = await splitAPI.getInfo(token);
              setData(r.data);
            } catch { toast.error("Payment verification failed"); }
            setPaying(false);
          },
          modal: { ondismiss: () => { toast.info("Payment cancelled"); setPaying(false); } },
          theme: { color: "#10B981" }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
        return;
      }

      // Mock payment
      toast.success("Payment successful!");
      setPaid(true);
      const infoRes = await splitAPI.getInfo(token);
      setData(infoRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Invalid Link</h1>
        <p className="text-sm text-muted-foreground">This split payment link is invalid or has expired.</p>
      </div>
    </div>
  );

  const booking = data.booking;
  const sc = booking?.split_config || {};
  const progressPct = sc.total_shares ? (sc.shares_paid / sc.total_shares) * 100 : 0;
  const allPaid = sc.shares_paid >= sc.total_shares;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="font-display font-black text-xl tracking-tighter uppercase text-primary">Horizon</span>
          <h1 className="font-display text-2xl font-bold text-foreground mt-4">Split Payment</h1>
          <p className="text-sm text-muted-foreground mt-1">You've been invited to share the cost</p>
        </div>

        <div className="glass-card rounded-lg p-6 space-y-5">
          {/* Booking Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> Venue</span>
              <span className="text-sm font-bold text-foreground">{booking.venue_name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> Date</span>
              <span className="text-sm font-bold text-foreground">{booking.date}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Time</span>
              <span className="text-sm font-bold text-foreground">{booking.start_time} - {booking.end_time}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-3.5 w-3.5" /> Host</span>
              <span className="text-sm font-bold text-foreground">{booking.host_name}</span>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{sc.shares_paid}/{sc.total_shares} paid</span>
              <span className="font-bold text-primary">{"\u20B9"}{booking.total_amount} total</span>
            </div>
            <Progress value={progressPct} className="h-2" data-testid="split-progress" />
          </div>

          {/* Payments List */}
          {data.payments?.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Payments</span>
              {data.payments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm text-foreground">{p.payer_name}</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{"\u20B9"}{p.amount}</span>
                </div>
              ))}
            </div>
          )}

          {/* Pay Section */}
          {allPaid ? (
            <div className="text-center py-4">
              <Badge className="bg-primary/20 text-primary border-primary/20 text-sm px-4 py-1">Fully Paid</Badge>
              <p className="text-xs text-muted-foreground mt-2">All shares have been collected. Booking confirmed!</p>
            </div>
          ) : paid ? (
            <div className="text-center py-4">
              <Check className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">Your payment is recorded!</p>
              <p className="text-xs text-muted-foreground mt-1">Waiting for {data.remaining} more payment(s).</p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="text-center">
                <div className="text-3xl font-display font-black text-primary">{"\u20B9"}{sc.per_share}</div>
                <div className="text-xs text-muted-foreground mt-1">Your share</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Your Name</Label>
                <Input value={payerName} onChange={e => setPayerName(e.target.value)}
                  placeholder="Enter your name" className="mt-1 bg-background border-border h-11"
                  data-testid="split-payer-name-input" />
              </div>
              <Button className="w-full bg-primary text-primary-foreground font-bold uppercase tracking-wide h-11"
                onClick={handlePay} disabled={paying} data-testid="split-pay-btn">
                <CreditCard className="h-4 w-4 mr-2" />
                {paying ? "Processing..." : `Pay ${"\u20B9"}${sc.per_share} (MOCKED)`}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">Payment is mocked for demo purposes</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
