import React from 'react';
import {
  MotionConfig,
  motion,
  AnimatePresence,
  type HTMLMotionProps,
} from 'motion/react';

/**
 * T17 motion system (motion/motion-spec.md). One provider sets the
 * reduced-motion policy; every primitive below uses kit token values so
 * durations/easings never live in page code.
 */

export const MOTION_TOKENS = {
  duration: { instant: 0.08, fast: 0.14, normal: 0.22, slow: 0.32 },
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    enter: [0, 0, 0.2, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
  },
  spring: { soft: { stiffness: 280, damping: 28, mass: 0.9 }, press: { stiffness: 500, damping: 32, mass: 0.6 } },
} as const;

/** Honors prefers-reduced-motion app-wide (motion/reduced-motion.md). */
export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
);

/** Standard route transition: fade + 8px rise; shell stays stable. */
export const PageTransition: React.FC<HTMLMotionProps<'div'>> = ({ children, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ duration: MOTION_TOKENS.duration.normal, ease: MOTION_TOKENS.easing.enter }}
    {...props}
  >
    {children}
  </motion.div>
);

/** Auth/onboarding/step state change: horizontal presence transition. */
export const Slide: React.FC<HTMLMotionProps<'div'> & { direction?: 1 | -1; distance?: number }> = ({
  children,
  direction = 1,
  distance = 12,
  ...props
}) => (
  <motion.div
    initial={{ opacity: 0, x: distance * direction }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -distance * direction }}
    transition={{ duration: MOTION_TOKENS.duration.normal, ease: MOTION_TOKENS.easing.enter }}
    {...props}
  >
    {children}
  </motion.div>
);

export const Fade: React.FC<HTMLMotionProps<'div'>> = ({ children, ...props }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: MOTION_TOKENS.duration.fast }}
    {...props}
  >
    {children}
  </motion.div>
);

/** Press feedback: scale never below 0.98 (motion/micro-interactions.md). */
export const ScalePress: React.FC<HTMLMotionProps<'div'>> = ({ children, ...props }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    transition={{ type: 'spring', ...MOTION_TOKENS.spring.press }}
    {...props}
  >
    {children}
  </motion.div>
);

/** Modal panel entrance: backdrop fade + 0.98→1 scale (motion/page-transitions.md). */
export const AnimatedDialog: React.FC<HTMLMotionProps<'div'>> = ({ children, ...props }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.98, y: 6 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.98, y: 6 }}
    transition={{ duration: MOTION_TOKENS.duration.normal, ease: MOTION_TOKENS.easing.enter }}
    {...props}
  >
    {children}
  </motion.div>
);

/** Bottom sheet: spring slide from the nearest safe edge. */
export const AnimatedSheet: React.FC<HTMLMotionProps<'div'>> = ({ children, ...props }) => (
  <motion.div
    initial={{ y: '100%' }}
    animate={{ y: 0 }}
    exit={{ y: '100%' }}
    transition={{ type: 'spring', ...MOTION_TOKENS.spring.soft }}
    style={{ willChange: 'transform' }}
    {...props}
  >
    {children}
  </motion.div>
);

/**
 * Navigation/tab selection indicator. Animate the shared indicator, not the
 * label position (motion/micro-interactions.md); reduced motion makes the
 * change instant via MotionConfig.
 */
export const SharedIndicator: React.FC<{ active: boolean; className?: string }> = ({
  active,
  className,
}) => (
  <AnimatePresence initial={false}>
    {active && (
      <motion.span
        layoutId="t17-shared-indicator"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: MOTION_TOKENS.duration.fast }}
        className={className}
      />
    )}
  </AnimatePresence>
);

export { motion, AnimatePresence };
