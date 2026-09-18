"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const REDIRECT_DELAY_MS = 3000;

export function SubmitSuccess() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/");
    }, REDIRECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className="flex flex-col items-center gap-4 rounded-3xl border-2 border-brand-100 bg-white px-8 py-14 text-center shadow-sm"
    >
      <motion.span
        className="text-6xl"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 0.6 }}
      >
        💖
      </motion.span>
      <h2 className="font-display text-2xl text-brand-600 sm:text-3xl">
        신청이 완료됐어요!
      </h2>
      <p className="max-w-sm text-sm text-brand-400 sm:text-base">
        소중한 정보 감사해요. 매칭 결과는 행사 운영진을 통해 안내드릴 예정이에요.
        설레는 만남을 기대해주세요 💌
      </p>
      <p className="text-xs text-brand-300">잠시 후 처음 화면으로 이동해요</p>
    </motion.div>
  );
}
