import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-stone-50 text-stone-950">
      <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-amber-300/20 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 left-10 h-64 w-64 rounded-full bg-stone-900/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-amber-200/30 blur-[90px]" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-10 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:px-12">
        {children}
      </div>
    </main>
  );
}
