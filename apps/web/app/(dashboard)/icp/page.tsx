"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Target, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useForm, useFieldArray, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { icpCriterionSchema } from "@synccorehub/types";

const CUSTOMER_FIELDS = [
  { value: "industry", label: "Industry" },
  { value: "company_size", label: "Company Size" },
  { value: "annual_revenue", label: "Annual Revenue" },
  { value: "country", label: "Country" },
  { value: "job_title", label: "Job Title" },
];

const OPERATORS = [
  { value: "eq", label: "equals" },
  { value: "in", label: "is one of" },
  { value: "contains", label: "contains" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
];

const criteriaFormSchema = z.object({ criteria: z.array(icpCriterionSchema) });
type CriteriaForm = z.infer<typeof criteriaFormSchema>;

export default function IcpPage() {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const { data: profiles, refetch: refetchProfiles } = trpc.icp.listProfiles.useQuery();
  const { data: profileData } = trpc.icp.profileWithCriteria.useQuery(
    { profileId: selectedProfileId! },
    { enabled: !!selectedProfileId }
  );

  const createProfile = trpc.icp.createProfile.useMutation({
    onSuccess: (p) => { setSelectedProfileId(p.id); refetchProfiles(); toast.success("Profile created"); },
  });
  const saveCriteria = trpc.icp.saveCriteria.useMutation({
    onSuccess: () => toast.success("Criteria saved! Rescoring will run in the background."),
  });

  const { register, control, handleSubmit } = useForm<CriteriaForm>({
    resolver: zodResolver(criteriaFormSchema),
    defaultValues: { criteria: profileData?.criteria?.map((c) => ({ ...c, isActive: c.isActive ?? undefined })) as CriteriaForm["criteria"] ?? [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "criteria" });

  const onSave: SubmitHandler<CriteriaForm> = (data) => {
    if (!selectedProfileId) return;
    saveCriteria.mutate({ profileId: selectedProfileId, criteria: data.criteria });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ICP Builder</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Define your Ideal Customer Profile. Customers are scored 0–100 against these criteria.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Profile list */}
        <div className="bg-card border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Profiles</h2>
            <button
              onClick={() => createProfile.mutate({ name: "New ICP Profile" })}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {profiles?.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProfileId(p.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${selectedProfileId === p.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              <Target className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{p.name}</span>
              {p.isDefault && <CheckCircle className="h-3.5 w-3.5 ml-auto shrink-0" />}
            </button>
          ))}
          {!profiles?.length && (
            <p className="text-muted-foreground text-xs text-center py-4">No profiles yet</p>
          )}
        </div>

        {/* Criteria editor */}
        <div className="lg:col-span-3">
          {!selectedProfileId ? (
            <div className="bg-card border rounded-xl p-12 text-center">
              <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">Select or create an ICP profile</p>
              <p className="text-muted-foreground text-sm mt-1">Define the characteristics of your ideal customers</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSave)} className="space-y-4">
              <div className="bg-card border rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold">{profileData?.name ?? "Loading…"}</h2>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => append({ field: "industry", fieldLabel: "Industry", operator: "eq", value: "", weight: 20, pointsIfMatch: 20, isActive: true, sortOrder: fields.length })}
                      className="flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add criterion
                    </button>
                    <button
                      type="submit"
                      disabled={saveCriteria.isPending}
                      className="bg-primary text-primary-foreground text-xs px-4 py-1.5 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60"
                    >
                      {saveCriteria.isPending ? "Saving…" : "Save & rescore"}
                    </button>
                  </div>
                </div>

                {/* Info banner */}
                <div className="bg-indigo-50 text-indigo-800 text-xs rounded-lg p-3 mb-4">
                  Customers are scored by summing <strong>points earned</strong> across all criteria. Target threshold: <strong>{profileData?.matchThreshold ?? 70} points</strong> = ICP match.
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-center bg-muted/30 border rounded-lg p-3">
                      <div className="col-span-3">
                        <select {...register(`criteria.${index}.field`)} className="w-full text-xs border rounded px-2 py-1.5 bg-background">
                          {CUSTOMER_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <select {...register(`criteria.${index}.operator`)} className="w-full text-xs border rounded px-2 py-1.5 bg-background">
                          {OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input {...register(`criteria.${index}.value`)} placeholder="Value" className="w-full text-xs border rounded px-2 py-1.5 bg-background" />
                      </div>
                      <div className="col-span-2 flex items-center gap-1">
                        <input {...register(`criteria.${index}.weight`, { valueAsNumber: true })} type="number" placeholder="Weight" min={0} max={100} className="w-14 text-xs border rounded px-2 py-1.5 bg-background" />
                        <span className="text-xs text-muted-foreground">pts</span>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button type="button" onClick={() => remove(index)} className="p-1.5 hover:bg-red-50 text-red-500 rounded transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {fields.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No criteria yet. Click "Add criterion" to start defining your ICP.
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
