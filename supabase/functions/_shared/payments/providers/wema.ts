// Wema Bank virtual account provider.
//
// Per the Wema VAS documentation the vendor generates and manages its own
// virtual account numbers: a 3-digit prefix agreed with the bank plus a unique
// 7-digit serial forming a 10-digit NUBAN. The test prefix is 711.
// There is NO remote "create account" API at Wema — nothing is called here.

import type { CreateDVAInput, DVAProvider, DVAccount, Environment } from "../types.ts";
import { accountPrefix, formatAccountName, vasEnvironment } from "../wema-vas.ts";

export const WEMA_BANK_NAME = "WEMA BANK";
export const WEMA_BANK_CODE = "035";

export const wemaProvider: DVAProvider = {
  name: "wema",
  get environment(): Environment {
    return vasEnvironment();
  },

  createDVA(input: CreateDVAInput): Promise<DVAccount> {
    const prefix = accountPrefix();
    const accountNumber = input.account_number;

    if (!/^[0-9]{10}$/.test(accountNumber) || !accountNumber.startsWith(prefix)) {
      throw new Error(
        `Invalid virtual account number "${accountNumber}" — must be 10 digits starting with prefix ${prefix}`,
      );
    }

    const customerName = `${input.first_name} ${input.last_name}`.trim();

    return Promise.resolve({
      provider: "wema",
      account_number: accountNumber,
      // Vendor name first, then customer name (Account Lookup requirement).
      account_name: formatAccountName(customerName),
      bank_name: WEMA_BANK_NAME,
      bank_code: WEMA_BANK_CODE,
      provider_account_id: accountNumber,
      provider_customer_id: input.student_id,
      environment: vasEnvironment(),
      metadata: {
        prefix,
        account_type: "static",
        generated_by: "vendor",
      },
    });
  },
};
