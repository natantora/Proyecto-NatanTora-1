-- ============================================================
-- Migración: Sistema de roles admin/member
-- Ejecutar en: Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/kkemeknbwopgkbhefkzc/sql/new
-- ============================================================

-- 1) Añadir columna role
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'
  CHECK (role IN ('member', 'admin'));

-- 2) Índice para queries rápidas de admins
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 3) Verificar
SELECT id, full_name, email, status, role, created_at
FROM profiles
ORDER BY created_at;
