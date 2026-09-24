// TEMPORARY migration helper — deleted right after use.
import postgres from "npm:postgres@3.4.4";
Deno.serve(async (req) => {
  if (req.headers.get("x-migration-key") !== "2c7289113f1fd54cd88a659ec36a8092cf58ae74a31e9c6e") return new Response("no", { status: 401 });
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
  try {
    const users = await sql`select to_jsonb(u) as r from auth.users u`;
    const idents = await sql`select to_jsonb(i) as r from auth.identities i`;
    return Response.json({ users: users.map((x) => x.r), identities: idents.map((x) => x.r) });
  } catch (e) { return Response.json({ error: String(e) }, { status: 500 }); }
  finally { await sql.end(); }
});
