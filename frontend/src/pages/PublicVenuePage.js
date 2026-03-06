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
  Star,
  Clock,
  Share2,
  QrCode,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Phone,
  AlertCircle,
  Copy,
  Check,
  Radio,
  MapPin,
  IndianRupee,
  Users,
  LayoutGrid,
  Timer,
  CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import LandingHeader from "@/components/landing/LandingHeader";
import {
  SPORT_LABELS,
  getSportIcon,
  getAmenityIcon,
  getSportLabel,
} from "@/lib/venue-constants";
import { sanitizeHtml, isHtmlContent } from "@/lib/sanitize";

export default function PublicVenuePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const [venue, setVenue] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [justUpdated, setJustUpdated] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [pricingSport, setPricingSport] = useState(null); // sport key for price chart modal
  const [pricingRules, setPricingRules] = useState([]);

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
          const [reviewsRes, summaryRes, rulesRes] = await Promise.all([
            venueAPI.getReviews(res.data.id),
            venueAPI.getReviewSummary(res.data.id),
            venueAPI.getPricingRules(res.data.id),
          ]);
          setReviews(reviewsRes.data || []);
          setReviewSummary(summaryRes.data || null);
          setPricingRules((rulesRes.data || []).filter(r => r.is_active));
        } catch {
          // Reviews/rules optional
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

  useEffect(() => {
    fetchVenueData(true);
  }, [fetchVenueData]);

  useEffect(() => {
    if (!venue?.id) return;
    connectWs(venue.id);
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [venue?.id, connectWs]);

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
      {/* Public Navbar — shown only for non-logged-in users */}
      {!user && <LandingHeader />}

      <div className="mx-4 sm:mx-6 md:mx-10 lg:mx-20">
        {/* Breadcrumb — logged-in users only */}
        {user ? (
          <div className="pt-5 md:pt-7">
            <nav aria-label="Breadcrumb" className="inline-flex items-center rounded-full bg-secondary/50 border border-border/30 px-3 py-1.5 sm:px-4 sm:py-2">
              <ol className="flex items-center gap-0 text-xs sm:text-[13px] text-muted-foreground">
                <li className="inline-flex items-center">
                  <Link
                    to="/venues"
                    className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md whitespace-nowrap transition-all duration-200 hover:text-brand-600 hover:bg-brand-600/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:rounded-md"
                  >
                    <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    Venues
                  </Link>
                </li>
                <li role="presentation" aria-hidden="true" className="mx-0.5 sm:mx-1 text-border">
                  <span className="text-[10px]">/</span>
                </li>
                <li className="inline-flex items-center">
                  <Link
                    to={`/venues?city=${encodeURIComponent(venue.city || "")}`}
                    className="px-1.5 py-0.5 rounded-md whitespace-nowrap transition-all duration-200 hover:text-brand-600 hover:bg-brand-600/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:rounded-md"
                  >
                    {venue.city || "City"}
                  </Link>
                </li>
                <li role="presentation" aria-hidden="true" className="mx-0.5 sm:mx-1 text-border">
                  <span className="text-[10px]">/</span>
                </li>
                <li className="inline-flex items-center min-w-0">
                  <span
                    className="px-1.5 py-0.5 text-foreground font-semibold truncate max-w-[140px] sm:max-w-[240px] md:max-w-[360px]"
                    aria-current="page"
                    title={venue.name}
                  >
                    {venue.name}
                  </span>
                </li>
              </ol>
            </nav>
          </div>
        ) : (
          <div className="pt-20" />
        )}

        {/* Venue Header — 3 col grid matching reference */}
        <div className="mt-6">
          <div className="grid w-full grid-flow-row-dense grid-cols-1 md:grid-cols-3 gap-y-2 md:gap-y-0 md:gap-x-5">
            {/* Name + Badge — full width */}
            <div className="w-full relative text-wrap col-span-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="md:font-bold md:text-[32px] md:leading-[36px] font-bold text-[24px] leading-[36px] text-foreground md:whitespace-nowrap whitespace-normal md:line-clamp-1 line-clamp-2">
                  {venue.name}
                </h1>
                {venue.badge && (
                  <span className={`inline-flex items-center shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${venue.badge === "bookable" ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                    {venue.badge === "bookable" ? "Instant Book" : "Enquiry Only"}
                  </span>
                )}
              </div>
            </div>

            {/* Location + Rating — left 2 cols */}
            <div className="flex items-center w-full col-span-3 md:col-span-2">
              <div className="flex flex-col w-full sm:items-center sm:justify-start sm:flex-row">
                <div className="text-muted-foreground font-medium">
                  {venue.area || venue.city}
                </div>
                <div className="flex flex-row mt-2 md:mt-0 sm:ml-2 sm:items-center sm:justify-center flex-wrap gap-y-1">
                  <span className="bg-muted-foreground w-1 h-1 rounded-full hidden md:block" />
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 ml-1" />
                  <span className="text-sm font-semibold text-foreground ml-1">
                    {avgRating.toFixed(1)}
                  </span>
                  <span className="text-sm text-muted-foreground ml-0.5">
                    ({totalReviews} {totalReviews === 1 ? "rating" : "ratings"})
                  </span>
                  {venue.total_bookings > 0 && (
                    <>
                      <span className="bg-muted-foreground w-1 h-1 rounded-full mx-2 hidden sm:block" />
                      <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2 sm:ml-0">
                        <Users className="w-3 h-3" />
                        {venue.total_bookings}+ booked
                      </span>
                    </>
                  )}
                  <button
                    onClick={handleBookNow}
                    className="ml-2 text-sm font-semibold underline cursor-pointer text-brand-600 hover:text-brand-700 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-sm min-h-[32px] px-1"
                    aria-label="Rate this venue"
                  >
                    Rate Venue
                  </button>
                  {/* Live indicator */}
                  <AnimatePresence mode="wait">
                    {wsStatus === "live" ? (
                      <motion.div
                        key="live"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 ml-3"
                      >
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <Radio className="w-3 h-3" />
                        Live
                      </motion.div>
                    ) : wsStatus === "reconnecting" ? (
                      <motion.div
                        key="reconnecting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1.5 text-xs text-amber-500 ml-3"
                      >
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        Reconnecting...
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Spacer — action buttons moved to sidebar */}
            <div className="hidden md:block md:col-span-1" />
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid w-full grid-cols-1 gap-2 mt-6 md:gap-x-5 md:grid-cols-3">
          {/* Image Carousel */}
          <div className="w-full md:col-span-2 order-1 md:order-none">
            <div
              className={`overflow-hidden aspect-video rounded-2xl w-full relative bg-muted ${justUpdated ? "ring-2 ring-brand-600 ring-offset-2 transition-all duration-500" : ""}`}
            >
              <img
                src={mediaUrl(images[currentImageIndex])}
                alt={venue.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src =
                    "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1200&q=80";
                }}
              />
              {images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentImageIndex(
                        (i) => (i - 1 + images.length) % images.length,
                      )
                    }
                    className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-white cursor-pointer transition-colors duration-200 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((i) => (i + 1) % images.length)
                    }
                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center text-foreground hover:bg-white cursor-pointer transition-colors duration-200 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                  <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 z-10">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImageIndex(i)}
                        className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${i === currentImageIndex ? "bg-brand-600 scale-110" : "bg-white/80 hover:bg-white"}`}
                        aria-label={`Go to image ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sidebar — right column (pushed below main content on mobile) */}
          <div className="w-full z-0 md:row-span-2 order-3 md:order-none">
            <div className="flex flex-col gap-4 mt-4 md:mt-0">
              {/* Quick Info Card — price, turfs, duration, hours, contact */}
              <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden divide-y divide-border/40">
                {/* Key stats row */}
                <div className="flex items-stretch">
                  {venue.base_price != null && (
                    <div className="flex-1 py-4 text-center border-r border-border/40">
                      <div className="text-lg font-bold text-foreground leading-none">
                        <span className="text-brand-600">₹</span>{venue.base_price}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">per slot</div>
                    </div>
                  )}
                  {venue.turfs > 0 && (
                    <div className="flex-1 py-4 text-center border-r border-border/40">
                      <div className="text-lg font-bold text-foreground leading-none">{venue.turfs}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">{venue.turfs === 1 ? "Court" : "Courts"}</div>
                    </div>
                  )}
                  <div className="flex-1 py-4 text-center">
                    <div className="text-lg font-bold text-foreground leading-none">
                      {venue.slot_duration_minutes || 60}<span className="text-xs font-semibold ml-0.5">min</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">session</div>
                  </div>
                </div>

                {/* Open hours */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-brand-600/8 shrink-0">
                    <CalendarClock className="h-4 w-4 text-brand-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{formatTime(venue.opening_hour)} – {formatTime(venue.closing_hour)}</div>
                    <div className="text-[10px] text-muted-foreground">Open hours</div>
                  </div>
                </div>

                {/* Contact phone */}
                {venue.contact_phone && (
                  <a
                    href={`tel:${venue.contact_phone}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors group"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-brand-600/8 shrink-0 group-hover:bg-brand-600/15 transition-colors">
                      <Phone className="h-4 w-4 text-brand-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground group-hover:text-brand-600 transition-colors">{venue.contact_phone}</div>
                      <div className="text-[10px] text-muted-foreground">Tap to call</div>
                    </div>
                  </a>
                )}
              </div>

              {/* Location Card with Map */}
              <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="p-2 rounded-xl bg-brand-600/10">
                    <MapPin className="h-4 w-4 text-brand-600" />
                  </div>
                  <h2 className="font-semibold text-sm sm:text-base text-foreground">Location</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{venue.address}</p>
                {(venue.google_maps_url || (venue.lat && venue.lng)) && (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/40 mt-4 bg-muted/30">
                    <iframe
                      src={
                        venue.google_maps_url ||
                        `https://www.google.com/maps/embed/v1/place?key=AIzaSyB9q4uF6xjrDG-n2jvClxrtOV_jSXUAPUY&q=${venue.lat},${venue.lng}&zoom=18`
                      }
                      className="absolute inset-0 w-full h-full border-0"
                      allowFullScreen=""
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Venue Location"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="hidden md:flex flex-col w-full gap-2.5">
                <button
                  className="w-full h-12 px-3 py-2 font-semibold text-white rounded-xl bg-brand-600 hover:bg-brand-500 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                  onClick={handleBookNow}
                  aria-label={user ? "Book this venue now" : "Log in to book this venue"}
                >
                  {user ? "Book Now" : "Login to Book"}
                </button>
                <div className="flex gap-2">
                  <button
                    className="flex items-center justify-center flex-1 h-11 gap-2 font-semibold border border-border cursor-pointer hover:bg-secondary rounded-xl transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    onClick={handleShare}
                    aria-label={copied ? "Link copied" : "Share this venue"}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    <span className="text-sm">{copied ? "Copied!" : "Share"}</span>
                  </button>
                  <button
                    className="flex items-center justify-center flex-1 h-11 gap-2 font-semibold text-sm border border-brand-600 text-brand-600 rounded-xl bg-background hover:bg-brand-50 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    onClick={() => setShowQR(true)}
                    aria-label="Show QR code for this venue"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QR Code</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Left content sections — 2 cols */}
          <div className="w-full md:row-span-5 md:col-span-2 order-2 md:order-none">
            {/* Sports Available */}
            {venue.sports?.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 mt-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 mb-5">
                  <h2 className="font-semibold text-base sm:text-lg text-foreground">
                    Sports Available
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    Tap a sport to view price chart
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {venue.sports.map((s) => {
                    const SportIcon = getSportIcon(s);
                    return (
                      <div
                        key={s}
                        role="button"
                        tabIndex={0}
                        onClick={() => setPricingSport(s)}
                        onKeyDown={(e) => e.key === "Enter" && setPricingSport(s)}
                        className="flex flex-col items-center gap-2 w-[72px] sm:w-20 py-3 rounded-2xl border border-border/40 bg-background cursor-pointer hover:border-brand-600/50 hover:shadow-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 group"
                      >
                        <div
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 bg-brand-600/10 text-brand-600"
                        >
                          <SportIcon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] sm:text-xs font-medium text-muted-foreground text-center leading-tight capitalize">
                          {SPORT_LABELS[s] || s}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Amenities */}
            {venue.amenities?.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 mt-4 shadow-sm">
                <h3 className="font-semibold text-base sm:text-lg text-foreground mb-4">
                  Amenities
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {venue.amenities.map((amenity) => {
                    const AmenityIcon = getAmenityIcon(amenity);
                    return (
                      <div
                        key={amenity}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/40 border border-border/30 text-sm capitalize"
                      >
                        <AmenityIcon className="w-4 h-4 text-brand-600 shrink-0" />
                        <span className="text-foreground/80 truncate">{amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* About Venue */}
            {venue.description && (
              <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 mt-4 shadow-sm">
                <h3 className="font-semibold text-base sm:text-lg text-foreground mb-4">
                  About Venue
                </h3>
                <div className={`text-sm sm:text-base relative ${!descExpanded ? "max-h-[200px] overflow-hidden" : ""}`}>
                  {isHtmlContent(venue.description) ? (
                    <div
                      className="text-muted-foreground leading-relaxed prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-strong:text-foreground prose-ul:list-disc prose-ol:list-decimal"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeHtml(venue.description),
                      }}
                    />
                  ) : (
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                      {venue.description}
                    </p>
                  )}
                  {!descExpanded && (
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent" />
                  )}
                </div>
                <button
                  onClick={() => setDescExpanded(prev => !prev)}
                  className="mt-2 text-sm font-semibold text-brand-600 hover:text-brand-700 transition-colors cursor-pointer"
                >
                  {descExpanded ? "Show less" : "Show more"}
                </button>
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 mt-4 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-base sm:text-lg text-foreground">
                    Reviews
                  </h3>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-yellow-400/10">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold text-sm text-foreground">
                      {avgRating.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      ({totalReviews})
                    </span>
                  </div>
                </div>
                {reviewSummary?.distribution && (
                  <div className="space-y-1.5 mb-6">
                    {[5, 4, 3, 2, 1].map((r) => {
                      const count = reviewSummary.distribution[r] || 0;
                      const pct =
                        totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                      return (
                        <div
                          key={r}
                          className="flex items-center gap-2 text-xs"
                        >
                          <span className="w-3 text-right text-muted-foreground font-medium">
                            {r}
                          </span>
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 shrink-0" />
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="w-5 text-right text-muted-foreground">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-0">
                  {reviews.slice(0, 5).map((review, i) => (
                    <div key={i} className="py-3.5 border-b border-border/40 last:border-0 first:pt-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-brand-600/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-brand-600">
                              {review.user_details?.name?.[0] || "U"}
                            </span>
                          </div>
                          <span className="font-medium text-sm text-foreground">
                            {review.user_details?.name || "User"}
                          </span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground ml-[42px] leading-relaxed">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {user && (
                  <button
                    className="w-full mt-4 h-11 px-3 py-2 font-semibold text-sm border-brand-600 border text-brand-600 rounded-xl bg-background hover:bg-brand-50 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    onClick={handleBookNow}
                    aria-label="Book venue and leave a review"
                  >
                    Book & Leave a Review
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Spacer for mobile sticky bottom bar */}
        <div className="h-36 md:hidden" />

        {/* Mobile Action Buttons — sticky bottom */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border/60 z-50 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center gap-2 p-3">
            <button
              className="flex-1 h-11 px-3 font-semibold text-white rounded-xl bg-brand-600 hover:bg-brand-500 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 text-sm"
              onClick={handleBookNow}
              aria-label={user ? "Book this venue now" : "Log in to book this venue"}
            >
              {user ? "Book Now" : "Login to Book"}
            </button>
            <button
              className="flex items-center justify-center h-11 w-11 shrink-0 border border-border rounded-xl cursor-pointer hover:bg-secondary transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              onClick={handleShare}
              aria-label={copied ? "Link copied" : "Share this venue"}
            >
              {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              className="flex items-center justify-center h-11 w-11 shrink-0 border border-brand-600 text-brand-600 rounded-xl bg-background hover:bg-brand-50 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              onClick={() => setShowQR(true)}
              aria-label="Show QR code for this venue"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Bottom spacer for mobile sticky bar */}
        <div className="md:hidden h-36" />

        {/* Bottom spacing */}
        <div className="pb-10" />
      </div>

      {/* Sport Price Chart Modal */}
      <Dialog open={!!pricingSport} onOpenChange={(open) => !open && setPricingSport(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
          {pricingSport && (() => {
            const SportIcon = getSportIcon(pricingSport);
            const sportName = getSportLabel(pricingSport);
            const basePrice = venue.base_price || 2000;
            const duration = venue.slot_duration_minutes || 60;

            // Find courts for this sport from turf_config
            const courts = [];
            if (venue.turf_config?.length) {
              venue.turf_config.forEach((tc) => {
                const tcSport = (tc.sport || "").toLowerCase().replace(/ /g, "_");
                const pSport = pricingSport.toLowerCase().replace(/ /g, "_");
                if (tcSport === pSport || tcSport === pricingSport.toLowerCase()) {
                  (tc.turfs || []).forEach((t) => {
                    courts.push({ name: t.name || "Court", price: t.price || basePrice });
                  });
                }
              });
            }
            // If no turf_config match, show venue-level pricing
            if (courts.length === 0) {
              courts.push({ name: venue.name || "Court", price: basePrice });
            }

            // Day labels for rule display
            const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

            // Format relevant pricing rules
            const relevantRules = pricingRules.map((rule) => {
              const isDiscount = rule.rule_type === "discount";
              const pct = rule.value || 0;
              const label = isDiscount ? `${pct}% Off` : `${pct}% Surge`;

              let schedule = "";
              if (rule.schedule_type === "one_time") {
                const from = rule.date_from || "";
                const to = rule.date_to || "";
                schedule = from === to ? from : `${from} – ${to}`;
                if (rule.time_from && rule.time_to) schedule += `, ${rule.time_from} – ${rule.time_to}`;
              } else {
                const days = rule.conditions?.days;
                if (days?.length && days.length < 7) {
                  schedule = days.map(d => DAY_NAMES[d] || d).join(", ");
                } else {
                  schedule = "Every day";
                }
                const tr = rule.conditions?.time_range;
                if (tr?.start && tr?.end) schedule += `, ${tr.start} – ${tr.end}`;
              }

              return { name: rule.name, label, schedule, isDiscount };
            });

            return (
              <div>
                {/* Header */}
                <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-border/40">
                  <div className="w-10 h-10 rounded-xl bg-brand-600/10 flex items-center justify-center">
                    <SportIcon className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <DialogHeader className="p-0">
                      <DialogTitle className="text-lg font-bold capitalize">{sportName}</DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {duration} min per slot · {formatTime(venue.opening_hour)} – {formatTime(venue.closing_hour)}
                    </p>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="px-6 py-3 bg-secondary/30 border-b border-border/40">
                  <p className="text-[11px] text-muted-foreground">
                    Pricing is subject to change and is controlled by the venue
                  </p>
                </div>

                {/* Court pricing table */}
                <div className="px-6 py-4 overflow-y-auto max-h-72">
                  <div className="space-y-3">
                    {courts.map((court, i) => (
                      <div key={i} className="rounded-xl border border-border/40 overflow-hidden">
                        <div className="bg-secondary/20 px-4 py-2.5 border-b border-border/30">
                          <p className="text-sm font-semibold text-foreground">{court.name}</p>
                        </div>
                        <div className="divide-y divide-border/30">
                          {/* Base price row */}
                          <div className="flex items-center justify-between px-4 py-3">
                            <span className="text-sm text-muted-foreground">
                              {pricingRules.length > 0 ? "Base Price" : "All Days"}
                            </span>
                            <div className="text-right">
                              <span className="text-sm font-bold text-foreground">
                                ₹{court.price}
                              </span>
                              <span className="text-[10px] text-muted-foreground ml-1">
                                / hour
                              </span>
                            </div>
                          </div>

                          {/* Pricing rules applied to this court */}
                          {relevantRules.map((rule, ri) => {
                            const pct = pricingRules[ri]?.value || 0;
                            const isDiscount = rule.isDiscount;
                            const adjustedPrice = isDiscount
                              ? Math.round(court.price * (1 - pct / 100))
                              : Math.round(court.price * (1 + pct / 100));
                            return (
                              <div key={ri} className="flex items-center justify-between px-4 py-3">
                                <div className="min-w-0 flex-1 mr-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-foreground font-medium truncate">{rule.name}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isDiscount ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>
                                      {rule.label}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{rule.schedule}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className={`text-sm font-bold ${isDiscount ? "text-green-600" : "text-red-600"}`}>
                                    ₹{adjustedPrice}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground ml-1">
                                    / hour
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                  <Button
                    onClick={() => { setPricingSport(null); handleBookNow(); }}
                    className="w-full h-12 bg-brand-600 text-white hover:bg-brand-500 rounded-xl font-semibold"
                  >
                    {user ? "Book Now" : "Login to Book"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="sm:max-w-sm rounded-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 bg-card rounded-md shadow-inner">
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
              <button
                className="flex-1 flex items-center justify-center h-12 space-x-2 font-semibold border-2 rounded-md border-border hover:bg-secondary cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                onClick={handleCopyLink}
                aria-label={copied ? "Link copied" : "Copy venue link"}
              >
                {copied ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button
                className="flex-1 h-12 font-semibold text-white rounded-md bg-brand-600 hover:bg-brand-500 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                onClick={() => setShowQR(false)}
              >
                Done
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
