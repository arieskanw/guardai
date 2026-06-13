GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_installations TO authenticated;
GRANT ALL ON public.github_installations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr_reviews TO authenticated;
GRANT ALL ON public.pr_reviews TO service_role;