import { z } from "zod";

export const PHONE_REGEX = /^01[016789][0-9]{7,8}$/;

export const MUST_MATCH_LIMIT = 2;

export const genderSchema = z.enum(["male", "female"]);

const answerSchema = z.object({
  questionId: z.string().uuid(),
  optionId: z.string().uuid(),
});

// questionIds는 제출 시점에 DB에서 다시 조회한 "현재 활성화된 설문 질문" 목록이다.
// 클라이언트가 보낸 답변이 이 목록과 정확히 대응하는지 여기서 검증한다.
export function createApplicationFormSchema(questionIds: string[]) {
  const questionIdSet = new Set(questionIds);

  return z
    .object({
      gender: genderSchema,
      name: z
        .string()
        .trim()
        .min(1, "이름을 입력해주세요")
        .max(20, "이름이 너무 길어요"),
      age: z.coerce
        .number({ error: "나이를 입력해주세요" })
        .int("나이는 숫자로 입력해주세요")
        .min(18, "18세 이상만 신청할 수 있어요")
        .max(100, "나이를 다시 확인해주세요"),
      major: z
        .string()
        .trim()
        .min(1, "전공(학과)을 입력해주세요")
        .max(50, "전공명이 너무 길어요"),
      phone: z
        .string()
        .transform((value) => value.replace(/\D/g, ""))
        .refine((value) => PHONE_REGEX.test(value), "올바른 휴대폰 번호 형식이 아니에요"),
      maxMatchCount: z.coerce
        .number()
        .refine((value) => value === 1 || value === 2, "매칭 희망 인원을 선택해주세요"),
      selfAnswers: z.array(answerSchema),
      idealAnswers: z.array(answerSchema),
      mustMatchQuestionIds: z
        .array(z.string().uuid())
        .max(MUST_MATCH_LIMIT, `필수 조건은 최대 ${MUST_MATCH_LIMIT}개까지 선택할 수 있어요`),
    })
    .superRefine((values, ctx) => {
      const selfAnsweredIds = new Set(values.selfAnswers.map((a) => a.questionId));
      const missingSelf = [...questionIdSet].some((id) => !selfAnsweredIds.has(id));
      if (missingSelf || values.selfAnswers.length !== questionIds.length) {
        ctx.addIssue({
          code: "custom",
          path: ["selfAnswers"],
          message: "모든 질문에 본인 답변을 선택해주세요",
        });
      }

      const idealAnsweredIds = new Set(values.idealAnswers.map((a) => a.questionId));
      const missingIdeal = [...questionIdSet].some((id) => !idealAnsweredIds.has(id));
      if (missingIdeal) {
        ctx.addIssue({
          code: "custom",
          path: ["idealAnswers"],
          message: "모든 질문에 원하는 이상형을 1개 이상 선택해주세요",
        });
      }

      const invalidMustMatch = values.mustMatchQuestionIds.some(
        (id) => !idealAnsweredIds.has(id)
      );
      if (invalidMustMatch) {
        ctx.addIssue({
          code: "custom",
          path: ["mustMatchQuestionIds"],
          message: "이상형을 선택한 질문만 필수 조건으로 지정할 수 있어요",
        });
      }
    });
}

export type ApplicationFormSchema = ReturnType<typeof createApplicationFormSchema>;
export type ApplicationFormValues = z.infer<ApplicationFormSchema>;

export type ApplicationFormFieldErrors = Partial<
  Record<keyof ApplicationFormValues, string>
>;
