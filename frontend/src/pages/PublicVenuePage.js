import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { venueAPI } from "@/lib/api";
import { mediaUrl } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MapPin,
  Star,
  Clock,
  Users,
  Zap,
  Share2,
  QrCode,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Phone,
  CheckCircle2,
  Calendar,
  Tag,
  ShieldCheck,
  Trophy,
  Wifi,
  Coffee,
  Car,
  Droplets,
  Wind,
  Video,
  ShoppingBag,
  AlertCircle,
  Copy,
  Check,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const SPORT_LABELS = {
  football: "Football",
  cricket: "Cricket",
  badminton: "Badminton",
  basketball: "Basketball",
  tennis: "Tennis",
  table_tennis: "Table Tennis",
  volleyball: "Volleyball",
  hockey: "Hockey",
  kabaddi: "Kabaddi",
  swimming: "Swimming",
};

const SPORT_COLORS = {
  football:
    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  cricket:
    "bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300",
  badminton:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  basketball:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  tennis:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  table_tennis:
    "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
};

const AMENITY_ICONS = {
  Parking: <Car className="w-4 h-4" />,
  Floodlights: <Zap className="w-4 h-4" />,
  "Changing Room": <ShieldCheck className="w-4 h-4" />,
  "Changing Rooms": <ShieldCheck className="w-4 h-4" />,
  Washroom: <ShieldCheck className="w-4 h-4" />,
  AC: <Wind className="w-4 h-4" />,
  Shower: <Droplets className="w-4 h-4" />,
  "Drinking Water": <Droplets className="w-4 h-4" />,
  "Water Cooler": <Droplets className="w-4 h-4" />,
  Cafe: <Coffee className="w-4 h-4" />,
  Cafeteria: <Coffee className="w-4 h-4" />,
  "Pro Shop": <ShoppingBag className="w-4 h-4" />,
  Coaching: <Trophy className="w-4 h-4" />,
  WiFi: <Wifi className="w-4 h-4" />,
  "Video Analysis": <Video className="w-4 h-4" />,
  "First Aid": <AlertCircle className="w-4 h-4" />,
  Nets: <CheckCircle2 className="w-4 h-4" />,
  "Bowling Machine": <CheckCircle2 className="w-4 h-4" />,
  "Seating Area": <Users className="w-4 h-4" />,
  Scoreboard: <Trophy className="w-4 h-4" />,
};

