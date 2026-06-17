import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GraduationCap,
  Key,
  CheckCircle,
  AlertCircle,
  Trash2,
  RefreshCw,
  Plus,
  X,
  ExternalLink,
  Copy,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import {
  api,
  cn,
  type TrainingExample,
  type TrainingJob,
  type TrainingHyperparameters,
} from "../lib/utils";

type SourceTab = "conversations" | "examples" | "jsonl";

const IN_PROGRESS = new Set(["preparing", "validating_files", "queued", "running"]);

function statusStyle(status: string): { label: string; className: string } {
  switch (status) {
    case "succeeded":
      return { label: "Succeeded", className: "bg-green-500/15 text-green-600 dark:text-green-400" };
    case "failed":
      return { label: "Failed", className: "bg-red-500/15 text-red-600 dark:text-red-400" };
    case "cancelled":
      return { label: "Cancelled", className: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]" };
    case "running":
      return { label: "Training…", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" };
    case "queued":
      return { label: "Queued", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    case "validating_files":
      return { label: "Validating", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    default:
      return { label: "Preparing", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  }
}

export default function TrainingPage() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const { data: baseModelsData } = useQuery({
    queryKey: ["training-base-models"],
    queryFn: api.getTrainingBaseModels,
  });
  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: api.listConversations,
  });
  const { data: jobs } = useQuery({
    queryKey: ["training-jobs"],
    queryFn: api.listTrainingJobs,
    refetchInterval: (query) => {
      const data = query.state.data as TrainingJob[] | undefined;
      return data?.some((j) => IN_PROGRESS.has(j.status)) ? 8000 : false;
    },
  });

  const baseModels = baseModelsData?.baseModels ?? [];
  const minExamples = baseModelsData?.minExamples ?? 10;

  // ── Form state ──
  const [name, setName] = useState("");
  const [baseModel, setBaseModel] = useState("");
  const [tab, setTab] = useState<SourceTab>("conversations");
  const [selectedConvos, setSelectedConvos] = useState<Set<number>>(new Set());
  const [sharedSystem, setSharedSystem] = useState("");
  const [pairs, setPairs] = useState<TrainingExample[]>([
    { prompt: "", completion: "" },
    { prompt: "", completion: "" },
  ]);
  const [jsonl, setJsonl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual tuning controls (blank = let the provider pick a sensible default).
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hpEpochs, setHpEpochs] = useState("");
  const [hpBatchSize, setHpBatchSize] = useState("");
  const [hpLearningRate, setHpLearningRate] = useState("");
  const [hpLrMultiplier, setHpLrMultiplier] = useState("");
  const [hpLoraR, setHpLoraR] = useState("");
  const [hpLoraAlpha, setHpLoraAlpha] = useState("");
  const [hpTrainingSteps, setHpTrainingSteps] = useState("");

  const effectiveBaseModel = baseModel || baseModels[0]?.id || "";
  const selectedProvider =
    baseModels.find((m) => m.id === effectiveBaseModel)?.provider ?? "openai";
  const hasKeyForProvider =
    selectedProvider === "together"
      ? settings?.together?.hasKey ?? false
      : selectedProvider === "mistral"
        ? settings?.mistral?.hasKey ?? false
        : settings?.openai?.hasKey ?? false;

  const buildHyperparameters = (): TrainingHyperparameters | undefined => {
    // Treat blank or non-positive as "use the provider default" — server bounds
    // require positive values, so this avoids needless 400s.
    const num = (s: string) => {
      const v = parseFloat(s);
      return Number.isFinite(v) && v > 0 ? v : undefined;
    };
    const hp: TrainingHyperparameters = {};
    const epochs = num(hpEpochs);
    if (epochs != null) hp.nEpochs = Math.round(epochs);
    const batch = num(hpBatchSize);
    if (batch != null) hp.batchSize = Math.round(batch);
    if (selectedProvider === "together") {
      const lr = num(hpLearningRate);
      if (lr != null) hp.learningRate = lr;
      const r = num(hpLoraR);
      if (r != null) hp.loraR = Math.round(r);
      const alpha = num(hpLoraAlpha);
      if (alpha != null) hp.loraAlpha = Math.round(alpha);
    } else if (selectedProvider === "mistral") {
      const lr = num(hpLearningRate);
      if (lr != null) hp.learningRate = lr;
      const steps = num(hpTrainingSteps);
      if (steps != null) hp.trainingSteps = Math.round(steps);
    } else {
      const mult = num(hpLrMultiplier);
      if (mult != null) hp.learningRateMultiplier = mult;
    }
    return Object.keys(hp).length > 0 ? hp : undefined;
  };

  const exampleCount = useMemo(() => {
    if (tab === "conversations") return selectedConvos.size;
    if (tab === "jsonl") return jsonl.split("\n").map((l) => l.trim()).filter(Boolean).length;
    return pairs.filter((p) => p.prompt.trim() && p.completion.trim()).length;
  }, [tab, selectedConvos, jsonl, pairs]);

  const createMutation = useMutation({
    mutationFn: () => {
      const hyperparameters = buildHyperparameters();
      if (tab === "conversations") {
        return api.createTrainingJob({
          name: name.trim(),
          baseModel: effectiveBaseModel,
          source: "conversations",
          conversationIds: [...selectedConvos],
          hyperparameters,
        });
      }
      if (tab === "jsonl") {
        return api.createTrainingJob({
          name: name.trim(),
          baseModel: effectiveBaseModel,
          source: "jsonl",
          jsonl,
          hyperparameters,
        });
      }
      return api.createTrainingJob({
        name: name.trim(),
        baseModel: effectiveBaseModel,
        source: "examples",
        examples: pairs
          .filter((p) => p.prompt.trim() && p.completion.trim())
          .map((p) => ({ ...p, system: sharedSystem.trim() || undefined })),
        hyperparameters,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });
      setName("");
      setSelectedConvos(new Set());
      setPairs([{ prompt: "", completion: "" }, { prompt: "", completion: "" }]);
      setSharedSystem("");
      setJsonl("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const keyMutation = useMutation({
    mutationFn: (key: string) => api.setOpenAIKey(key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const togetherKeyMutation = useMutation({
    mutationFn: (key: string) => api.setTogetherKey(key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const mistralKeyMutation = useMutation({
    mutationFn: (key: string) => api.setMistralKey(key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const refreshMutation = useMutation({
    mutationFn: (id: number) => api.refreshTrainingJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTrainingJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["models"] });
    },
  });

  const canSubmit =
    hasKeyForProvider &&
    name.trim().length > 0 &&
    effectiveBaseModel.length > 0 &&
    exampleCount >= minExamples &&
    !createMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[hsl(var(--border))]">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[hsl(var(--primary))]" />
          <h1 className="text-xl font-semibold">Fine-tune a Custom Model</h1>
        </div>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Train your own model — GPT on OpenAI, open models like Llama &amp; Qwen on Together AI, or
          Mistral's own models on Mistral AI — from your conversations or example Q&amp;A pairs.
          Finished models appear in the model picker when you start a chat.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
        {/* Provider keys */}
        <ProviderKeyCard
          title="OpenAI API Key"
          description={
            <>
              Fine-tunes GPT models on OpenAI's servers and bills your account. Get a key at{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-0.5"
              >
                platform.openai.com <ExternalLink className="w-3 h-3" />
              </a>
            </>
          }
          placeholder="sk-…"
          missingHint="No OpenAI key configured — add one to fine-tune GPT models."
          status={settings?.openai}
          onSave={(key) => keyMutation.mutate(key)}
          saving={keyMutation.isPending}
        />
        <ProviderKeyCard
          title="Together AI API Key"
          description={
            <>
              Fine-tunes open models like Llama &amp; Qwen on Together AI and bills your account. Get a
              key at{" "}
              <a
                href="https://api.together.xyz/settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-0.5"
              >
                api.together.xyz <ExternalLink className="w-3 h-3" />
              </a>
            </>
          }
          placeholder="Together API key…"
          missingHint="No Together key configured — add one to fine-tune Llama/Qwen."
          status={settings?.together}
          onSave={(key) => togetherKeyMutation.mutate(key)}
          saving={togetherKeyMutation.isPending}
        />
        <ProviderKeyCard
          title="Mistral AI API Key"
          description={
            <>
              Fine-tunes Mistral's own open models (Mistral 7B, Small, Codestral) and bills your
              account. Get a key at{" "}
              <a
                href="https://console.mistral.ai/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-0.5"
              >
                console.mistral.ai <ExternalLink className="w-3 h-3" />
              </a>
            </>
          }
          placeholder="Mistral API key…"
          missingHint="No Mistral key configured — add one to fine-tune Mistral models."
          status={settings?.mistral}
          onSave={(key) => mistralKeyMutation.mutate(key)}
          saving={mistralKeyMutation.isPending}
        />

        {/* Create job */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))] space-y-5">
          <h2 className="font-medium">New training job</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                Model name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My Coding Tutor"
                className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
                Base model
              </label>
              <select
                value={effectiveBaseModel}
                onChange={(e) => setBaseModel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              >
                {(["openai", "together", "mistral"] as const).map((prov) => {
                  const group = baseModels.filter((m) => m.provider === prov);
                  if (group.length === 0) return null;
                  const groupLabel =
                    prov === "openai"
                      ? "OpenAI (GPT)"
                      : prov === "together"
                        ? "Together AI (open models)"
                        : "Mistral AI (open models)";
                  return (
                    <optgroup key={prov} label={groupLabel}>
                      {group.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.note}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Source tabs */}
          <div>
            <div className="flex gap-1 p-1 bg-[hsl(var(--muted))]/50 rounded-lg w-fit mb-4">
              {(
                [
                  ["conversations", "From Conversations"],
                  ["examples", "Q&A Pairs"],
                  ["jsonl", "JSONL"],
                ] as [SourceTab, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    tab === value
                      ? "bg-[hsl(var(--background))] shadow-sm font-medium"
                      : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "conversations" && (
              <ConversationPicker
                conversations={conversations ?? []}
                selected={selectedConvos}
                onChange={setSelectedConvos}
              />
            )}

            {tab === "examples" && (
              <QAEditor
                sharedSystem={sharedSystem}
                onSharedSystem={setSharedSystem}
                pairs={pairs}
                onChange={setPairs}
              />
            )}

            {tab === "jsonl" && (
              <JsonlEditor
                value={jsonl}
                onChange={setJsonl}
                fileInputRef={fileInputRef}
              />
            )}
          </div>

          {/* Advanced / manual tuning settings */}
          <div className="border-t border-[hsl(var(--border))] pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))] hover:opacity-80"
            >
              <SlidersHorizontal className="w-4 h-4 text-[hsl(var(--primary))]" />
              Advanced tuning settings
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform text-[hsl(var(--muted-foreground))]",
                  advancedOpen && "rotate-180"
                )}
              />
            </button>

            {advancedOpen && (
              <div className="mt-3 space-y-4">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Leave any field blank to let{" "}
                  {selectedProvider === "together"
                    ? "Together AI"
                    : selectedProvider === "mistral"
                      ? "Mistral AI"
                      : "OpenAI"}{" "}
                  choose a sensible default. These control how the model learns from your examples.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedProvider === "mistral" ? (
                    <>
                      <HyperField
                        label="Training steps"
                        hint="Number of gradient update steps, e.g. 100. More can improve quality but costs more."
                        placeholder="auto"
                        value={hpTrainingSteps}
                        onChange={setHpTrainingSteps}
                      />
                      <HyperField
                        label="Learning rate"
                        hint="Step size, e.g. 0.0001. Smaller is more stable, larger learns faster."
                        placeholder="auto"
                        value={hpLearningRate}
                        onChange={setHpLearningRate}
                      />
                    </>
                  ) : (
                    <>
                      <HyperField
                        label="Epochs"
                        hint="How many passes over your data. More can improve quality but risks overfitting."
                        placeholder="auto"
                        value={hpEpochs}
                        onChange={setHpEpochs}
                      />
                      <HyperField
                        label="Batch size"
                        hint="Examples processed together per step."
                        placeholder="auto"
                        value={hpBatchSize}
                        onChange={setHpBatchSize}
                      />
                      {selectedProvider === "together" ? (
                        <>
                          <HyperField
                            label="Learning rate"
                            hint="Step size, e.g. 0.00001. Smaller is more stable, larger learns faster."
                            placeholder="auto"
                            value={hpLearningRate}
                            onChange={setHpLearningRate}
                          />
                          <HyperField
                            label="LoRA rank (r)"
                            hint="Capacity of the LoRA adapter, e.g. 8 or 16. Higher fits more, costs more."
                            placeholder="auto"
                            value={hpLoraR}
                            onChange={setHpLoraR}
                          />
                          <HyperField
                            label="LoRA alpha"
                            hint="Scales the adapter's influence, often 2× the rank."
                            placeholder="auto"
                            value={hpLoraAlpha}
                            onChange={setHpLoraAlpha}
                          />
                        </>
                      ) : (
                        <HyperField
                          label="Learning rate multiplier"
                          hint="Scales OpenAI's default learning rate, e.g. 0.1 to 10."
                          placeholder="auto"
                          value={hpLrMultiplier}
                          onChange={setHpLrMultiplier}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <p
              className={cn(
                "text-xs",
                exampleCount >= minExamples
                  ? "text-[hsl(var(--muted-foreground))]"
                  : "text-amber-600 dark:text-amber-400"
              )}
            >
              {exampleCount} example{exampleCount === 1 ? "" : "s"} · minimum {minExamples} required
            </p>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity inline-flex items-center gap-2"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {createMutation.isPending ? "Starting…" : "Start fine-tuning"}
            </button>
          </div>

          {createMutation.isError && (
            <div className="flex items-start gap-2 text-sm text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{(createMutation.error as Error).message}</span>
            </div>
          )}
        </div>

        {/* Jobs list */}
        <div className="space-y-3">
          <h2 className="font-medium">Your training jobs</h2>
          {!jobs || jobs.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No training jobs yet. Create one above to get started.
            </p>
          ) : (
            jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onRefresh={() => refreshMutation.mutate(job.id)}
                refreshing={refreshMutation.isPending && refreshMutation.variables === job.id}
                onDelete={() => deleteMutation.mutate(job.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function HyperField({
  label,
  hint,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
      />
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{hint}</p>
    </div>
  );
}

function ProviderKeyCard({
  title,
  description,
  placeholder,
  missingHint,
  status,
  onSave,
  saving,
}: {
  title: string;
  description: React.ReactNode;
  placeholder: string;
  missingHint: string;
  status?: { hasKey: boolean; keyPreview: string | null; source: string };
  onSave: (key: string) => void;
  saving: boolean;
}) {
  const [key, setKey] = useState("");
  return (
    <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
      <div className="flex items-center gap-2 mb-1">
        <Key className="w-4 h-4 text-[hsl(var(--primary))]" />
        <h2 className="font-medium">{title}</h2>
      </div>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">{description}</p>

      {status?.hasKey ? (
        <div className="flex items-center gap-2 text-sm mb-4">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>
            Key active:{" "}
            <code className="font-mono bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-xs">
              {status.keyPreview}
            </code>
            {status.source === "env" && (
              <span className="ml-2 text-[hsl(var(--muted-foreground))] text-xs">(from environment)</span>
            )}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))] mb-4">
          <AlertCircle className="w-4 h-4" />
          {missingHint}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] font-mono"
        />
        <button
          onClick={() => {
            if (key.trim()) {
              onSave(key.trim());
              setKey("");
            }
          }}
          disabled={saving || !key.trim()}
          className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving…" : status?.hasKey ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}

function ConversationPicker({
  conversations,
  selected,
  onChange,
}: {
  conversations: { id: number; title: string }[];
  selected: Set<number>;
  onChange: (s: Set<number>) => void;
}) {
  if (conversations.length === 0) {
    return (
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        You have no conversations yet. Chat a bit first, then come back to train on them.
      </p>
    );
  }

  const allSelected = selected.size === conversations.length;
  const toggle = (id: number) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  };

  return (
    <div className="border border-[hsl(var(--border))] rounded-lg divide-y divide-[hsl(var(--border))] max-h-72 overflow-y-auto">
      <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium cursor-pointer hover:bg-[hsl(var(--accent))]/40">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => onChange(allSelected ? new Set() : new Set(conversations.map((c) => c.id)))}
          className="accent-[hsl(var(--primary))]"
        />
        Select all ({conversations.length})
      </label>
      {conversations.map((c) => (
        <label
          key={c.id}
          className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-[hsl(var(--accent))]/40"
        >
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={() => toggle(c.id)}
            className="accent-[hsl(var(--primary))]"
          />
          <span className="truncate">{c.title}</span>
        </label>
      ))}
    </div>
  );
}

function QAEditor({
  sharedSystem,
  onSharedSystem,
  pairs,
  onChange,
}: {
  sharedSystem: string;
  onSharedSystem: (v: string) => void;
  pairs: TrainingExample[];
  onChange: (p: TrainingExample[]) => void;
}) {
  const update = (i: number, field: "prompt" | "completion", value: string) => {
    const next = pairs.map((p, idx) => (idx === i ? { ...p, [field]: value } : p));
    onChange(next);
  };
  const remove = (i: number) => onChange(pairs.filter((_, idx) => idx !== i));
  const add = () => onChange([...pairs, { prompt: "", completion: "" }]);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5">
          Shared instruction (optional) — applied to every example
        </label>
        <textarea
          value={sharedSystem}
          onChange={(e) => onSharedSystem(e.target.value)}
          rows={2}
          placeholder="e.g. You are a patient coding tutor who explains the why behind each answer."
          className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-y"
        />
      </div>

      {pairs.map((p, i) => (
        <div key={i} className="border border-[hsl(var(--border))] rounded-lg p-3 space-y-2 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Example {i + 1}
            </span>
            {pairs.length > 1 && (
              <button
                onClick={() => remove(i)}
                className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                title="Remove example"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <textarea
            value={p.prompt}
            onChange={(e) => update(i, "prompt", e.target.value)}
            rows={2}
            placeholder="User asks…"
            className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-y"
          />
          <textarea
            value={p.completion}
            onChange={(e) => update(i, "completion", e.target.value)}
            rows={3}
            placeholder="Ideal assistant answer…"
            className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-y"
          />
        </div>
      ))}

      <button
        onClick={add}
        className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--primary))] hover:underline"
      >
        <Plus className="w-4 h-4" /> Add example
      </button>
    </div>
  );
}

function JsonlEditor({
  value,
  onChange,
  fileInputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onChange(await file.text());
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        One JSON object per line in OpenAI's chat format, e.g.{" "}
        <code className="font-mono bg-[hsl(var(--muted))] px-1 rounded text-[11px]">
          {'{"messages":[{"role":"user","content":"Hi"},{"role":"assistant","content":"Hello!"}]}'}
        </code>
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder='{"messages":[{"role":"system","content":"..."},{"role":"user","content":"..."},{"role":"assistant","content":"..."}]}'
        className="w-full px-3 py-2 text-xs font-mono border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-y"
      />
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jsonl,.txt,application/jsonl,text/plain"
          onChange={onFile}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-sm text-[hsl(var(--primary))] hover:underline"
        >
          Upload a .jsonl file
        </button>
      </div>
    </div>
  );
}

function JobCard({
  job,
  onRefresh,
  refreshing,
  onDelete,
}: {
  job: TrainingJob;
  onRefresh: () => void;
  refreshing: boolean;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const style = statusStyle(job.status);
  const inProgress = IN_PROGRESS.has(job.status);

  const copyModel = () => {
    if (!job.fineTunedModel) return;
    navigator.clipboard.writeText(job.fineTunedModel);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-[hsl(var(--border))] rounded-xl p-4 bg-[hsl(var(--card))]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{job.name}</p>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", style.className)}>
              {inProgress && <Loader2 className="w-2.5 h-2.5 animate-spin inline mr-1 -mt-0.5" />}
              {style.label}
            </span>
          </div>
          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
            {job.baseModel} · {job.exampleCount} examples · from{" "}
            {job.source === "conversations" ? "conversations" : job.source === "jsonl" ? "JSONL" : "Q&A pairs"}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh status"
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </button>
          <button
            onClick={onDelete}
            title="Delete job"
            className="p-1.5 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))]"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {job.fineTunedModel && (
        <button
          onClick={copyModel}
          className="mt-3 w-full flex items-center justify-between gap-2 text-left bg-[hsl(var(--muted))]/50 rounded-lg px-3 py-2 hover:bg-[hsl(var(--muted))] transition-colors group"
          title="Copy model ID"
        >
          <span className="font-mono text-xs truncate text-[hsl(var(--foreground))]">
            {job.fineTunedModel}
          </span>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))] inline-flex items-center gap-1 shrink-0">
            {copied ? "Copied!" : <><Copy className="w-3 h-3" /> ready in chat</>}
          </span>
        </button>
      )}

      {job.error && (
        <p className="mt-3 text-xs text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 rounded-lg p-2.5">
          {job.error}
        </p>
      )}
    </div>
  );
}
