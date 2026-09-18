"use client";

import { useActionState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { Gender } from "@/lib/supabase/types";
import { submitApplication } from "@/app/apply/[gender]/actions";
import {
  initialApplicationFormState,
  type ApplicationFormState,
} from "@/app/apply/[gender]/form-state";
import { TextInput } from "./ui/TextInput";
import { RadioPillGroup } from "./ui/RadioPillGroup";
import { CheckboxOptionGroup } from "./CheckboxOptionGroup";
import { SubmitSuccess } from "./SubmitSuccess";

interface Option {
  id: string;
  label: string;
}

interface ApplicationFormProps {
  gender: Gender;
  appealPointOptions: Option[];
  idealTypeOptions: Option[];
}

export function ApplicationForm({
  gender,
  appealPointOptions,
  idealTypeOptions,
}: ApplicationFormProps) {
  const boundAction = submitApplication.bind(null, gender);
  const [state, formAction, isPending] = useActionState<
    ApplicationFormState,
    FormData
  >(boundAction, initialApplicationFormState);

  if (state.status === "success") {
    return <SubmitSuccess />;
  }

  return (
    <motion.form
      action={formAction}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
      className="flex flex-col gap-6 rounded-3xl border-2 border-brand-100 bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8"
    >
      {state.formError && (
        <div className="rounded-2xl bg-coral-300/20 px-4 py-3 text-sm font-medium text-coral-600">
          {state.formError}
        </div>
      )}

      <FormRow>
        <TextInput
          id="name"
          name="name"
          label="이름"
          placeholder="홍길동"
          autoComplete="name"
          error={state.fieldErrors?.name}
        />
      </FormRow>

      <FormRow>
        <TextInput
          id="age"
          name="age"
          label="나이"
          hint="한국식 나이 기준으로 입력해주세요"
          type="number"
          inputMode="numeric"
          placeholder="25"
          error={state.fieldErrors?.age}
        />
      </FormRow>

      <FormRow>
        <TextInput
          id="major"
          name="major"
          label="전공(학과)"
          placeholder="컴퓨터융합학부"
          error={state.fieldErrors?.major}
        />
      </FormRow>

      <FormRow>
        <TextInput
          id="phone"
          name="phone"
          label="전화번호"
          hint="숫자만 입력하거나 010-1234-5678 형식으로 입력해주세요"
          type="tel"
          inputMode="tel"
          placeholder="010-1234-5678"
          autoComplete="tel"
          error={state.fieldErrors?.phone}
        />
      </FormRow>

      <FormRow>
        <RadioPillGroup
          legend="매칭 희망 인원"
          name="maxMatchCount"
          options={[
            { value: "1", label: "1명만 원해요" },
            { value: "2", label: "2명도 괜찮아요" },
          ]}
          error={state.fieldErrors?.maxMatchCount}
        />
      </FormRow>

      <FormRow>
        <CheckboxOptionGroup
          legend="나의 매력 어필 포인트"
          hint="해당하는 항목을 모두 선택해주세요"
          name="appealPointIds"
          options={appealPointOptions}
          error={state.fieldErrors?.appealPointIds}
        />
      </FormRow>

      <FormRow>
        <CheckboxOptionGroup
          legend="선호하는 이상형"
          hint="해당하는 항목을 모두 선택해주세요"
          name="idealTypeIds"
          options={idealTypeOptions}
          error={state.fieldErrors?.idealTypeIds}
        />
      </FormRow>

      <motion.button
        type="submit"
        disabled={isPending}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className="mt-2 rounded-full bg-brand-500 px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "신청 중..." : "신청하기 💌"}
      </motion.button>
    </motion.form>
  );
}

function FormRow({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0 },
      }}
    >
      {children}
    </motion.div>
  );
}
