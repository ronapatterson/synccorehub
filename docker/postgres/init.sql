-- =============================================================
-- SyncCoreHub — PostgreSQL Initialization
-- Run once on first startup via docker-entrypoint-initdb.d
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- for fuzzy text search
CREATE EXTENSION IF NOT EXISTS "btree_gin";   -- for composite GIN indexes

-- =============================================================
-- Row Level Security helper function
-- =============================================================
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- =============================================================
-- Optimistic locking trigger factory
-- Raises serialization_failure if version is stale
-- =============================================================
CREATE OR REPLACE FUNCTION check_version_lock()
RETURNS trigger AS $$
BEGIN
  IF OLD.version IS DISTINCT FROM NEW.version - 1 THEN
    RAISE EXCEPTION 'Stale object: version mismatch (expected %, got %)',
      OLD.version + 1, NEW.version
      USING ERRCODE = '40001'; -- serialization_failure
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- updated_at auto-update trigger factory
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- Notes
-- =============================================================
-- Tables and RLS policies are created via Drizzle migrations.
-- This file handles extensions and shared PL/pgSQL functions only.
-- Drizzle's migrate() call runs after the container initializes.
