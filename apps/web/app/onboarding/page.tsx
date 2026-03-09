"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { organization } from "@synccorehub/auth/client";
import { Building2, ArrowRight, CheckCircle2 } from "lucide-react";

const STEPS = ["workspace", "industry", "done"] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("workspace");
  const [workspaceName, setWorkspaceName] = useState("");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const INDUSTRIES = [
    "Software & Technology",
    "Consulting",
    "Marketing & Creative",
    "Healthcare",
    "Finance & Accounting",
    "Legal",
    "Construction & Engineering",
    "Real Estate",
    "Other",
  ];

  async function createWorkspace() {
    if (!workspaceName.trim()) {
      setError("Workspace name is required.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const slug = workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50);

      await organization.create({
        name: workspaceName.trim(),
        slug,
        metadata: { industry },
      });

      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create workspace.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 px-4">
        <div className="max-w-md w-full text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Workspace ready!</h1>
          <p className="text-muted-foreground mb-8">
            Your workspace <strong>{workspaceName}</strong> has been created. Let&apos;s get started.
          </p>
          <button
            onClick={() => router.replace("/dashboard")}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
          >
            Go to dashboard <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Set up your workspace</h1>
          <p className="text-muted-foreground text-sm mt-1">
            You&apos;ll be set up in under a minute.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {["workspace", "industry"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s || (s === "workspace" && step === "industry")
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < 1 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          {step === "workspace" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-lg">Name your workspace</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  This is usually your company name.
                </p>
              </div>
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
              <input
                autoFocus
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setStep("industry")}
                placeholder="Acme Corp"
                className="w-full border border-input rounded-xl px-4 py-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={() => {
                  if (!workspaceName.trim()) { setError("Workspace name is required."); return; }
                  setError("");
                  setStep("industry");
                }}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {step === "industry" && (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-lg">What&apos;s your industry?</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Helps us tailor your ICP defaults.
                </p>
              </div>
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2">
                {INDUSTRIES.map((ind) => (
                  <label
                    key={ind}
                    className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition-colors ${industry === ind ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <input
                      type="radio"
                      name="industry"
                      value={ind}
                      checked={industry === ind}
                      onChange={() => setIndustry(ind)}
                      className="sr-only"
                    />
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${industry === ind ? "border-primary" : "border-muted-foreground"}`}>
                      {industry === ind && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <span className="text-sm">{ind}</span>
                  </label>
                ))}
              </div>
              <button
                onClick={createWorkspace}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {loading ? "Creating workspace…" : <>Create workspace <ArrowRight className="h-4 w-4" /></>}
              </button>
              <button
                onClick={() => setStep("workspace")}
                className="w-full text-sm text-muted-foreground hover:text-foreground py-1"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
