import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { notificationAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Clock,
  MapPin,
  Zap,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { NotificationsSkeleton } from "@/components/SkeletonLoader";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const res = await notificationAPI.list();
      setNotifications(res.data || []);
    } catch {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await notificationAPI.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.is_read;
    if (filter === "slot_available") return n.type === "slot_available";
    if (filter === "booking")
      return n.type === "booking" || n.type === "booking_confirmed";
    return true;
  });

  // Group by date
  const grouped = {};
  filtered.forEach((n) => {
    const date = n.created_at?.split("T")[0] || "Unknown";
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(n);
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const getIcon = (type) => {
    switch (type) {
      case "slot_available":
        return <MapPin className="h-4 w-4 text-green-400" />;
      case "booking":
      case "booking_confirmed":
        return <Clock className="h-4 w-4 text-brand-400" />;
      default:
        return <Zap className="h-4 w-4 text-amber-400" />;
    }
  };

  if (loading) {
    return <NotificationsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className=" mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="font-display text-display-sm font-black tracking-athletic">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-muted-foreground mt-1">
                {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="athletic-outline"
              size="sm"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 mb-6 flex-wrap"
        >
          {[
            { key: "all", label: "All" },
            { key: "unread", label: "Unread" },
            { key: "slot_available", label: "Slot Alerts" },
            { key: "booking", label: "Bookings" },
          ].map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "athletic" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
              className="font-bold uppercase tracking-wide text-xs"
            >
              {f.label}
            </Button>
          ))}
        </motion.div>

        {/* Notification List */}
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <BellOff className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-display text-xl font-bold text-muted-foreground">
              No notifications
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-2">
              {filter !== "all"
                ? "Try a different filter"
                : "You're all caught up!"}
            </p>
          </motion.div>
        ) : (
          Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, items], groupIdx) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIdx * 0.05 }}
                className="mb-6"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    {date === new Date().toISOString().split("T")[0]
                      ? "Today"
                      : new Date(date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <Badge variant="secondary" className="text-[10px]">
                    {items.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {items.map((notif, idx) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`flex items-start gap-4 p-4 rounded-[24px] border transition-all cursor-pointer hover:-translate-y-0.5 ${
                        notif.is_read
                          ? "bg-card/50 border-border/40"
                          : "bg-card border-primary/20 shadow-sm"
                      }`}
                      onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                    >
                      <div className="mt-0.5 p-2 rounded-lg bg-muted/50">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4
                            className={`font-display font-bold text-sm ${
                              notif.is_read
                                ? "text-muted-foreground"
                                : "text-foreground"
                            }`}
                          >
                            {notif.title}
                          </h4>
                          {!notif.is_read && (
                            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                          {new Date(notif.created_at).toLocaleTimeString(
                            "en-IN",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                      {!notif.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkRead(notif.id);
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))
        )}
      </div>
    </div>
  );
}
