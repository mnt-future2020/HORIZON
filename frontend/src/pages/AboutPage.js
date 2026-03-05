import { Link, useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";
import Logo from "@/components/Logo";
import { Building2, Users, Trophy, Zap, Target, Heart, ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

export default function AboutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const stats = [
    { icon: Building2, value: "16+", label: "Active Venues" },
    { icon: Users, value: "50K+", label: "Registered Lobbians" },
    { icon: Trophy, value: "4.8★", label: "Average Rating" },
  ];

  const features = [
    { icon: Zap, title: "Instant Booking", desc: "Real-time slot availability and instant confirmations" },
    { icon: Users, title: "Matchmaking", desc: "AI-powered opponent matching based on skill level" },
    { icon: Trophy, title: "Skill Ratings", desc: "Glicko-2 algorithm for accurate player skill tracking" },
    { icon: Building2, title: "Venue Management", desc: "Complete dashboard for venue owners with analytics" },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 md:px-12 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-brand-600">
              <Logo size="lg" />
            </Link>
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
              <button
                onClick={() => navigate(-1)}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-sm font-bold text-black hover:text-brand-600 uppercase tracking-wide transition-colors font-brier"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <Link
                to={user ? "/feed" : "/auth"}
                className="inline-flex items-center px-4 sm:px-5 md:px-6 py-2 md:py-2.5 bg-brand-600 text-white font-bold text-xs sm:text-sm rounded-full hover:bg-brand-700 transition-all hover:scale-105"
              >
                {user ? "Dashboard" : "Get Started"}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="pt-24 sm:pt-28 md:pt-36 pb-10 sm:pb-14 md:pb-16 px-4 sm:px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/10 border border-brand-600/20 text-brand-600 text-xs font-bold tracking-widest uppercase mb-5 sm:mb-8">
              <Building2 className="w-3.5 h-3.5" />
              About Us
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-[0.9] mb-5 sm:mb-8">
              <span className="block text-gray-900 font-sans">BUILT FOR</span>
              <span className="block text-brand-600 font-brier mt-1 sm:mt-2">Indian Sports</span>
            </h1>
            <p className="text-gray-500 text-base sm:text-lg md:text-xl max-w-2xl leading-relaxed font-medium">
              LOBBI is a comprehensive Sports Facility Operating System built by
              <strong className="text-gray-900"> Magizh NexGen Technologies</strong> to power the next generation of amateur sports in India.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pb-16 sm:pb-24 md:pb-32">
        {/* Company Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="rounded-2xl bg-gray-50 border border-gray-200 p-5 sm:p-8 md:p-14 mb-8"
        >
          <h2 className="font-black text-lg sm:text-xl md:text-2xl uppercase tracking-wide mb-4 sm:mb-6 flex items-center gap-3 text-gray-900">
            <span className="w-8 h-0.5 bg-brand-600" />
            Our Story
          </h2>
          <p className="text-gray-600 leading-relaxed mb-4 text-base">
            Magizh NexGen Technologies is a Chennai-based technology company focused on building scalable digital infrastructure for the sports and fitness industry in India. We believe every amateur athlete deserves access to quality sports facilities without friction.
          </p>
          <p className="text-gray-600 leading-relaxed text-base">
            Our flagship product, <strong className="text-brand-600">LOBBI</strong>, enables venue owners to digitize their operations, helps players discover and book turfs instantly, and creates a connected sports ecosystem with matchmaking, coaching, and analytics.
          </p>
        </motion.div>

        {/* Mission & Vision Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8 mt-8 sm:mt-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="rounded-2xl bg-gray-50 border border-gray-200 p-6 sm:p-8 md:p-10 hover:border-brand-600/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-brand-600/10 flex items-center justify-center mb-6 group-hover:bg-brand-600/20 transition-colors">
              <Target className="w-6 h-6 text-brand-600" />
            </div>
            <h3 className="font-black text-xl uppercase tracking-wide mb-3 text-gray-900">Our Mission</h3>
            <p className="text-gray-500 text-base leading-relaxed font-medium">
              To make booking a sports facility as easy as ordering food online — instant, transparent, and affordable for every Indian.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="rounded-2xl bg-gray-50 border border-gray-200 p-6 sm:p-8 md:p-10 hover:border-brand-600/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-brand-600/10 flex items-center justify-center mb-6 group-hover:bg-brand-600/20 transition-colors">
              <Heart className="w-6 h-6 text-brand-600" />
            </div>
            <h3 className="font-black text-xl uppercase tracking-wide mb-3 text-gray-900">Our Vision</h3>
            <p className="text-gray-500 text-base leading-relaxed font-medium">
              An India where every neighbourhood has a world-class sports facility, connected through smart technology and powered by data.
            </p>
          </motion.div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-5 mb-8 mt-8 sm:mt-12">
          {stats.map(({ icon: Icon, value, label }, idx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + idx * 0.1 }}
              className="rounded-2xl bg-gray-50 border border-gray-200 p-5 sm:p-8 text-center hover:border-brand-600/30 transition-all group"
            >
              <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-brand-600 mx-auto mb-2 sm:mb-3" />
              <div className="font-black text-3xl sm:text-4xl md:text-5xl text-gray-900 tracking-tighter mb-1 sm:mb-2 font-oswald">{value}</div>
              <div className="text-xs text-gray-400 font-black uppercase tracking-[0.2em]">{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="rounded-2xl bg-gray-50 border border-gray-200 p-5 sm:p-8 md:p-14 mt-8 sm:mt-12"
        >
          <h2 className="font-black text-lg sm:text-xl md:text-2xl flex items-center justify-between uppercase tracking-wide mb-6 sm:mb-10 text-gray-900">
            <div className="flex items-center gap-3">
              <span className="w-8 h-0.5 bg-brand-600" />
              What LOBBI Offers
            </div>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 md:gap-10">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 sm:gap-5">
                <div className="w-12 h-12 rounded-xl bg-brand-600/10 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-brand-600" />
                </div>
                <div>
                  <div className="text-base font-bold text-gray-900 uppercase tracking-wider mb-1.5">{title}</div>
                  <div className="text-base text-gray-500 leading-relaxed font-medium">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-8 sm:mt-12 text-center"
        >
          <Link
            to={user ? "/feed" : "/auth"}
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand-600 text-white font-black text-sm uppercase tracking-wider rounded-xl hover:bg-brand-700 transition-all hover:scale-105"
          >
            {user ? "Go to Dashboard" : "Join the Platform"}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
