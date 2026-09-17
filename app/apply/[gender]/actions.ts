"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  applicationFormSchema,
  type ApplicationFormFieldErrors,
} from "@/lib/validation";
import type { Gender } from "@/lib/supabase/types";

export interface ApplicationFormState {
  status: "idle" | "error" | "success";
  fieldErrors?: ApplicationFormFieldErrors;
  formError?: string;
}

export const initialApplicationFormState: ApplicationFormState = {
  status: "idle",
};

export async function submitApplication(
  gender: Gender,
  _prevState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const parsed = applicationFormSchema.safeParse({
    gender,
    name: formData.get("name"),
    age: formData.get("age"),
    major: formData.get("major"),
    phone: formData.get("phone"),
    maxMatchCount: formData.get("maxMatchCount"),
    appealPointIds: formData.getAll("appealPointIds"),
    idealTypeIds: formData.getAll("idealTypeIds"),
  });

  if (!parsed.success) {
    const fieldErrors: ApplicationFormFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof ApplicationFormFieldErrors | undefined;
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { status: "error", fieldErrors };
  }

  const values = parsed.data;
  const supabase = createServerSupabaseClient();

  const { error } = await supabase.rpc("create_participant_application", {
    p_gender: values.gender,
    p_name: values.name,
    p_age: values.age,
    p_major: values.major,
    p_phone: values.phone,
    p_max_match_count: values.maxMatchCount,
    p_appeal_point_ids: values.appealPointIds,
    p_ideal_type_ids: values.idealTypeIds,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        fieldErrors: { phone: "이미 신청이 완료된 전화번호예요" },
      };
    }
    return {
      status: "error",
      formError: "신청 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
    };
  }

  return { status: "success" };
}
