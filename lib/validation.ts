import { z } from "zod";

export const PHONE_REGEX = /^01[016789][0-9]{7,8}$/;

export const genderSchema = z.enum(["male", "female"]);

export const applicationFormSchema = z.object({
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
  appealPointIds: z
    .array(z.string().uuid())
    .min(1, "나의 매력 어필 포인트를 1개 이상 선택해주세요"),
  idealTypeIds: z
    .array(z.string().uuid())
    .min(1, "선호하는 이상형을 1개 이상 선택해주세요"),
});

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

export type ApplicationFormFieldErrors = Partial<
  Record<keyof ApplicationFormValues, string>
>;
