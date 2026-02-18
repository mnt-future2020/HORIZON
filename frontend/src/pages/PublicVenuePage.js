import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { venueAPI } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  MapPin, Star, Clock, Users, Zap, Share2, QrCode,
  ChevronLeft, ExternalLink, Phone, CheckCircle2,
  Calendar, Tag, ShieldCheck, Trophy, Wifi, Coffee,
  Car, Droplets, Wind, Video, ShoppingBag, AlertCircle,
  Copy, Check, Radio
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const SPORT_LABELS = {
  football: "Football", cricket: "Cricket", badminton: "Badminton",
  basketball: "Basketball", tennis: "Tennis", table_tennis: "Table Tennis",
  volleyball: "Volleyball", hockey: "Hockey", kabaddi: "Kabaddi", swimming: "Swimming",
};

const SPORT_COLORS = {
  football: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cricket: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  badminton: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  basketball: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  tennis: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  table_tennis: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
};

const AMENITY_ICONS = {
  "Parking": <Car className="w-4 h-4" />,
  "Floodlights": <Zap className="w-4 h-4" />,
  "Changing Rooms": <ShieldCheck className="w-4 h-4" />,
  "AC": <Wind className="w-4 h-4" />,
  "Shower": <Droplets className="w-4 h-4" />,
  "Cafe": <Coffee className="w-4 h-4" />,
  "Pro Shop": <ShoppingBag className="w-4 h-4" />,
  "Coaching": <Trophy className="w-4 h-4" />,
  "WiFi": <Wifi className="w-4 h-4" />,
  "Video Analysis": <Video className="w-4 h-4" />,
  "Water Cooler": <Droplets className="w-4 h-4" />,
  "First Aid": <AlertCircle className="w-4 h-4" />,
  "Nets": <CheckCircle2 className="w-4 h-4" />,
  "Bowling Machine": <CheckCircle2 className="w-4 h-4" />,
};

