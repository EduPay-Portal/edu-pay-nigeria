// Provider registry — single source of truth for resolving providers by name.

import type { DVAProvider, ProviderName } from "./types.ts";
import { wemaProvider } from "./providers/wema.ts";

const registry: Record<ProviderName, DVAProvider | undefined> = {
  wema: wemaProvider,
  paystack: undefined, // DVA path deprecated; Paystack stays only for card top-ups (handled by paystack-webhook)
};

export function getDVAProvider(name: ProviderName = "wema"): DVAProvider {
  const p = registry[name];
  if (!p) throw new Error(`No DVA provider registered for "${name}"`);
  return p;
}

export const DEFAULT_DVA_PROVIDER: ProviderName = "wema";
