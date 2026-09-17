"use client";

import { motion } from "framer-motion";

export function AlreadyApplied() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-4 rounded-3xl border-2 border-brand-100 bg-white px-8 py-14 text-center shadow-sm"
    >
      <span className="text-5xl">🙈</span>
      <h2 className="font-display text-2xl text-brand-600 sm:text-3xl">
        이미 신청을 완료했어요
      </h2>
      <p className="max-w-sm text-sm text-brand-400 sm:text-base">
        이 기기에서 이미 신청 내역이 확인됐어요. 정보를 잘못 입력하셨다면
        행사 운영진에게 문의해주세요.
      </p>
    </motion.div>
  );
}
