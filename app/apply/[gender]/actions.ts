"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createApplicationFormSchema,
  type ApplicationFormFieldErrors,
} from "@/lib/validation";
import type { Gender } from "@/lib/supabase/types";
import { isRecruiting } from "@/lib/recruitment";
import type { ApplicationFormState } from "./form-state";

function parseAnswers(formData: FormData, prefix: string, questionIds: string[]) {
  return questionIds.flatMap((questionId) =>
    formData
      .getAll(`${prefix}_${questionId}`)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .map((optionId) => ({ questionId, optionId }))
  );
}

export async function submitApplication(
  gender: Gender,
  _prevState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  if (!isRecruiting(gender)) {
    return { status: "error", formError: "현재 해당 성별의 신청은 마감되었어요." };
  }

  const supabase = createServerSupabaseClient();

  const { data: questionRows, error: questionsError } = await supabase
    .from("survey_questions")
    .select("id")
    .eq("is_active", true);

  if (questionsError) {
    console.error("survey_questions 조회 실패:", questionsError);
    return {
      status: "error",
      formError: "신청 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
    };
  }

  const questionIds = (questionRows ?? []).map((row) => row.id);

  const parsed = createApplicationFormSchema(questionIds).safeParse({
    gender,
    name: formData.get("name"),
    age: formData.get("age"),
    major: formData.get("major"),
    phone: formData.get("phone"),
    maxMatchCount: formData.get("maxMatchCount"),
    selfAnswers: parseAnswers(formData, "self", questionIds),
    idealAnswers: parseAnswers(formData, "ideal", questionIds),
    mustMatchQuestionIds: formData.getAll("mustMatchQuestionIds"),
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

  const { error } = await supabase.rpc("create_participant_application", {
    p_gender: values.gender,
    p_name: values.name,
    p_age: values.age,
    p_major: values.major,
    p_phone: values.phone,
    p_max_match_count: values.maxMatchCount,
    p_self_option_ids: values.selfAnswers.map((a) => a.optionId),
    p_ideal_option_ids: values.idealAnswers.map((a) => a.optionId),
    p_must_match_question_ids: values.mustMatchQuestionIds,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        fieldErrors: { phone: "이미 신청이 완료된 전화번호예요" },
      };
    }
    console.error("create_participant_application RPC failed:", error);
    return {
      status: "error",
      formError: "신청 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
    };
  }

  return { status: "success" };
}
