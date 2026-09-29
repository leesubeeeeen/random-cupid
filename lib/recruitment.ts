import type { Gender } from "@/lib/supabase/types";

// 현재 신청을 받고 있는 성별. 남성 신청은 마감되어 제외됨
export const OPEN_GENDERS: readonly Gender[] = ["female"];

export function isRecruiting(gender: Gender): boolean {
  return OPEN_GENDERS.includes(gender);
}
