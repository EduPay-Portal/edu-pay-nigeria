import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertAdminGuard, haveBase } from "../_shared/test-helpers.ts";

Deno.test({
  name: "admin-create-user rejects unauthorized callers",
  ignore: !haveBase(),
  async fn() {
    await assertAdminGuard("admin-create-user", {
      email: "x@y.z", password: "Xy123456!",
      first_name: "X", last_name: "Y", role: "parent",
    }, assertEquals);
  },
});
