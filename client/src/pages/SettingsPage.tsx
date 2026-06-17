import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, CheckCircle, AlertCircle, Trash2, ExternalLink, Server, Monitor, Globe } from "lucide-react";
import { api } from "../lib/utils";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiSaved, setOpenaiSaved] = useState(false);
  const [tavilyKey, setTavilyKey] = useState("");
  const [tavilySaved, setTavilySaved] = useState(false);
  const [togetherKey, setTogetherKey] = useState("");
  const [togetherSaved, setTogetherSaved] = useState(false);
  const [mistralKey, setMistralKey] = useState("");
  const [mistralSaved, setMistralSaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: api.getStats,
  });

  const updateMutation = useMutation({
    mutationFn: (key: string) => api.updateSettings(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSettings,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const openaiMutation = useMutation({
    mutationFn: (key: string) => api.setOpenAIKey(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setOpenaiKey("");
      setOpenaiSaved(true);
      setTimeout(() => setOpenaiSaved(false), 3000);
    },
  });

  const deleteOpenaiMutation = useMutation({
    mutationFn: api.deleteOpenAIKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const tavilyMutation = useMutation({
    mutationFn: (key: string) => api.setTavilyKey(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setTavilyKey("");
      setTavilySaved(true);
      setTimeout(() => setTavilySaved(false), 3000);
    },
  });

  const deleteTavilyMutation = useMutation({
    mutationFn: api.deleteTavilyKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const togetherMutation = useMutation({
    mutationFn: (key: string) => api.setTogetherKey(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setTogetherKey("");
      setTogetherSaved(true);
      setTimeout(() => setTogetherSaved(false), 3000);
    },
  });

  const deleteTogetherMutation = useMutation({
    mutationFn: api.deleteTogetherKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  const mistralMutation = useMutation({
    mutationFn: (key: string) => api.setMistralKey(key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setMistralKey("");
      setMistralSaved(true);
      setTimeout(() => setMistralSaved(false), 3000);
    },
  });

  const deleteMistralMutation = useMutation({
    mutationFn: api.deleteMistralKey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[hsl(var(--border))]">
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
        {/* API Key */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h2 className="font-medium">OpenRouter API Key</h2>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Required to call AI models. Get a free key at{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-0.5">
              openrouter.ai/keys <ExternalLink className="w-3 h-3" />
            </a>
          </p>

          {!isLoading && (
            <div className="mb-4">
              {settings?.hasKey ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>
                    Key active: <code className="font-mono bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-xs">{settings.keyPreview}</code>
                    {settings.source === "env" && (
                      <span className="ml-2 text-[hsl(var(--muted-foreground))] text-xs">(from environment)</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <AlertCircle className="w-4 h-4" />
                  No API key configured.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-…"
              className="flex-1 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] font-mono"
            />
            <button
              onClick={() => { if (apiKey.trim()) updateMutation.mutate(apiKey.trim()); }}
              disabled={updateMutation.isPending || !apiKey.trim()}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saved ? "Saved ✓" : updateMutation.isPending ? "Saving…" : "Save"}
            </button>
            {settings?.hasKey && settings.source === "user" && (
              <button
                onClick={() => deleteMutation.mutate()}
                className="px-3 py-2 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/30 text-sm rounded-lg hover:bg-[hsl(var(--destructive))]/10 transition-colors"
                title="Remove key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* OpenAI API Key */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h2 className="font-medium">OpenAI API Key</h2>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Used to fine-tune and run your own custom models. Get a key at{" "}
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-0.5">
              platform.openai.com <ExternalLink className="w-3 h-3" />
            </a>
          </p>

          {!isLoading && (
            <div className="mb-4">
              {settings?.openai?.hasKey ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>
                    Key active: <code className="font-mono bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-xs">{settings.openai.keyPreview}</code>
                    {settings.openai.source === "env" && (
                      <span className="ml-2 text-[hsl(var(--muted-foreground))] text-xs">(from environment)</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <AlertCircle className="w-4 h-4" />
                  No OpenAI key configured.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-…"
              className="flex-1 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] font-mono"
            />
            <button
              onClick={() => { if (openaiKey.trim()) openaiMutation.mutate(openaiKey.trim()); }}
              disabled={openaiMutation.isPending || !openaiKey.trim()}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {openaiSaved ? "Saved ✓" : openaiMutation.isPending ? "Saving…" : "Save"}
            </button>
            {settings?.openai?.hasKey && settings.openai.source === "user" && (
              <button
                onClick={() => deleteOpenaiMutation.mutate()}
                className="px-3 py-2 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/30 text-sm rounded-lg hover:bg-[hsl(var(--destructive))]/10 transition-colors"
                title="Remove key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tavily (Web Search) API Key */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h2 className="font-medium">Web Search API Key</h2>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Lets the AI search the live web. Turn on "Web Search" for a conversation to use it. Get a free key at{" "}
            <a href="https://app.tavily.com/home" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-0.5">
              tavily.com <ExternalLink className="w-3 h-3" />
            </a>
          </p>

          {!isLoading && (
            <div className="mb-4">
              {settings?.tavily?.hasKey ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>
                    Key active: <code className="font-mono bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-xs">{settings.tavily.keyPreview}</code>
                    {settings.tavily.source === "env" && (
                      <span className="ml-2 text-[hsl(var(--muted-foreground))] text-xs">(from environment)</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <AlertCircle className="w-4 h-4" />
                  No search key configured.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="password"
              value={tavilyKey}
              onChange={(e) => setTavilyKey(e.target.value)}
              placeholder="tvly-…"
              className="flex-1 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] font-mono"
            />
            <button
              onClick={() => { if (tavilyKey.trim()) tavilyMutation.mutate(tavilyKey.trim()); }}
              disabled={tavilyMutation.isPending || !tavilyKey.trim()}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {tavilySaved ? "Saved ✓" : tavilyMutation.isPending ? "Saving…" : "Save"}
            </button>
            {settings?.tavily?.hasKey && settings.tavily.source === "user" && (
              <button
                onClick={() => deleteTavilyMutation.mutate()}
                className="px-3 py-2 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/30 text-sm rounded-lg hover:bg-[hsl(var(--destructive))]/10 transition-colors"
                title="Remove key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Together AI (open-model fine-tuning) API Key */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h2 className="font-medium">Together AI API Key</h2>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Used to fine-tune and run open models like Llama and Qwen. Get a key at{" "}
            <a href="https://api.together.xyz/settings/api-keys" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-0.5">
              api.together.xyz <ExternalLink className="w-3 h-3" />
            </a>
          </p>

          {!isLoading && (
            <div className="mb-4">
              {settings?.together?.hasKey ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>
                    Key active: <code className="font-mono bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-xs">{settings.together.keyPreview}</code>
                    {settings.together.source === "env" && (
                      <span className="ml-2 text-[hsl(var(--muted-foreground))] text-xs">(from environment)</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <AlertCircle className="w-4 h-4" />
                  No Together key configured.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="password"
              value={togetherKey}
              onChange={(e) => setTogetherKey(e.target.value)}
              placeholder="Together API key…"
              className="flex-1 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] font-mono"
            />
            <button
              onClick={() => { if (togetherKey.trim()) togetherMutation.mutate(togetherKey.trim()); }}
              disabled={togetherMutation.isPending || !togetherKey.trim()}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {togetherSaved ? "Saved ✓" : togetherMutation.isPending ? "Saving…" : "Save"}
            </button>
            {settings?.together?.hasKey && settings.together.source === "user" && (
              <button
                onClick={() => deleteTogetherMutation.mutate()}
                className="px-3 py-2 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/30 text-sm rounded-lg hover:bg-[hsl(var(--destructive))]/10 transition-colors"
                title="Remove key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Mistral AI (open-model fine-tuning) API Key */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h2 className="font-medium">Mistral AI API Key</h2>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
            Used to fine-tune and run Mistral's own open models (Mistral 7B, Small, Codestral). Get a key at{" "}
            <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--primary))] hover:underline inline-flex items-center gap-0.5">
              console.mistral.ai <ExternalLink className="w-3 h-3" />
            </a>
          </p>

          {!isLoading && (
            <div className="mb-4">
              {settings?.mistral?.hasKey ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>
                    Key active: <code className="font-mono bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded text-xs">{settings.mistral.keyPreview}</code>
                    {settings.mistral.source === "env" && (
                      <span className="ml-2 text-[hsl(var(--muted-foreground))] text-xs">(from environment)</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                  <AlertCircle className="w-4 h-4" />
                  No Mistral key configured.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="password"
              value={mistralKey}
              onChange={(e) => setMistralKey(e.target.value)}
              placeholder="Mistral API key…"
              className="flex-1 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] font-mono"
            />
            <button
              onClick={() => { if (mistralKey.trim()) mistralMutation.mutate(mistralKey.trim()); }}
              disabled={mistralMutation.isPending || !mistralKey.trim()}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {mistralSaved ? "Saved ✓" : mistralMutation.isPending ? "Saving…" : "Save"}
            </button>
            {settings?.mistral?.hasKey && settings.mistral.source === "user" && (
              <button
                onClick={() => deleteMistralMutation.mutate()}
                className="px-3 py-2 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/30 text-sm rounded-lg hover:bg-[hsl(var(--destructive))]/10 transition-colors"
                title="Remove key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
            <h2 className="font-medium mb-4">Usage Stats</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Conversations", value: stats.conversations },
                { label: "Messages", value: stats.messages },
                { label: "Documents", value: stats.documents },
                { label: "Memories", value: stats.memories },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[hsl(var(--muted))]/50 rounded-lg p-3">
                  <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deployment guide */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <h2 className="font-medium mb-4">Deployment</h2>
          <div className="space-y-4">
            <div className="flex gap-3 p-3 rounded-lg bg-[hsl(var(--muted))]/30">
              <Monitor className="w-5 h-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Local</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  Run with <code className="font-mono bg-[hsl(var(--muted))] px-1 rounded">npm run dev</code> from the project root. Requires PostgreSQL.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-3 rounded-lg bg-[hsl(var(--muted))]/30">
              <Server className="w-5 h-5 text-[hsl(var(--primary))] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Datacenter / VPS</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  Run <code className="font-mono bg-[hsl(var(--muted))] px-1 rounded">npm run docker:up</code> to start the full stack with Docker Compose.
                  Set <code className="font-mono bg-[hsl(var(--muted))] px-1 rounded">OPENROUTER_API_KEY</code> in your <code className="font-mono bg-[hsl(var(--muted))] px-1 rounded">.env</code>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
