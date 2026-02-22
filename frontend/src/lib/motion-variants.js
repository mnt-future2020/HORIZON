/**
 * Framer Motion Variant Library
 * Athletic energy animations with consistent easing
 * Ease-out-expo curve: cubic-bezier(0.22, 1, 0.36, 1)
 */

// ============================================
// ENTRY ANIMATIONS
// ============================================

export const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
};

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
};

export const slideInRight = {
  initial: { opacity: 0, x: 60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
};

export const slideInLeft = {
  initial: { opacity: 0, x: -60 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 30 },
  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
};

export const slideInBottom = {
  initial: { opacity: 0, y: 60 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -30 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
};

// ============================================
// STAGGER ANIMATIONS
// ============================================

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
};

// Fast stagger for large lists
export const fastStaggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05
    }
  }
};

// ============================================
// HOVER/INTERACTION ANIMATIONS
// ============================================

export const hoverLift = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -8,
    scale: 1.02,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
  },
  tap: { scale: 0.98 }
};

export const hoverGlow = {
  rest: { boxShadow: '0 0 0 rgba(59, 130, 246, 0)' },
  hover: {
    boxShadow: '0 0 40px rgba(59, 130, 246, 0.4)',
    transition: { duration: 0.3 }
  }
};

// Athletic card hover - pronounced lift with glow
export const cardHover = {
  rest: {
    y: 0,
    scale: 1,
    boxShadow: '0 4px 24px -4px rgba(0, 0, 0, 0.4)'
  },
  hover: {
    y: -12,
    scale: 1.03,
    boxShadow: '0 20px 60px -10px rgba(59, 130, 246, 0.3)',
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
  },
  tap: { scale: 0.98 }
};

// Subtle card hover for smaller cards
export const subtleCardHover = {
  rest: {
    y: 0,
    scale: 1
  },
  hover: {
    y: -6,
    scale: 1.01,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }
  },
  tap: { scale: 0.99 }
};

// Button press animation
export const buttonTap = {
  rest: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: { duration: 0.2 }
  },
  tap: { scale: 0.98 }
};

// ============================================
// LOADING ANIMATIONS
// ============================================

export const pulseGlow = {
  animate: {
    boxShadow: [
      '0 0 20px rgba(59, 130, 246, 0.3)',
      '0 0 40px rgba(59, 130, 246, 0.6)',
      '0 0 20px rgba(59, 130, 246, 0.3)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

export const pulseScale = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

export const spinLoader = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear'
    }
  }
};

// ============================================
// SCROLL-TRIGGERED ANIMATIONS
// ============================================

export const scrollFadeIn = {
  offscreen: { opacity: 0, y: 50 },
  onscreen: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

export const scrollScale = {
  offscreen: { opacity: 0, scale: 0.8 },
  onscreen: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

// ============================================
// PAGE TRANSITIONS
// ============================================

export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1]
    }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.3 }
  }
};

// ============================================
// MODAL/DIALOG ANIMATIONS
// ============================================

export const modalOverlay = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 }
  }
};

export const modalContent = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1]
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 }
  }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a stagger container with custom timing
 * @param {number} staggerDelay - Delay between each child (seconds)
 * @param {number} initialDelay - Initial delay before first child (seconds)
 */
export const createStaggerContainer = (staggerDelay = 0.08, initialDelay = 0.1) => ({
  animate: {
    transition: {
      staggerChildren: staggerDelay,
      delayChildren: initialDelay
    }
  }
});

/**
 * Create a custom fade-in animation with configurable distance
 * @param {number} distance - Distance to travel in pixels
 * @param {number} duration - Animation duration in seconds
 */
export const createFadeInUp = (distance = 40, duration = 0.5) => ({
  initial: { opacity: 0, y: distance },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -distance / 2 },
  transition: { duration, ease: [0.22, 1, 0.36, 1] }
});

/**
 * Create a custom hover lift animation
 * @param {number} liftDistance - How far to lift on hover (pixels)
 * @param {number} scale - Scale factor on hover
 */
export const createHoverLift = (liftDistance = 12, scale = 1.03) => ({
  rest: { y: 0, scale: 1 },
  hover: {
    y: -liftDistance,
    scale,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
  },
  tap: { scale: 0.98 }
});
