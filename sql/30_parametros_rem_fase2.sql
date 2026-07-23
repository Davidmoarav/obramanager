-- ============================================================
-- 30 · PARÁMETROS DE REMUNERACIÓN (Fase 2 de la auditoría)
--
-- 1. jornada_semanal: horas de la jornada ordinaria, para el factor
--    legal de horas extra (Ley 21.561: 44h desde 04/2024, 42h desde
--    04/2026, 40h desde 04/2028). Factor = (28/(30×4×jornada)) × 1.5.
-- 2. tope_afc_uf: el seguro de cesantía tiene tope imponible PROPIO,
--    distinto al de AFP/salud (131,9 UF vs 87,8 UF en 2025).
--
-- Idempotente. Ejecutar en Supabase > SQL Editor > Run
-- ============================================================

alter table parametros_remuneracion
  add column if not exists jornada_semanal numeric(4,1) default 42;

alter table parametros_remuneracion
  add column if not exists tope_afc_uf numeric(6,2) default 131.90;
