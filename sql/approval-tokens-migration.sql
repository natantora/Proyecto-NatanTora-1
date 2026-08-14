-- ============================================================
-- Migracion: tabla approval_tokens para aprobacion 1-clic
-- Ejecutar en: Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/kkemeknbwopgkbhefkzc/sql/new
-- ============================================================

CREATE TABLE IF NOT EXISTS approval_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  used_by_admin_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_tokens_user
  ON approval_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_approval_tokens_unused
  ON approval_tokens(user_id, action) WHERE used_at IS NULL;

-- Verificar
SELECT count(*) AS total_tokens FROM approval_tokens;
