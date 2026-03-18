import { Variants } from "framer-motion";

export const fadeInSlideUp: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.2, ease: "easeOut" } },
};

export const fadeInSlideLeft: Variants = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, x: -10, transition: { duration: 0.2, ease: "easeOut" } },
};

export const whileHoverScale = {
  whileHover: { scale: 1.02, transition: { duration: 0.2 } },
};

export const pulsingOpacity: Variants = {
  animate: { opacity: [0.3, 0.6, 0.3], transition: { duration: 2, repeat: Infinity } },
};

export const progressBarAnimation = (duration: number) => ({
  initial: { width: "100%" },
  animate: { width: "0%", transition: { duration: duration / 1000, ease: "linear" } },
});

export const expandCollapseHeight: Variants = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: 'auto', transition: { duration: 0.3, ease: "easeOut" } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

export const emergencyButtonAnimation: Variants = {
  initial: { scale: 0, rotate: -45 },
  animate: { scale: 1, rotate: 0, transition: { duration: 0.3, ease: "backOut" } },
  whileHover: { scale: 1.1, transition: { duration: 0.2 } },
  whileTap: { scale: 0.9, transition: { duration: 0.2 } },
};
