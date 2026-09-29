"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { isRecruiting } from "@/lib/recruitment";

const sides: {
  gender: "female" | "male";
  href: string;
  title: string;
  emoji: string;
  gradient: string;
}[] = [
  {
    gender: "female",
    href: "/apply/female",
    title: "여성으로 참여하기",
    emoji: "💃",
    gradient: "from-brand-300 via-brand-400 to-brand-500",
  },
  {
    gender: "male",
    href: "/apply/male",
    title: "남성으로 참여하기",
    emoji: "🕺",
    gradient: "from-coral-300 via-coral-400 to-coral-500",
  },
];

export function GenderPicker() {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      {sides.filter((side) => isRecruiting(side.gender)).map((side, index) => (
        <Link
          key={side.gender}
          href={side.href}
          className="group relative flex flex-1 items-center justify-center overflow-hidden"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.15 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className={`flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br ${side.gradient} px-6 py-16 text-white transition-all`}
          >
            <span className="animate-float-heart text-6xl drop-shadow-sm">
              {side.emoji}
            </span>
            <h2 className="font-display text-3xl tracking-wide drop-shadow-sm sm:text-4xl">
              {side.title}
            </h2>
            <span className="rounded-full bg-white/25 px-5 py-2 text-sm font-bold backdrop-blur-sm transition group-hover:bg-white/35">
              탭해서 신청하기 →
            </span>
          </motion.div>
        </Link>
      ))}
    </div>
  );
}
