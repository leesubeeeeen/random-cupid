import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ApplicationForm } from "@/components/ApplicationForm";
import type { Gender } from "@/lib/supabase/types";
import { isRecruiting } from "@/lib/recruitment";

const GENDER_LABEL: Record<Gender, string> = {
  female: "여성",
  male: "남성",
};

function isGender(value: string): value is Gender {
  return value === "male" || value === "female";
}

function oppositeGender(gender: Gender): Gender {
  return gender === "male" ? "female" : "male";
}

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ gender: string }>;
}) {
  const { gender: rawGender } = await params;
  if (!isGender(rawGender) || !isRecruiting(rawGender)) {
    notFound();
  }
  const gender = rawGender;

  const supabase = createServerSupabaseClient();

  const [{ data: questionRows }, { data: optionRows }] = await Promise.all([
    supabase
      .from("survey_questions")
      .select("id, key, category, self_label, ideal_label, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
    supabase
      .from("survey_options")
      .select("id, question_id, label, gender_scope, display_order")
      .order("display_order", { ascending: true }),
  ]);

  const opposite = oppositeGender(gender);

  const questions = (questionRows ?? []).map((question) => {
    const questionOptions = (optionRows ?? []).filter(
      (option) => option.question_id === question.id
    );
    return {
      id: question.id,
      key: question.key,
      category: question.category,
      selfLabel: question.self_label,
      idealLabel: question.ideal_label,
      // 본인소개 페이지는 본인 성별 기준, 이상형 페이지는 반대 성별 기준으로 선택지를 보여준다
      // (예: 키 질문 — gender_scope가 'all'인 질문은 두 페이지에 동일하게 노출됨)
      selfOptions: questionOptions
        .filter((option) => option.gender_scope === "all" || option.gender_scope === gender)
        .map((option) => ({ id: option.id, label: option.label })),
      idealOptions: questionOptions
        .filter((option) => option.gender_scope === "all" || option.gender_scope === opposite)
        .map((option) => ({ id: option.id, label: option.label })),
    };
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-10 sm:px-6">
      <header className="mb-6 text-center">
        <p className="font-display text-2xl text-brand-600 sm:text-3xl">
          {GENDER_LABEL[gender]}으로 참여하기 💕
        </p>
        <p className="mt-2 text-sm text-brand-400">
          아래 정보를 입력하고 설레는 만남을 신청해보세요
        </p>
      </header>

      <ApplicationForm gender={gender} questions={questions} />
    </div>
  );
}
