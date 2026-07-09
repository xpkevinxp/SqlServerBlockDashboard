"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const configError = searchParams.get("error") === "config";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "No se pudo iniciar sesion");
        return;
      }

      const redirectTo = searchParams.get("from") || "/";
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Error de conexion con el servidor");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-zinc-800 bg-zinc-950/90">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-950 text-sky-400">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl">Acceso al dashboard</CardTitle>
        <CardDescription>
          Ingresa la contrasena para ver el monitor de bloqueos SQL Server
        </CardDescription>
      </CardHeader>
      <CardContent>
        {configError ? (
          <div className="mb-4 rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
            Configura DASHBOARD_PASSWORD en el archivo .env del servidor.
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm text-zinc-300">
              Contrasena
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Contrasena de acceso"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error ? (
            <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Verificando..." : "Entrar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}