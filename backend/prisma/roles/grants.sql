-- What the API's database role may do. Applied after every migration (idempotent), so a table added later is never forgotten.
-- The role itself is made by infrastructure (dev/postgres/init for local development), because it carries a password.
-- With no such role (a bare development database) this does nothing and the API runs as the owner.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'everfox_app') THEN
    RAISE NOTICE 'role everfox_app does not exist: no grants applied';
    RETURN;
  END IF;
  -- only roles that were given access may connect to this database (by default every role may)
  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO everfox_app', current_database());
  GRANT USAGE ON SCHEMA public TO everfox_app;
  -- data only: no CREATE/ALTER/DROP, no TRUNCATE, no REFERENCES, no TRIGGER
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO everfox_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO everfox_app;
  -- the migration history is the owner's business
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON TABLE public._prisma_migrations FROM everfox_app;
  END IF;
END
$$;