export default function PublicVenuePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => { window.scrollTo(0, 0); }, []);
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

  const fetchVenueData = useCallback(
    async (showLoader = false) => {
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
    },
    [slug],
  );

  // WebSocket connection with reconnect
  const connectWs = useCallback((venueId) => {
    if (!venueId) return;
    const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
    const wsUrl =
      backendUrl.replace(/^https/, "wss").replace(/^http/, "ws") +
      `/api/venues/ws/${venueId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus("live");
      reconnectAttempts.current = 0;
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
      } catch {
        /* ignore bad messages */
      }
    };

    ws.onerror = () => setWsStatus("reconnecting");

    ws.onclose = () => {
      setWsStatus("reconnecting");
      // Exponential backoff: 2s, 4s, 8s, max 30s
      const delay = Math.min(
        2000 * Math.pow(2, reconnectAttempts.current),
        30000,
      );
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
    if (venue)
      document.title = `${venue.name} - ${venue.city} | Horizon Sports`;
    return () => {
      document.title = "Horizon Sports";
    };
  }, [venue]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: venue?.name || "Horizon Sports Venue",
          text: `Check out ${venue?.name} on Horizon Sports!`,
          url: pageUrl,
        });
      } catch (err) {
        // User cancelled or error — silently ignore
        if (err.name !== "AbortError") {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
      const textArea = document.createElement("textarea");
      textArea.value = pageUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error("Could not copy link. Please copy it manually.");
      }
      document.body.removeChild(textArea);
    }
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
          <div className="w-12 h-12 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto" />
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
          <p className="text-muted-foreground">
            This venue page doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const images =
    venue.images?.length > 0
      ? venue.images
      : [
          "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1200&q=80",
        ];

  const avgRating = reviewSummary?.average_rating || venue.rating || 0;
  const totalReviews = reviewSummary?.total_reviews || venue.total_reviews || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Image */}
      <div className="relative h-64 sm:h-80 md:h-96 overflow-hidden bg-muted">
        <img
          src={mediaUrl(images[currentImageIndex])}
          alt={venue.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src =
              "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1200&q=80";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

        {/* Floating Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 z-30 flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/40 backdrop-blur-sm text-white text-sm font-medium hover:bg-black/60 transition-colors shadow-lg"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {/* Left/Right Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() =>
                setCurrentImageIndex(
                  (i) => (i - 1 + images.length) % images.length,
                )
              }
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={() =>
                setCurrentImageIndex((i) => (i + 1) % images.length)
              }
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Image thumbnails */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
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
        <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
          <div className="max-w-6xl mx-auto pointer-events-auto">
            <div className="flex flex-wrap gap-2 mb-2">
              {venue.sports?.map((s) => (
                <Badge
                  key={s}
                  className={`text-xs ${SPORT_COLORS[s] || "bg-gray-100 text-gray-700"}`}
                >
                  {SPORT_LABELS[s] || s}
                </Badge>
              ))}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white">
              {venue.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-white/90">
              <span className="flex items-center gap-1 text-sm">
                <MapPin className="w-4 h-4" />
                {venue.area ? `${venue.area}, ` : ""}
                {venue.city}
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div
                className={`bg-card rounded-[28px] border border-border/40 shadow-sm ${justUpdated ? "ring-2 ring-brand-600 ring-offset-2 transition-all duration-500" : ""}`}
              >
                <div className="p-6">
                  <h2 className="admin-heading mb-3">About This Venue</h2>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-justify">
                    {venue.description}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Amenities */}
            {venue.amenities?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <div className="bg-card border border-border/40 shadow-sm rounded-[28px]">
                  <div className="p-6">
                    <h2 className="admin-heading mb-4">Amenities</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {venue.amenities.map((amenity) => (
                        <div
                          key={amenity}
                          className="flex items-center gap-2 p-3 rounded-xl bg-secondary/20"
                        >
                          <span className="text-brand-600">
                            {AMENITY_ICONS[amenity] || (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                          </span>
                          <span className="admin-name text-sm">{amenity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Location */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <div className="bg-card border border-border/40 shadow-sm rounded-[28px]">
                <div className="p-6">
                  <h2 className="admin-heading mb-4">Location</h2>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-600/10 flex items-center justify-center shrink-0 mt-1">
                      <MapPin className="w-5 h-5 text-brand-600" />
                    </div>
                    <div>
                      <p className="font-medium">{venue.address}</p>
                      {venue.area && (
                        <p className="text-muted-foreground text-sm">
                          {venue.area}
                        </p>
                      )}
                      <p className="text-muted-foreground text-sm">
                        {venue.city}
                      </p>
                      {venue.lat && venue.lng && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-brand-600 text-sm mt-2 hover:underline"
                        >
                          View on Google Maps{" "}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Reviews */}
            {reviews.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <div className="bg-card border border-border/40 shadow-sm rounded-[28px]">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="admin-heading">Reviews</h2>
                      <div className="flex items-center gap-1">
                        <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        <span className="admin-name">
                          {avgRating.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          ({totalReviews})
                        </span>
                      </div>
                    </div>
                    {reviewSummary?.distribution && (
                      <div className="space-y-1 mb-6">
                        {[5, 4, 3, 2, 1].map((r) => {
                          const count = reviewSummary.distribution[r] || 0;
                          const pct =
                            totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                          return (
                            <div
                              key={r}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span className="w-4 text-right text-muted-foreground">
                                {r}
                              </span>
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-yellow-400 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="w-6 text-muted-foreground">
                                {count}
                              </span>
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
                              <div className="w-8 h-8 rounded-full bg-brand-600/10 flex items-center justify-center">
                                <span className="text-xs font-bold text-brand-600">
                                  {review.user_details?.name?.[0] || "U"}
                                </span>
                              </div>
                              <span className="admin-name text-sm">
                                {review.user_details?.name || "User"}
                              </span>
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
                            <p className="text-sm text-muted-foreground ml-10">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    {user && (
                      <Button
                        variant="outline"
                        className="w-full mt-4 admin-btn"
                        onClick={handleBookNow}
                      >
                        Book & Leave a Review
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right: Booking Card */}
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="bg-card border border-border/40 shadow-sm sticky top-20 rounded-[28px]">
                <div className="p-6 space-y-4">
                  {/* Price */}
                  <div className="text-center">
                    <p className="admin-value text-brand-600 text-3xl">
                      ₹{venue.base_price?.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      per hour / per turf
                    </p>
                  </div>
                  <Separator />

                  {/* Details list */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="admin-name text-sm">Operating Hours</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTime(venue.opening_hour)} –{" "}
                          {formatTime(venue.closing_hour)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="admin-name text-sm">Turfs Available</p>
                        <p className="text-xs text-muted-foreground">
                          {venue.turfs} turf{venue.turfs > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Tag className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <p className="admin-name text-sm">Slot Duration</p>
                        <p className="text-xs text-muted-foreground">
                          {venue.slot_duration_minutes || 60} minutes
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0" />
                      <div>
                        <p className="admin-name text-sm">Rating</p>
                        <p className="text-xs text-muted-foreground">
                          {avgRating.toFixed(1)} / 5 ({totalReviews} reviews)
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <Button
                    className="w-full bg-brand-600 hover:bg-brand-500 text-white admin-btn rounded-xl shadow-lg shadow-brand-600/20"
                    size="lg"
                    onClick={handleBookNow}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    {user ? "Book Now" : "Login to Book"}
                  </Button>

                  {!user && (
                    <p className="text-xs text-center text-muted-foreground">
                      <Link
                        to="/auth"
                        className="text-brand-600 hover:underline"
                      >
                        Sign up
                      </Link>{" "}
                      or{" "}
                      <Link
                        to="/auth"
                        className="text-brand-600 hover:underline"
                      >
                        log in
                      </Link>{" "}
                      to book this venue
                    </p>
                  )}

                  {/* Share */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={handleShare}
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                      {copied ? "Copied!" : "Share"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => setShowQR(true)}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      QR Code
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Sports supported */}
            <div className="bg-card border border-border/40 shadow-sm rounded-[28px]">
              <div className="p-4">
                <p className="admin-section-label mb-3">Sports Available</p>
                <div className="flex flex-wrap gap-2">
                  {venue.sports?.map((s) => (
                    <Badge
                      key={s}
                      className={`${SPORT_COLORS[s] || "bg-gray-100 text-gray-700"}`}
                    >
                      {SPORT_LABELS[s] || s}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Live connection indicator */}
            <div className="flex items-center gap-2 text-xs px-1">
              <AnimatePresence mode="wait">
                {wsStatus === "live" ? (
                  <motion.div
                    key="live"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1.5 text-green-600 dark:text-green-400"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <Radio className="w-3 h-3" />
                    Live — updates instantly
                  </motion.div>
                ) : wsStatus === "reconnecting" ? (
                  <motion.div
                    key="reconnecting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1.5 text-amber-500"
                  >
                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Reconnecting...
                  </motion.div>
                ) : (
                  <motion.div
                    key="connecting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-1.5 text-muted-foreground"
                  >
                    <div className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
                    Connecting...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-[95vw] sm:max-w-sm rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-card rounded-xl shadow-inner">
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
              <p className="admin-name">{venue.name}</p>
              <p className="text-sm text-muted-foreground">{venue.city}</p>
            </div>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCopyLink}
              >
                {copied ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
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
