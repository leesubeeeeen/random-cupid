"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { Gender, SurveyCategory } from "@/lib/supabase/types";
import { submitApplication } from "@/app/apply/[gender]/actions";
import {
  initialApplicationFormState,
  type ApplicationFormState,
} from "@/app/apply/[gender]/form-state";
import { MUST_MATCH_LIMIT } from "@/lib/validation";
import { TextInput } from "./ui/TextInput";
import { RadioPillGroup } from "./ui/RadioPillGroup";
import { IdealTypeQuestionCard } from "./IdealTypeQuestionCard";
import { SubmitSuccess } from "./SubmitSuccess";

interface Option {
  id: string;
  label: string;
}

interface Question {
  id: string;
  key: string;
  category: SurveyCategory;
  selfLabel: string;
  idealLabel: string;
  selfOptions: Option[];
  idealOptions: Option[];
}

interface ApplicationFormProps {
  gender: Gender;
  questions: Question[];
}

const CATEGORY_LABEL: Record<SurveyCategory, string> = {
  appearance: "외형",
  personality: "성격 · 매력",
};

const STEP1_ERROR_FIELDS = new Set([
  "name",
  "age",
  "major",
  "phone",
  "maxMatchCount",
  "selfAnswers",
]);

export function ApplicationForm({ gender, questions }: ApplicationFormProps) {
  const boundAction = submitApplication.bind(null, gender);
  const [state, formAction, isPending] = useActionState<
    ApplicationFormState,
    FormData
  >(boundAction, initialApplicationFormState);

  const [step, setStep] = useState<1 | 2>(1);
  const [mustMatchIds, setMustMatchIds] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);

  // 서버 액션 결과(state)가 바뀔 때만 에러가 발생한 단계로 이동한다.
  // (렌더링 중 상태 갱신 — effect 대신 이전 값과 비교하는 React 권장 패턴)
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === "error" && state.fieldErrors) {
      const hasStep1Error = Object.keys(state.fieldErrors).some((key) =>
        STEP1_ERROR_FIELDS.has(key)
      );
      setStep(hasStep1Error ? 1 : 2);
    }
  }

  if (state.status === "success") {
    return <SubmitSuccess />;
  }

  const appearanceQuestions = questions.filter((q) => q.category === "appearance");
  const personalityQuestions = questions.filter((q) => q.category === "personality");

  function toggleMustMatch(questionId: string) {
    setMustMatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        if (next.size >= MUST_MATCH_LIMIT) return prev;
        next.add(questionId);
      }
      return next;
    });
  }

  function handleNext() {
    if (formRef.current && !formRef.current.reportValidity()) return;
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePrev() {
    setStep(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <motion.form
      ref={formRef}
      action={formAction}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.06 } },
      }}
      className="flex flex-col gap-6 rounded-3xl border-2 border-brand-100 bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8"
    >
      <StepIndicator step={step} />

      {state.formError && (
        <div className="rounded-2xl bg-coral-300/20 px-4 py-3 text-sm font-medium text-coral-600">
          {state.formError}
        </div>
      )}

      <div hidden={step !== 1} className="flex flex-col gap-6">
        <FormRow>
          <TextInput
            id="name"
            name="name"
            label="이름"
            placeholder="홍길동"
            autoComplete="name"
            required
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
            required
            error={state.fieldErrors?.age}
          />
        </FormRow>

        <FormRow>
          <TextInput
            id="major"
            name="major"
            label="전공(학과)"
            placeholder="컴퓨터융합학부"
            required
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
            required
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

        {state.fieldErrors?.selfAnswers && (
          <p className="text-sm font-medium text-coral-600" role="alert">
            {state.fieldErrors.selfAnswers}
          </p>
        )}

        <QuestionSection
          title={CATEGORY_LABEL.appearance}
          questions={appearanceQuestions}
          prefix="self"
          getLabel={(q) => q.selfLabel}
        />
        <QuestionSection
          title={CATEGORY_LABEL.personality}
          questions={personalityQuestions}
          prefix="self"
          getLabel={(q) => q.selfLabel}
        />

        <motion.button
          type="button"
          onClick={handleNext}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          className="mt-2 rounded-full bg-brand-500 px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-brand-600"
        >
          다음 단계로 →
        </motion.button>
      </div>

      <div hidden={step !== 2} className="flex flex-col gap-6">
        <div className="rounded-2xl bg-brand-50 px-4 py-3 text-xs font-medium leading-relaxed text-brand-600">
          ⭐ 표시는 매칭 시 최우선으로 반영돼요 (최대 {MUST_MATCH_LIMIT}개). 단, 조건에 맞는
          상대가 없을 경우 다른 분과 매칭될 수도 있어요.
          <br />
          현재 필수 조건 선택: {mustMatchIds.size}/{MUST_MATCH_LIMIT}
        </div>

        {state.fieldErrors?.idealAnswers && (
          <p className="text-sm font-medium text-coral-600" role="alert">
            {state.fieldErrors.idealAnswers}
          </p>
        )}
        {state.fieldErrors?.mustMatchQuestionIds && (
          <p className="text-sm font-medium text-coral-600" role="alert">
            {state.fieldErrors.mustMatchQuestionIds}
          </p>
        )}

        <IdealQuestionSection
          title={CATEGORY_LABEL.appearance}
          questions={appearanceQuestions}
          mustMatchIds={mustMatchIds}
          onMustMatchToggle={toggleMustMatch}
        />
        <IdealQuestionSection
          title={CATEGORY_LABEL.personality}
          questions={personalityQuestions}
          mustMatchIds={mustMatchIds}
          onMustMatchToggle={toggleMustMatch}
        />

        <div className="flex gap-3">
          <motion.button
            type="button"
            onClick={handlePrev}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-full border-2 border-brand-200 bg-white px-6 py-4 text-base font-bold text-brand-600 transition hover:bg-brand-50"
          >
            ← 이전
          </motion.button>
          <motion.button
            type="submit"
            disabled={isPending}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="flex-1 rounded-full bg-brand-500 px-6 py-4 text-base font-bold text-white shadow-md transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "신청 중..." : "신청하기 💌"}
          </motion.button>
        </div>
      </div>
    </motion.form>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center justify-center gap-2 text-xs font-bold text-brand-400">
      <StepDot active={step === 1} label="1. 본인 소개" />
      <span className="text-brand-200">—</span>
      <StepDot active={step === 2} label="2. 이상형 선택" />
    </div>
  );
}

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={
        active
          ? "rounded-full bg-brand-500 px-3 py-1 text-white"
          : "rounded-full bg-brand-100 px-3 py-1 text-brand-400"
      }
    >
      {label}
    </span>
  );
}