export default function PublicVenuePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [venue, setVenue] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [wsStatus, setWsStatus] = useState("connecting"); // connecting | live | reconnecting | offline
  const [justUpdated, setJustUpdated] = useState(false);

  const wsRef = useRef(null);
  const venueIdRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);

  const pageUrl = window.location.href;

  const fetchVenueData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const res = await venueAPI.getBySlug(slug);
      setVenue(res.data);
      venueIdRef.current = res.data.id;
      try {
        const [reviewsRes, summaryRes] = await Promise.all([
          venueAPI.getReviews(res.data.id),
          venueAPI.getReviewSummary(res.data.id),
        ]);
        setReviews(reviewsRes.data || []);
        setReviewSummary(summaryRes.data || null);
      } catch {
        // Reviews optional
      }
    } catch {
      setError("Venue not found");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  // WebSocket connection with reconnect
  const connectWs = useCallback((venueId) => {
    if (!venueId) return;
    const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
    const wsUrl = backendUrl.replace(/^https/, "wss").replace(/^http/, "ws") + `/api/venues/ws/${venueId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("live");
      reconnectAttempts.current = 0;
      logger.info?.(`WS connected: ${wsUrl}`);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "venue_update" && msg.venue) {
          setVenue(msg.venue);
          setJustUpdated(true);
          toast.info("Venue details just updated by the owner!", {
            icon: "✨",
            duration: 3000,
          });
          setTimeout(() => setJustUpdated(false), 3000);
        }
      } catch { /* ignore bad messages */ }
    };

    ws.onerror = () => setWsStatus("reconnecting");

    ws.onclose = () => {
      setWsStatus("reconnecting");
      // Exponential backoff: 2s, 4s, 8s, max 30s
      const delay = Math.min(2000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current += 1;
      reconnectTimer.current = setTimeout(() => {
        if (venueIdRef.current) connectWs(venueIdRef.current);
      }, delay);
    };
  }, []);

  // Initial fetch + start WebSocket
  useEffect(() => {
    fetchVenueData(true);
  }, [fetchVenueData]);

  // Start WS once venueId is known
  useEffect(() => {
    if (!venue?.id) return;
    connectWs(venue.id);
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [venue?.id, connectWs]);

  // SEO title
  useEffect(() => {
    if (venue) document.title = `${venue.name} - ${venue.city} | Horizon Sports`;
    return () => { document.title = "Horizon Sports"; };
  }, [venue]);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleBookNow = () => {
    if (user) {
      navigate(`/venues/${venue.id}`);
    } else {
      navigate("/auth", { state: { redirect: `/venue/${slug}` } });
    }
  };

  const formatTime = (h) => {
    if (h === 0) return "12:00 AM";
    if (h < 12) return `${h}:00 AM`;
    if (h === 12) return "12:00 PM";
    return `${h - 12}:00 PM`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading venue details...</p>
        </div>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Venue Not Found</h1>
          <p className="text-muted-foreground">This venue page doesn't exist or has been removed.</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const images = venue.images?.length > 0 ? venue.images : [
    "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1200&q=80"
  ];

  const avgRating = reviewSummary?.average_rating || venue.rating || 0;
  const totalReviews = reviewSummary?.total_reviews || venue.total_reviews || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">H</span>
              </div>
              <span className="font-semibold text-sm hidden sm:inline">Horizon Sports</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowQR(true)} className="gap-2">
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">QR Code</span>
            </Button>
            <Button size="sm" onClick={handleBookNow} className="gap-2">
              <Calendar className="w-4 h-4" />
              Book Now
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative h-64 sm:h-80 md:h-96 overflow-hidden bg-muted">
        <img
          src={images[currentImageIndex]}
          alt={venue.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1200&q=80";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Image thumbnails */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentImageIndex(i)}
                className={`w-2 h-2 rounded-full transition-all ${i === currentImageIndex ? "bg-white w-6" : "bg-white/50"}`}
              />
            ))}
          </div>
        )}

        {/* Venue Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap gap-2 mb-2">
              {venue.sports?.map((s) => (
                <Badge key={s} className={`text-xs ${SPORT_COLORS[s] || "bg-gray-100 text-gray-700"}`}>
                  {SPORT_LABELS[s] || s}
                </Badge>
              ))}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">{venue.name}</h1>
            <div className="flex items-center gap-4 mt-2 text-white/90">
              <span className="flex items-center gap-1 text-sm">
                <MapPin className="w-4 h-4" />
                {venue.area ? `${venue.area}, ` : ""}{venue.city}
              </span>
              <span className="flex items-center gap-1 text-sm">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                {avgRating.toFixed(1)} ({totalReviews} reviews)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-3">About This Venue</h2>
                  <p className="text-muted-foreground leading-relaxed">{venue.description}</p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Amenities */}
            {venue.amenities?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
                <Card>
                  <CardContent className="p-6">
                    <h2 className="text-xl font-semibold mb-4">Amenities</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {venue.amenities.map((amenity) => (
                        <div key={amenity} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                          <span className="text-primary">
                            {AMENITY_ICONS[amenity] || <CheckCircle2 className="w-4 h-4" />}
                          </span>
                          <span className="text-sm font-medium">{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Location */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Location</h2>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{venue.address}</p>
                      {venue.area && <p className="text-muted-foreground text-sm">{venue.area}</p>}
                      <p className="text-muted-foreground text-sm">{venue.city}</p>
                      {venue.lat && venue.lng && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary text-sm mt-2 hover:underline"
                        >
                          View on Google Maps <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Reviews */}
            {reviews.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">Reviews</h2>
                      <div className="flex items-center gap-1">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold">{avgRating.toFixed(1)}</span>
                        <span className="text-muted-foreground text-sm">({totalReviews})</span>
                      </div>
                    </div>
                    {reviewSummary?.distribution && (
                      <div className="space-y-1 mb-6">
                        {[5, 4, 3, 2, 1].map((r) => {
                          const count = reviewSummary.distribution[r] || 0;
                          const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                          return (
                            <div key={r} className="flex items-center gap-2 text-sm">
                              <span className="w-4 text-right text-muted-foreground">{r}</span>
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="w-6 text-muted-foreground">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="space-y-4">
                      {reviews.slice(0, 5).map((review, i) => (
                        <div key={i} className="pb-4 border-b last:border-0">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="text-xs font-bold text-primary">
                                  {review.user_details?.name?.[0] || "U"}
                                </span>
                              </div>
                              <span className="font-medium text-sm">{review.user_details?.name || "User"}</span>
                            </div>
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`w-3.5 h-3.5 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                                />
                              ))}
                            </div>
                          </div>
                          {review.comment && (
                            <p className="text-sm text-muted-foreground ml-10">{review.comment}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {user && (
                      <Button variant="outline" className="w-full mt-4" onClick={handleBookNow}>
                        Book & Leave a Review
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Right: Booking Card */}
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }}>
              <Card className="sticky top-20">
                <CardContent className="p-6 space-y-4">
                  {/* Price */}
                  <div className="text-center">
                    <p className="text-3xl font-bold text-primary">
                      ₹{venue.base_price?.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">per hour / per turf</p>
                  </div>
                  <Separator />

                  {/* Details list */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Operating Hours</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(venue.opening_hour)} – {formatTime(venue.closing_hour)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Turfs Available</p>
                        <p className="text-xs text-muted-foreground">{venue.turfs} turf{venue.turfs > 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Slot Duration</p>
                        <p className="text-xs text-muted-foreground">{venue.slot_duration_minutes || 60} minutes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Rating</p>
                        <p className="text-xs text-muted-foreground">
                          {avgRating.toFixed(1)} / 5 ({totalReviews} reviews)
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Button className="w-full" size="lg" onClick={handleBookNow}>
                    <Calendar className="w-4 h-4 mr-2" />
                    {user ? "Book Now" : "Login to Book"}
                  </Button>

                  {!user && (
                    <p className="text-xs text-center text-muted-foreground">
                      <Link to="/auth" className="text-primary hover:underline">Sign up</Link> or <Link to="/auth" className="text-primary hover:underline">log in</Link> to book this venue
                    </p>
                  )}

                  {/* Share */}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={handleCopyLink}>
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Share"}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => setShowQR(true)}>
                      <QrCode className="w-3.5 h-3.5" />
                      QR Code
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Sports supported */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-3">Sports Available</p>
                <div className="flex flex-wrap gap-2">
                  {venue.sports?.map((s) => (
                    <Badge key={s} className={`${SPORT_COLORS[s] || "bg-gray-100 text-gray-700"}`}>
                      {SPORT_LABELS[s] || s}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Realtime indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Page updates automatically
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-white rounded-xl shadow-inner">
              <QRCodeSVG
                value={pageUrl}
                size={200}
                level="H"
                includeMargin={false}
                imageSettings={{
                  src: "",
                  height: 0,
                  width: 0,
                  excavate: false,
                }}
              />
            </div>
            <div className="text-center">
              <p className="font-semibold">{venue.name}</p>
              <p className="text-sm text-muted-foreground">{venue.city}</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Button className="flex-1" onClick={() => setShowQR(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
