import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertAdminGuard, haveBase } from "../_shared/test-helpers.ts";

Deno.test({
  name: "create-virtual-account rejects unauthorized callers with friendly body",
  ignore: !haveBase(),
  async fn() {
    await assertAdminGuard("create-virtual-account", {
      student_id: "00000000-0000-0000-0000-000000000000",
      first_name: "T",
      last_name: "U",
      email: "t@u.test",
    }, assertEquals);
  },
});