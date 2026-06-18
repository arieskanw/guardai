import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  listGuidelines,
  saveGuideline,
  deleteGuideline,
  toggleGuideline,
} from "@/lib/guidelines.functions";
import type { ReviewGuideline } from "@/lib/guidelines.functions";
import { Plus, Trash2, Pencil, Check, X, BookOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/guidelines")({
  component: GuidelinesPage,
});

const PLACEHOLDER = `Example guidelines:
- Use constants instead of magic numbers
- All functions must have error handling
- Max 300 lines per file
- Follow naming convention: camelCase for variables, PascalCase for classes
- Unit tests required for all new functions`;

function GuidelinesPage() {
  const { token } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const { data: guidelines, isLoading } = useQuery({
    queryKey: ["guidelines"],
    queryFn: () => listGuidelines({ headers }),
  });

  const saveMut = useMutation({
    mutationFn: (d: any) => saveGuideline({ data: d, headers }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guidelines"] });
      setShowForm(false);
      setEditing(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteGuideline({ data: { id }, headers }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guidelines"] }),
  });

  const toggleMut = useMutation({
    mutationFn: (d: { id: string; is_active: boolean }) =>
      toggleGuideline({ data: d, headers }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["guidelines"] }),
  });

  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-20 sm:pb-0">
      <main className="space-y-6 px-4 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Review Guidelines</h1>
          <Button size="sm" onClick={() => setShowForm(true)} disabled={showForm}>
            <Plus className="mr-1 h-4 w-4" /> New
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Set custom guidelines that the AI will use when reviewing your PR code.
          Guidelines are appended to the review prompt.
        </p>

        {/* New / Edit Form */}
        {showForm && <GuidelineForm onSubmit={(d) => saveMut.mutate(d)} onCancel={() => setShowForm(false)} saving={saveMut.isPending} />}

        {/* List */}
        <div className="space-y-3">
          {isLoading && <p className="text-center text-sm text-muted-foreground py-8">Loading...</p>}

          {!isLoading && (!guidelines || guidelines.length === 0) && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-soft)]">
              <BookOpen className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No guidelines yet. Create the first one!
              </p>
            </div>
          )}

          {guidelines?.map((g: ReviewGuideline) => (
            <div
              key={g.id}
              className={`rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)] transition-opacity ${
                !g.is_active ? "opacity-60" : ""
              } ${editing === g.id ? "border-primary" : "border-border"}`}
            >
              {editing === g.id ? (
                <GuidelineForm
                  initial={g}
                  onSubmit={(d) => saveMut.mutate(d)}
                  onCancel={() => setEditing(null)}
                  saving={saveMut.isPending}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{g.name}</h3>
                        {g.repo_full_name && (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                            {g.repo_full_name}
                          </span>
                        )}
                        {!g.repo_full_name && (
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            Global
                          </span>
                        )}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground line-clamp-3">
                        {g.guidelines}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() =>
                          toggleMut.mutate({
                            id: g.id,
                            is_active: !g.is_active,
                          })
                        }
                        className={`rounded-lg p-1.5 transition-colors ${
                          g.is_active
                            ? "text-emerald-600 hover:bg-emerald-50"
                            : "text-muted-foreground hover:bg-muted"
                        }`}
                        title={g.is_active ? "Disable" : "Enable"}
                      >
                        {g.is_active ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditing(g.id)}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteMut.mutate(g.id)}
                        className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function GuidelineForm({
  initial,
  onSubmit,
  onCancel,
  saving,
}: {
  initial?: ReviewGuideline;
  onSubmit: (d: any) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [repo, setRepo] = useState(initial?.repo_full_name || "");
  const [guidelines, setGuidelines] = useState(
    initial?.guidelines || ""
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !guidelines.trim()) return;
    onSubmit({
      id: initial?.id,
      name: name.trim(),
      repo_full_name: repo.trim() || null,
      guidelines: guidelines.trim(),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] space-y-3"
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Guidelines"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Repo (optional — leave empty for global)
        </label>
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="owner/repo-name"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Guidelines
        </label>
        <textarea
          value={guidelines}
          onChange={(e) => setGuidelines(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={6}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none resize-y"
          required
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving..." : initial ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
