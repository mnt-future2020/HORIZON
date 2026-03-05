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
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import LandingHeader from "@/components/landing/LandingHeader";
import {
  SPORT_LABELS,
  SPORT_COLORS,
  SPORT_ICONS,
  getAmenityIcon,
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

      <div className="mx-4 lg:mx-20">
        {/* Breadcrumb — only for logged-in users */}
        {user ? (
          <div className="pt-6 md:pt-8">
            <nav
              className="flex items-center flex-wrap text-gray-500 text-sm font-medium w-full"
              aria-label="Breadcrumb"
            >
              <Link
                to="/venues"
                className="hover:text-brand-600 hover:underline cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-sm"
              >
                Venues
              </Link>
              <span className="mx-2">&gt;</span>
              <Link
                to={`/venues?city=${encodeURIComponent(venue.city || "")}`}
                className="hover:text-brand-600 hover:underline cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 rounded-sm"
              >
                {venue.city || "City"}
              </Link>
              <span className="mx-2">&gt;</span>
              <span
                className="text-gray-900 font-medium truncate max-w-[250px]"
                aria-current="page"
              >
                {venue.name}
              </span>
            </nav>
          </div>
        ) : (
          <div className="pt-20" />
        )}

        {/* Venue Header — 3 col grid matching reference */}
        <div className="mt-6">
          <div className="grid w-full md:h-24 grid-flow-row-dense grid-cols-3 grid-rows-2 gap-y-1 md:gap-y-0 md:gap-x-5">
            {/* Name — full width */}
            <div className="w-full relative text-wrap col-span-3">
              <h1 className="md:font-bold md:text-[32px] md:leading-[36px] font-bold text-[24px] leading-[36px] text-foreground md:whitespace-nowrap whitespace-normal md:line-clamp-1 line-clamp-2">
                {venue.name}
              </h1>
            </div>

            {/* Location + Rating — left 2 cols */}
            <div className="flex items-center w-full col-span-3 md:col-span-2">
              <div className="flex flex-col w-full sm:items-center sm:justify-start sm:flex-row">
                <div className="text-[#515455] font-medium">
                  {venue.area || venue.city}
                </div>
                <div className="flex flex-row mt-2 md:mt-0 sm:ml-2 sm:items-center sm:justify-center">
                  <span className="bg-muted-foreground w-1 h-1 rounded-full hidden md:block" />
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 ml-1" />
                  <div className="mr-1 text-[#515455] text-sm font-semibold ml-1">
                    {avgRating.toFixed(1)}
                  </div>
                  <div className="text-sm text-[#515455] font-medium">
                    ({totalReviews} ratings)
                  </div>
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

            {/* Action Buttons — right col (hidden on mobile, shown in sticky bar) */}
            <div className="hidden md:flex z-10 flex-row w-full col-span-3 mt-3 space-x-2 md:mt-0 sm:col-span-2 md:col-span-1">
              <div className="flex flex-col items-center justify-start w-full space-y-3">
                <div className="w-full">
                  <button
                    className="w-full h-12 px-3 py-2 font-semibold text-white rounded-md bg-brand-600 hover:bg-brand-500 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                    onClick={handleBookNow}
                    aria-label={
                      user ? "Book this venue now" : "Log in to book this venue"
                    }
                  >
                    {user ? "Book Now" : "Login to Book"}
                  </button>
                </div>
                <div className="flex flex-row items-center justify-start w-full space-x-2">
                  <button
                    className="flex items-center justify-center w-full h-12 space-x-2 font-semibold border-2 cursor-pointer hover:bg-secondary rounded-md border-border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    onClick={handleShare}
                    aria-label={copied ? "Link copied" : "Share this venue"}
                  >
                    {copied ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Share2 className="w-5 h-5" />
                    )}
                    <div>{copied ? "Copied!" : "Share"}</div>
                  </button>
                  <button
                    className="w-full h-12 px-3 py-2 font-semibold text-sm md:text-base border-brand-600 border text-brand-600 rounded-md bg-background hover:bg-brand-50 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    onClick={() => setShowQR(true)}
                    aria-label="Show QR code for this venue"
                  >
                    QR Code
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid w-full grid-cols-1 gap-2 mt-6 md:gap-x-5 md:grid-cols-3">
          {/* Image Carousel — 2 cols */}
          <div className="hidden w-full row-span-1 md:block md:col-span-2">
            <div
              className={`overflow-hidden aspect-video rounded-md w-full relative bg-muted ${justUpdated ? "ring-2 ring-brand-600 ring-offset-2 transition-all duration-500" : ""}`}
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center text-foreground hover:bg-white cursor-pointer transition-colors duration-200 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((i) => (i + 1) % images.length)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center text-foreground hover:bg-white cursor-pointer transition-colors duration-200 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImageIndex(i)}
                        className={`w-3 h-3 rounded-full cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${i === currentImageIndex ? "bg-brand-600" : "bg-white/80 hover:bg-white"}`}
                        aria-label={`Go to image ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Image Carousel */}
          <div className="md:hidden w-full">
            <div
              className={`overflow-hidden aspect-video rounded-md w-full relative bg-muted ${justUpdated ? "ring-2 ring-brand-600 ring-offset-2 transition-all duration-500" : ""}`}
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center text-foreground hover:bg-white cursor-pointer transition-colors duration-200 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex((i) => (i + 1) % images.length)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center text-foreground hover:bg-white cursor-pointer transition-colors duration-200 shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentImageIndex(i)}
                        className={`w-3 h-3 rounded-full cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${i === currentImageIndex ? "bg-brand-600" : "bg-white/80 hover:bg-white"}`}
                        aria-label={`Go to image ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sidebar — right column */}
          <div className="w-full rounded-md z-0 md:row-span-2">
            <div className="flex flex-col md:mt-14">
              {/* Timing Card */}
              <div className="flex flex-col p-4 border rounded-md border-border">
                <h2 className="font-semibold text-base md:text-lg">Timing</h2>
                <div className="mt-2 leading-relaxed">
                  {formatTime(venue.opening_hour)} -{" "}
                  {formatTime(venue.closing_hour)}
                </div>
              </div>

              {/* Location Card with Map */}
              <div className="flex flex-col h-auto p-4 mt-5 border rounded-md border-border">
                <div className="font-semibold text-base md:text-lg">
                  Location
                </div>
                <h2 className="my-2 text-sm">{venue.address}</h2>
                {(venue.google_maps_url || (venue.lat && venue.lng)) && (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border mt-2 shadow-inner bg-muted/30">
                    <iframe
                      src={
                        venue.google_maps_url ||
                        `https://www.google.com/maps/embed/v1/place?key=AIzaSyB9q4uF6xjrDG-n2jvClxrtOV_jSXUAPUY&q=${venue.lat},${venue.lng}&zoom=18`
                      }
                      className="absolute inset-0 w-full h-full border-0 shadow-sm"
                      allowFullScreen=""
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      title="Venue Location"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Left content sections — 2 cols */}
          <div className="w-full rounded-md md:row-span-5 md:col-span-2">
            {/* Sports Available */}
            {venue.sports?.length > 0 && (
              <div className="p-6 mt-4 border rounded-md border-border">
                <div className="flex flex-col justify-start md:items-center md:flex-row">
                  <h2 className="font-semibold text-base md:text-lg">
                    Sports Available
                  </h2>
                  <div className="text-sm text-muted-foreground md:ml-2">
                    (Click on sports to view price chart)
                  </div>
                </div>
                <div className="grid items-center w-full grid-cols-3 gap-5 mt-5 sm:gap-6 sm:grid-cols-5 lg:gap-6 xl:grid-cols-7">
                  {venue.sports.map((s) => {
                    const SportIcon =
                      SPORT_ICONS[s] || SPORT_ICONS[s.replace(/ /g, "_")];
                    return (
                      <div
                        key={s}
                        role="button"
                        tabIndex={0}
                        className="flex flex-col items-center py-1 border rounded shadow-md cursor-pointer hover:border-brand-600 aspect-square border-border justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${SPORT_COLORS[s] || SPORT_COLORS[s.replace(/ /g, "_")] || "bg-gray-100 text-gray-700"}`}
                        >
                          {SportIcon ? (
                            <SportIcon className="w-5 h-5" />
                          ) : (
                            <span className="text-lg font-semibold">
                              {(SPORT_LABELS[s] || s).charAt(0)}
                            </span>
                          )}
                        </div>
                        <h3 className="flex justify-center w-full mt-1 text-xs font-medium text-center text-muted-foreground">
                          {SPORT_LABELS[s] || s}
                        </h3>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Amenities */}
            {venue.amenities?.length > 0 && (
              <div className="flex flex-col mt-5">
                <div className="p-6 border rounded-md border-border">
                  <h3 className="font-semibold text-base md:text-lg">
                    Amenities
                  </h3>
                  <div className="grid grid-cols-2 gap-2 mt-5 md:grid-cols-3 lg:grid-cols-4 gap-y-6">
                    {venue.amenities.map((amenity) => {
                      const AmenityIcon = getAmenityIcon(amenity);
                      return (
                        <div
                          key={amenity}
                          className="flex flex-row items-start space-x-2 text-sm capitalize"
                        >
                          <div className="relative h-5 min-w-[20px] flex items-center">
                            <AmenityIcon className="w-5 h-5 text-brand-600 fill-brand-600/20" />
                          </div>
                          <span>{amenity}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* About Venue */}
            <div className="w-full">
              <div className="flex flex-col items-start w-full mt-5">
                <div className="w-full p-5 border rounded-md border-border">
                  <div className="font-semibold text-base md:text-lg">
                    About Venue
                  </div>
                  <div className="mt-5 text-sm md:text-base">
                    {isHtmlContent(venue.description) ? (
                      <div
                        className="text-muted-foreground leading-relaxed prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-strong:text-foreground prose-ul:list-disc prose-ol:list-decimal"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(venue.description),
                        }}
                      />
                    ) : (
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-7">
                        {venue.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="flex flex-col items-start w-full mt-5">
                <div className="w-full p-5 border rounded-md border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-base md:text-lg">
                      Reviews
                    </h3>
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold">
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
                            <span className="font-medium text-sm">
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
                    <button
                      className="w-full mt-4 h-12 px-3 py-2 font-semibold text-sm border-brand-600 border text-brand-600 rounded-md bg-background hover:bg-brand-50 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                      onClick={handleBookNow}
                      aria-label="Book venue and leave a review"
                    >
                      Book & Leave a Review
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Action Buttons — sticky bottom */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-50 supports-[backdrop-filter]:bg-background/80">
          <div className="flex flex-col items-center justify-start w-full space-y-2 p-3">
            <button
              className="w-full h-12 px-3 py-2 font-semibold text-white rounded-md bg-brand-600 hover:bg-brand-500 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
              onClick={handleBookNow}
              aria-label={
                user ? "Book this venue now" : "Log in to book this venue"
              }
            >
              {user ? "Book Now" : "Login to Book"}
            </button>
            <div className="flex flex-row items-center justify-start w-full space-x-2">
              <button
                className="flex items-center justify-center w-full h-12 space-x-2 font-semibold border-2 cursor-pointer hover:bg-secondary rounded-md border-border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                onClick={handleShare}
                aria-label={copied ? "Link copied" : "Share this venue"}
              >
                {copied ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
                <div>{copied ? "Copied!" : "Share"}</div>
              </button>
              <button
                className="w-full h-12 px-3 py-2 font-semibold text-sm border-brand-600 border text-brand-600 rounded-md bg-background hover:bg-brand-50 cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                onClick={() => setShowQR(true)}
                aria-label="Show QR code for this venue"
              >
                QR Code
              </button>
            </div>
          </div>
        </div>

        {/* Bottom spacer for mobile sticky bar */}
        <div className="md:hidden h-36" />

        {/* Bottom spacing */}
        <div className="pb-10" />
      </div>

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
