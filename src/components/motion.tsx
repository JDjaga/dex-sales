import React, { useEffect, useRef, useState } from 'react';
import { motion, type Variants } from 'motion/react';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

export const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className }) => (
  <motion.div
    className={className}
    variants={fadeUp}
    initial="hidden"
    animate="show"
    transition={{ delay }}
  >
    {children}
  </motion.div>
);

export const StaggerContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <motion.div
    className={className}
    variants={staggerParent}
    initial="hidden"
    animate="show"
  >
    {children}
  </motion.div>
);

export const StaggerItem: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div variants={fadeUp}>{children}</motion.div>
);

/** Animated number that counts up/down whenever `value` changes. */
export const CountUp: React.FC<{
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}> = ({ value, format = (n) => Math.round(n).toLocaleString(), duration = 900, className }) => {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
};
