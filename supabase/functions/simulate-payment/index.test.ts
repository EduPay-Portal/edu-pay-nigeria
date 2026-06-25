import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assertAdminGuard, haveBase } from "../_shared/test-helpers.ts";

Deno.test({
  name: "simulate-payment rejects unauthorized callers",
  ignore: !haveBase(),
  async fn() {
    await assertAdminGuard("simulate-payment", {
      student_id: "00000000-0000-0000-0000-000000000000", amount: 100,
    }, assertEquals);
  },
});
