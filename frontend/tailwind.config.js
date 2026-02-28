/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        display: ['Chivo', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        brier: ['Brier', 'sans-serif'],
        mona: ['Mona Sans', 'sans-serif'],
        oswald: ['Oswald', 'sans-serif'],
        roboto: ['Roboto', 'sans-serif'],
        serif: ['Libre Baskerville', 'Georgia', 'serif'],
      },
      // Athletic typography scale - bold and impactful
      fontSize: {
        'display-xl': ['5rem', { lineHeight: '0.95', letterSpacing: '-0.03em', fontWeight: '900' }],
        'display-lg': ['3.5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '900' }],
        'display-md': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.015em', fontWeight: '900' }],
        'display-sm': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '800' }],
        'heading-lg': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }],
        'heading-md': ['1.25rem', { lineHeight: '1.4', letterSpacing: '0', fontWeight: '700' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '500' }],
        'label-caps': ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.1em', fontWeight: '700' }],
      },
      letterSpacing: {
        'tighter': '-0.03em',
        'athletic': '-0.015em',
        'wide': '0.05em',
        'ultra-wide': '0.15em',
      },
      // Generous spacing system (2-3x standard)
      spacing: {
        '18': '4.5rem',    // 72px
        '22': '5.5rem',    // 88px
        '26': '6.5rem',    // 104px
        '30': '7.5rem',    // 120px
        '34': '8.5rem',    // 136px
        '38': '9.5rem',    // 152px
      },
      gap: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      padding: {
        'section': '5rem',      // Standard section padding
        'section-lg': '8rem',   // Large section padding
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: { '1': 'hsl(var(--chart-1))', '2': 'hsl(var(--chart-2))', '3': 'hsl(var(--chart-3))', '4': 'hsl(var(--chart-4))', '5': 'hsl(var(--chart-5))' },
        // Global brand green — to change the whole app color, update these values
        brand: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
          DEFAULT: '#059669',
        },
        turf: {
          dark: '#0a0c0a',
          light: '#ffffff',
          accent: '#059669',
          'text-dark': '#1a1f1a',
          'text-light': '#f8fafc',
        }
      },
      // Electric Blue gradient utilities
      backgroundImage: {
        'gradient-athletic': 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)',
        'gradient-accent': 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
        'gradient-sport': 'linear-gradient(135deg, #F59E0B 0%, #fbbf24 100%)',
        'gradient-rose': 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
        'gradient-sky': 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
        'gradient-overlay': 'linear-gradient(180deg, rgba(2, 6, 23, 0.3) 0%, rgba(2, 6, 23, 0.92) 100%)',
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
        'gradient-mesh': 'radial-gradient(at 40% 20%, #3b82f6 0px, transparent 50%), radial-gradient(at 80% 0%, #10b981 0px, transparent 50%), radial-gradient(at 0% 80%, #8b5cf6 0px, transparent 50%)',
      },
      // Electric Blue glow shadows
      boxShadow: {
        'glow-primary': '0 0 50px rgba(59, 130, 246, 0.45)',
        'glow-accent': '0 0 50px rgba(16, 185, 129, 0.4)',
        'glow-hover': '0 0 70px rgba(59, 130, 246, 0.65)',
        'glow-rose': '0 0 40px rgba(244, 63, 94, 0.35)',
        'glow-sky': '0 0 40px rgba(139, 92, 246, 0.35)',
        'glow-sm': '0 0 20px rgba(59, 130, 246, 0.3)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      // Athletic animation keyframes
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'athletic-slide-up': {
          from: { opacity: '0', transform: 'translateY(40px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'energy-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.05)', opacity: '0.9' }
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(59, 130, 246, 0.6)' }
        },
        'slide-in-scale': {
          from: { opacity: '0', transform: 'translateX(-20px) scale(0.95)' },
          to: { opacity: '1', transform: 'translateX(0) scale(1)' }
        },
        'count-up': {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' }
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'athletic-slide-up': 'athletic-slide-up 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        'energy-pulse': 'energy-pulse 2s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-in-scale': 'slide-in-scale 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        'count-up': 'count-up 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        'shimmer': 'shimmer 3s linear infinite',
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};