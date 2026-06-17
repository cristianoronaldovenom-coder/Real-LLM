import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Settings, Send, Bot, User, Brain, Database, Globe, FileArchive, Paperclip, Pencil, Check, X } from "lucide-react";
import { api, authHeaders, type AiModel, type ConversationWithMessages, type Message } from "../lib/utils";
import { cn } from "../lib/utils";
import { countCodeBlocks, downloadCodeAsZip } from "../lib/codeZip";
import { buildAttachmentBlock } from "../lib/fileAttach";

export default function ChatPage() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const queryClient = useQueryClient();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: api.listConversations,
  });

  const { data: models } = useQuery({
    queryKey: ["models"],
    queryFn: api.listModels,
  });

  const createMutation = useMutation({
    mutationFn: api.createConversation,
    onSuccess: (c) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setActiveId(c.id);
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      api.updateConversation(id, { title }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["conversation", id] });
      setEditingId(null);
      setEditTitle("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteConversation(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setActiveId((curr) => (curr === id ? null : curr));
    },
  });

  const handleCreate = () => {
    const defaultModel = models?.[0]?.id ?? "meta-llama/llama-3.3-70b-instruct";
    createMutation.mutate({ title: "New Conversation", model: defaultModel });
  };

  const startEditing = (id: number, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle || "");
  };

  const commitRename = () => {
    if (editingId === null) return;
    const title = editTitle.trim();
    if (!title) { setEditingId(null); setEditTitle(""); return; }
    renameMutation.mutate({ id: editingId, title });
  };

  const handleDelete = (id: number, title: string) => {
    if (window.confirm(`Delete "${title || "Untitled"}"? This can't be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex h-full w-full">
      {/* Sidebar: conversation list */}
      <div className="w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">Conversations</h2>
          <button
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-colors disabled:opacity-50"
            title="New conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {isLoading ? (
            <p className="p-4 text-sm text-[hsl(var(--muted-foreground))] text-center">Loading…</p>
          ) : conversations?.length === 0 ? (
            <p className="p-4 text-sm text-[hsl(var(--muted-foreground))] text-center">No conversations yet.</p>
          ) : (
            conversations?.map((c) =>
              editingId === c.id ? (
                <div
                  key={c.id}
                  className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-[hsl(var(--accent))]"
                >
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                      if (e.key === "Escape") { setEditingId(null); setEditTitle(""); }
                    }}
                    className="flex-1 min-w-0 bg-[hsl(var(--background))] border border-[hsl(var(--border))] rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
                  />
                  <button
                    onClick={commitRename}
                    disabled={renameMutation.isPending}
                    className="w-7 h-7 rounded flex items-center justify-center text-[hsl(var(--primary))] hover:bg-[hsl(var(--background))] transition-colors shrink-0 disabled:opacity-50"
                    title="Save"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setEditTitle(""); }}
                    className="w-7 h-7 rounded flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))] transition-colors shrink-0"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center rounded-md transition-colors",
                    activeId === c.id
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                      : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))]"
                  )}
                >
                  <button
                    onClick={() => setActiveId(c.id)}
                    className={cn(
                      "flex-1 min-w-0 px-3 py-2 text-sm text-left truncate",
                      activeId === c.id && "font-medium"
                    )}
                  >
                    {c.title || "Untitled"}
                  </button>
                  <div className="flex items-center pr-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEditing(c.id, c.title); }}
                      className={cn(
                        "w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors",
                        activeId === c.id
                          ? "hover:bg-[hsl(var(--primary-foreground))]/20"
                          : "hover:bg-[hsl(var(--background))]"
                      )}
                      title="Rename"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(c.id, c.title); }}
                      disabled={deleteMutation.isPending}
                      className={cn(
                        "w-7 h-7 rounded flex items-center justify-center shrink-0 transition-colors disabled:opacity-50",
                        activeId === c.id
                          ? "hover:bg-[hsl(var(--primary-foreground))]/20"
                          : "hover:bg-[hsl(var(--background))] hover:text-red-500"
                      )}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[hsl(var(--background))] min-w-0">
        {activeId ? (
          <ActiveChat
            key={activeId}
            conversationId={activeId}
            models={models ?? []}
            onDeleted={() => setActiveId(null)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--primary))]/10 flex items-center justify-center mb-6">
              <Brain className="w-8 h-8 text-[hsl(var(--primary))]" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Welcome to LLM Studio</h2>
            <p className="text-[hsl(var(--muted-foreground))] max-w-md mb-8">
              Chat with the world's best open-source AI models — locally or in your datacenter.
            </p>
            <button
              onClick={handleCreate}
              className="px-6 py-3 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity flex items-center gap-2 shadow-md"
            >
              <Plus className="w-4 h-4" /> Start a Conversation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveChat({
  conversationId,
  models,
  onDeleted,
}: {
  conversationId: number;
  models: AiModel[];
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: conversation, isLoading } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => api.getConversation(conversationId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onDeleted();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.updateConversation>[1]) =>
      api.updateConversation(conversationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages, streamingMessage]);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming) return;

    const typed = input.trim();
    let content = typed;
    if (attachments.length > 0) {
      const { block } = await buildAttachmentBlock(attachments);
      const header = typed || "Please review the attached file(s).";
      content = `${header}\n\n${block}`;
    }

    setInput("");
    setAttachments([]);
    setIsStreaming(true);
    setStreamingMessage("");

    // Optimistically add user message
    const tempMsg: Message = {
      id: Date.now(),
      conversationId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    queryClient.setQueryData(["conversation", conversationId], (old: ConversationWithMessages | undefined) =>
      old ? { ...old, messages: [...old.messages, tempMsg] } : old
    );

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const m = line.replace(/^data: /, "").trim();
          if (!m || m === "[DONE]") continue;
          try {
            const evt = JSON.parse(m) as { delta?: string; error?: string };
            if (evt.error) { setStreamingMessage(`⚠️ ${evt.error}`); break; }
            if (evt.delta) { fullResponse += evt.delta; setStreamingMessage(fullResponse); }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsStreaming(false);
      setStreamingMessage(null);
      queryClient.invalidateQueries({ queryKey: ["conversation", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  };

  if (isLoading || !conversation) {
    return <div className="flex-1 flex items-center justify-center text-[hsl(var(--muted-foreground))]">Loading…</div>;
  }

  const modelName = models.find((m) => m.id === conversation.model)?.name ?? conversation.model;

  return (
    <>
      {/* Header */}
      <div className="h-14 border-b border-[hsl(var(--border))] flex items-center justify-between px-5 bg-[hsl(var(--card))]/50 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="font-medium truncate">{conversation.title}</h3>
          <span className="text-xs bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
            {modelName}
          </span>
          {conversation.useKnowledgeBase && (
            <span className="text-xs bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
              <Database className="w-3 h-3" /> RAG
            </span>
          )}
          {conversation.useWebSearch && (
            <span className="text-xs bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
              <Globe className="w-3 h-3" /> Web
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 transition-colors"
            title="Delete conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {conversation.messages.length === 0 && !streamingMessage ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <Bot className="w-12 h-12 mb-3" />
            <p className="text-sm">Start chatting. Using <strong>{modelName}</strong>.</p>
          </div>
        ) : (
          conversation.messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))
        )}
        {streamingMessage !== null && (
          <MessageBubble role="assistant" content={streamingMessage} isStreaming={isStreaming} />
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] shrink-0">
        <div className="max-w-3xl mx-auto">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((f, i) => (
                <div
                  key={`${f.name}-${i}`}
                  className="flex items-center gap-1.5 text-xs bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] pl-2.5 pr-1.5 py-1 rounded-full"
                >
                  <Paperclip className="w-3 h-3 text-[hsl(var(--muted-foreground))]" />
                  <span className="max-w-[180px] truncate">{f.name}</span>
                  <button
                    onClick={() => removeAttachment(i)}
                    disabled={isStreaming}
                    className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-[hsl(var(--background))] transition-colors disabled:opacity-50"
                    title="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-[hsl(var(--ring))] transition-shadow">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Attach files (text, code, .zip…)"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => updateMutation.mutate({ useWebSearch: !conversation.useWebSearch })}
              disabled={isStreaming || updateMutation.isPending}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                conversation.useWebSearch
                  ? "bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
              )}
              title={conversation.useWebSearch ? "Web search is ON — click to turn off" : "Web search is OFF — click to turn on"}
            >
              <Globe className="w-5 h-5" />
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
              rows={1}
              style={{ resize: "none" }}
              className="flex-1 bg-transparent py-2 px-2 text-sm outline-none min-h-[40px] max-h-[160px] overflow-y-auto leading-relaxed"
              disabled={isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={isStreaming || (!input.trim() && attachments.length === 0)}
              className="w-10 h-10 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-center mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
          AI models can make mistakes. Verify important information.
        </p>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <ConversationSettings
          conversation={conversation}
          models={models}
          onUpdate={(data) => updateMutation.mutate(data)}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}

function MessageBubble({ role, content, isStreaming }: { role: string; content: string; isStreaming?: boolean }) {
  const isUser = role === "user";
  const [downloading, setDownloading] = useState(false);
  const codeCount = !isUser && !isStreaming ? countCodeBlocks(content) : 0;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadCodeAsZip(content);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={cn("flex gap-3 max-w-3xl mx-auto w-full", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm",
          isUser
            ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
            : "bg-[hsl(var(--card))] border border-[hsl(var(--border))]"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={cn("flex flex-col gap-1.5 max-w-[85%] min-w-0", isUser && "items-end")}>
        <div
          className={cn(
            "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words",
            isUser
              ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-tr-sm"
              : "bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-tl-sm"
          )}
        >
          {content}
          {isStreaming && <span className="inline-block w-1.5 h-4 bg-current ml-1 animate-pulse align-middle opacity-70" />}
        </div>
        {codeCount > 0 && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="self-start flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))] transition-colors disabled:opacity-50"
            title="Download the code in this message as a .zip"
          >
            <FileArchive className="w-3.5 h-3.5" />
            {downloading ? "Zipping…" : `Download ${codeCount} file${codeCount > 1 ? "s" : ""} as .zip`}
          </button>
        )}
      </div>
    </div>
  );
}

function ConversationSettings({
  conversation,
  models,
  onUpdate,
  onClose,
}: {
  conversation: ConversationWithMessages;
  models: AiModel[];
  onUpdate: (data: any) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(conversation.title);
  const [model, setModel] = useState(conversation.model);
  const [systemPrompt, setSystemPrompt] = useState(conversation.systemPrompt ?? "");
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(conversation.useKnowledgeBase);
  const [useWebSearch, setUseWebSearch] = useState(conversation.useWebSearch);

  const handleSave = () => {
    onUpdate({ title, model, systemPrompt: systemPrompt || null, useKnowledgeBase, useWebSearch });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[hsl(var(--background))] rounded-xl shadow-xl w-full max-w-md border border-[hsl(var(--border))]">
        <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--border))]">
          <h2 className="font-semibold">Conversation Settings</h2>
          <button onClick={onClose} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--card))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))] resize-none"
            />
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
            <div>
              <p className="text-sm font-medium">Knowledge Base</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Search uploaded documents when answering</p>
            </div>
            <button
              onClick={() => setUseKnowledgeBase(!useKnowledgeBase)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative",
                useKnowledgeBase ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted))]"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                  useKnowledgeBase ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--border))]">
            <div>
              <p className="text-sm font-medium">Web Search</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Search the live web (needs a search key in Settings)</p>
            </div>
            <button
              onClick={() => setUseWebSearch(!useWebSearch)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative shrink-0",
                useWebSearch ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted))]"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                  useWebSearch ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </div>
        <div className="p-5 border-t border-[hsl(var(--border))] flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
