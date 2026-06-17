import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/utils";

export default function ModelsPage() {
  const { data: models, isLoading } = useQuery({
    queryKey: ["models"],
    queryFn: api.listModels,
  });

  const providers = [...new Set(models?.map((m) => m.provider) ?? [])].sort();

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[hsl(var(--border))]">
        <h1 className="text-xl font-semibold">Available Models</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Open-source models from OpenRouter. Select any when creating or editing a conversation.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading catalog…</p>
        ) : (
          <div className="space-y-8">
            {providers.map((provider) => {
              const providerModels = models?.filter((m) => m.provider === provider) ?? [];
              return (
                <div key={provider}>
                  <h2 className="font-semibold text-sm text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
                    {provider}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {providerModels.map((model) => (
                      <div
                        key={model.id}
                        className="p-4 border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">{model.name}</p>
                          <span className="text-[10px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded-full shrink-0 font-mono">
                            {(model.contextLength / 1000).toFixed(0)}K ctx
                          </span>
                        </div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 leading-relaxed">
                          {model.description}
                        </p>
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))]/60 mt-2 font-mono truncate">
                          {model.id}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
