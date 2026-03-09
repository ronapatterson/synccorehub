"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@synccorehub/auth/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

type RegisterInput = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterInput) {
    setLoading(true);
    try {
      await signUp.email({ name: data.name, email: data.email, password: data.password, callbackURL: "/onboarding" });
      toast.success("Account created! Please check your email to verify.");
      router.push("/onboarding");
    } catch (err) {
      toast.error("Registration failed. Email may already be in use.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Create your account</h1>
      <p className="text-slate-400 text-sm mb-8">14-day free trial, no credit card required</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {[
          { name: "name" as const, label: "Full name", type: "text", placeholder: "Jane Smith" },
          { name: "email" as const, label: "Work email", type: "email", placeholder: "jane@company.com" },
          { name: "password" as const, label: "Password", type: "password", placeholder: "Min 8 characters" },
          { name: "confirmPassword" as const, label: "Confirm password", type: "password", placeholder: "••••••••" },
        ].map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{field.label}</label>
            <input
              {...register(field.name)}
              type={field.type}
              placeholder={field.placeholder}
              className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors[field.name] && <p className="text-red-400 text-xs mt-1">{errors[field.name]?.message}</p>}
          </div>
        ))}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-slate-400 text-sm mt-6">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign in</Link>
      </p>
    </div>
  );
}
