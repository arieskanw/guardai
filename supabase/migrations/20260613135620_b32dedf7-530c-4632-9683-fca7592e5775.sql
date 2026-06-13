-- GitHub installations: track which orgs/users installed the app
CREATE TABLE public.github_installations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  installation_id BIGINT NOT NULL UNIQUE,
  account_login TEXT NOT NULL,
  account_type TEXT NOT NULL,
  account_id BIGINT NOT NULL,
  repositories JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_installations TO authenticated;
GRANT ALL ON public.github_installations TO service_role;

ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own installations" ON public.github_installations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own installations" ON public.github_installations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own installations" ON public.github_installations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own installations" ON public.github_installations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_gh_installations_updated
  BEFORE UPDATE ON public.github_installations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PR reviews: log of automatic PR reviews performed
CREATE TABLE public.pr_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_id BIGINT NOT NULL,
  repo_full_name TEXT NOT NULL,
  pr_number INTEGER NOT NULL,
  pr_title TEXT NOT NULL,
  pr_url TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  quality_score INTEGER NOT NULL DEFAULT 0,
  findings_count INTEGER NOT NULL DEFAULT 0,
  security_issues_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  comment_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pr_reviews_installation ON public.pr_reviews(installation_id, created_at DESC);
CREATE INDEX idx_pr_reviews_repo_pr ON public.pr_reviews(repo_full_name, pr_number);

GRANT SELECT ON public.pr_reviews TO authenticated;
GRANT ALL ON public.pr_reviews TO service_role;

ALTER TABLE public.pr_reviews ENABLE ROW LEVEL SECURITY;

-- Users can view PR reviews for installations they own
CREATE POLICY "users view own pr reviews" ON public.pr_reviews
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.github_installations gi
      WHERE gi.installation_id = pr_reviews.installation_id
        AND gi.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_pr_reviews_updated
  BEFORE UPDATE ON public.pr_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();