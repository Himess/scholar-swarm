"use client";

import { motion } from "framer-motion";
import { STAGES } from "@/lib/demo-data";

export default function Timeline() {
  return (
    <div className="relative">
      <div className="grid grid-cols-5 items-center relative">
        {/* connecting line absolutely positioned through node centers */}
        <div
          className="tl-line absolute top-1/2 -translate-y-1/2"
          style={{ left: "10%", right: "10%", zIndex: 0 }}
        />
        {STAGES.map((s, i) => (
          <motion.div
            key={s.key}
            className="flex flex-col items-center relative z-10"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.08, type: "spring", stiffness: 220, damping: 18 }}
          >
            <div className="tl-node">
              <div className="tl-node-inner" />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-5 mt-5 text-center">
        {STAGES.map((s) => (
          <div key={s.key}>
            <div className="font-semibold text-[18px]">{s.label}</div>
            <div className="font-mono text-[14px] text-fg-dim mt-1">{s.t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
