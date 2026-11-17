import { motion } from "framer-motion";
import { BrandLogo } from "./brand/BrandLogo";

/** Full-screen application loading state built around the official stacked logo. */
export function LoadingScreen({ message = "Preparing your workspace" }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-paper px-6" role="status" aria-live="polite">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <BrandLogo layout="stacked" size={88} tagline />
      </motion.div>
      <div className="mt-2 h-0.5 w-40 overflow-hidden rounded-full bg-brand-line">
        <motion.div
          className="h-full w-1/3 rounded-full bg-brand-emerald"
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <p className="mt-4 text-sm text-brand-muted">{message}…</p>
    </div>
  );
}
