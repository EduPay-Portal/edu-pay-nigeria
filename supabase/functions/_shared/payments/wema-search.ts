// Wema VAS — 3. Transaction Search API client.
//
// This is the ONE endpoint Wema hosts. It is production-only and its URL /
// credentials are released by Wema at go-live, so the client stays disabled
// until WEMA_SEARCH_BASE_URL and WEMA_SEARCH_BEARER_TOKEN are configured.
// Spec: https://wemabank-doc.notion.site/3-Transaction-Search-API-32013df490b68056bc7fc073ef416529

const env = (k: string) => Deno.env.get(k) ?? "";

export interface TransactionSearchQuery {
  sessionid?: string;
  craccount?: string;
}

export interface TransactionSearchResult {
  configured: boolean;
  status?: string;
  status_desc?: string;
  transactions?: Array<Record<string, unknown>>;
  error?: string;
}

export function isSearchConfigured(): boolean {
  return !!env("WEMA_SEARCH_BASE_URL") && !!env("WEMA_SEARCH_BEARER_TOKEN");
}

export async function searchTransactions(
  query: TransactionSearchQuery,
  timeoutMs = 20_000,
): Promise<TransactionSearchResult> {
  if (!isSearchConfigured()) {
    return {
      configured: false,
      error: "Wema Transaction Search is not configured. Wema releases this endpoint at go-live.",
    };
  }
  if (!query.sessionid && !query.craccount) {
    return { configured: true, error: "Provide either sessionid or craccount" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(env("WEMA_SEARCH_BASE_URL"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env("WEMA_SEARCH_BEARER_TOKEN")}`,
      },
      body: JSON.stringify(
        query.sessionid ? { sessionid: query.sessionid } : { craccount: query.craccount },
      ),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Never echo the response body verbatim — it may carry customer data.
      return { configured: true, error: `Wema search returned HTTP ${res.status}` };
    }

    const data = await res.json();
    return {
      configured: true,
      status: data.status,
      status_desc: data.status_desc,
      transactions: data.transactions ?? [],
    };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return { configured: true, error: aborted ? "Wema search timed out" : "Wema search request failed" };
  } finally {
    clearTimeout(timer);
  }
}
