import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <div className="app-canvas relative grid min-h-dvh place-items-center overflow-hidden px-4 py-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -5%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 65%), radial-gradient(ellipse 40% 30% at 90% 90%, color-mix(in oklab, var(--primary) 8%, transparent), transparent 70%)",
        }}
      />
      <Suspense>
        <LoginForm />
      </Suspense>
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
    </div>
  );
}
