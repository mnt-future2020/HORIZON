import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="font-display text-[8rem] font-black leading-none tracking-tighter text-primary/20">404</h1>
        <h2 className="font-display text-2xl font-black tracking-athletic mt-2">Page Not Found</h2>
        <p className="text-muted-foreground font-semibold mt-3 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button onClick={() => navigate("/")}
          className="bg-gradient-athletic text-white font-bold rounded-full h-11 px-8 shadow-md shadow-brand-600/20">
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Home
        </Button>
      </div>
    </div>
  );
}
