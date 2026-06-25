import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertAdminGuard, haveBase } from "../_shared/test-helpers.ts";

Deno.test({
  name: "bulk-create-students rejects unauthorized callers",
  ignore: !haveBase(),
  async fn() {
    await assertAdminGuard("bulk-create-students", { mode: "all" }, assertEquals);
  },
});
