import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ApplicationForm } from "@/components/ApplicationForm";
import type { Gender } from "@/lib/supabase/types";

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
  if (!isGender(rawGender)) {
    notFound();
  }
  const gender = rawGender;

  const supabase = createServerSupabaseClient();

  // "이상형" 목록은 두 소스를 합친다:
  // 1) 반대 성별의 매력 어필 포인트 (자동 연결)
  // 2) 이상형 전용으로 직접 추가한 옵션 (ideal_type_options)
  const [appealPointsResult, oppositeAppealResult, idealTypeExtrasResult] =
    await Promise.all([
      supabase
        .from("appeal_point_options")
        .select("id, label")
        .in("gender_scope", ["all", gender])
        .order("display_order", { ascending: true }),
      supabase
        .from("appeal_point_options")
        .select("id, label")
        .in("gender_scope", ["all", oppositeGender(gender)])
        .order("display_order", { ascending: true }),
      supabase
        .from("ideal_type_options")
        .select("id, label")
        .in("gender_scope", ["all", gender])
        .order("display_order", { ascending: true }),
    ]);

  const appealPointOptions = appealPointsResult.data ?? [];
  const idealTypeOptions = [
    ...(oppositeAppealResult.data ?? []).map((option) => ({
      id: `appeal:${option.id}`,
      label: option.label,
    })),
    ...(idealTypeExtrasResult.data ?? []).map((option) => ({
      id: `ideal:${option.id}`,
      label: option.label,
    })),
  ];

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

      <ApplicationForm
        gender={gender}
        appealPointOptions={appealPointOptions}
        idealTypeOptions={idealTypeOptions}
      />
    </div>
  );
}