function QuestionSection({
  title,
  questions,
  prefix,
  getLabel,
}: {
  title: string;
  questions: Question[];
  prefix: "self";
  getLabel: (question: Question) => string;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-brand-300">{title}</h3>
      {questions.map((question) => (
        <FormRow key={question.id}>
          <RadioPillGroup
            legend={getLabel(question)}
            name={`${prefix}_${question.id}`}
            options={question.selfOptions.map((option) => ({
              value: option.id,
              label: option.label,
            }))}
          />
        </FormRow>
      ))}
    </div>
  );
}

function IdealQuestionSection({
  title,
  questions,
  mustMatchIds,
  onMustMatchToggle,
}: {
  title: string;
  questions: Question[];
  mustMatchIds: Set<string>;
  onMustMatchToggle: (questionId: string) => void;
}) {
  if (questions.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-brand-300">{title}</h3>
      {questions.map((question) => (
        <FormRow key={question.id}>
          <IdealTypeQuestionCard
            questionId={question.id}
            legend={question.idealLabel}
            options={question.idealOptions}
            mustMatchChecked={mustMatchIds.has(question.id)}
            mustMatchDisabled={
              !mustMatchIds.has(question.id) && mustMatchIds.size >= MUST_MATCH_LIMIT
            }
            onMustMatchToggle={onMustMatchToggle}
          />
        </FormRow>
      ))}
    </div>
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
