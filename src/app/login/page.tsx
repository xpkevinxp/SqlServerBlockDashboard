import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10">
      <Suspense fallback={<div className="text-sm text-zinc-400">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}