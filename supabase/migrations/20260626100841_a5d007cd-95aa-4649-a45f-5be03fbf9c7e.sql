
-- Move has_role out of the API-exposed `public` schema so signed-in users cannot
-- call it as an RPC, while keeping it available to RLS policies (which reference
-- it by OID and only require EXECUTE on the function).

CREATE SCHEMA IF NOT EXISTS private;

-- Relocate the function. Policies in pg_policy reference functions by OID,
-- so ALTER ... SET SCHEMA preserves all 29 existing policy references.
ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;

-- RLS policies execute under the caller's role; the caller still needs EXECUTE.
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
