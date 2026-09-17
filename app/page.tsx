import { GenderPicker } from "@/components/GenderPicker";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 pt-10 pb-6 text-center">
        <p className="font-display text-2xl text-brand-600 sm:text-3xl">
          💘 랜덤소개팅에 오신 걸 환영해요 💘
        </p>
        <p className="mt-2 text-sm text-brand-400 sm:text-base">
          설레는 만남을 시작하기 전에, 성별을 먼저 선택해주세요
        </p>
      </header>

      <div className="px-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-start gap-2 rounded-2xl border-2 border-pastel-yellow bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-700 sm:text-base">
          <span aria-hidden>⚠️</span>
          <p>성비 불균형 시 1명당 최대 2명까지 매칭될 수 있습니다.</p>
        </div>
      </div>

      <main className="mt-6 flex flex-1 flex-col">
        <GenderPicker />
      </main>
    </div>
  );
}
