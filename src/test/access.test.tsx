import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppRole } from "@/types/auth";

let currentRole: AppRole | null = "admin";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));
vi.mock("@/hooks/useUserRole", () => ({
  useUserRole: () => ({ data: currentRole, isLoading: false }),
}));
vi.mock("@/components/admin/StudentsWithoutVA", () => ({ StudentsWithoutVA: () => null }));
vi.mock("@/integrations/supabase/client", () => {
  const chain: any = {};
  ["select", "order", "limit", "eq", "in"].forEach((k) => (chain[k] = () => chain));
  chain.then = (res: any) => Promise.resolve({ data: [], error: null }).then(res);
  return { supabase: { from: () => chain, functions: { invoke: vi.fn() } } };
});

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ADMIN_PAGE_ROLES } from "@/lib/permissions";
import DVAManagementPage from "@/pages/dashboard/admin/DVAManagementPage";

const PROTECTED = {
  "/dashboard/admin/webhooks": ADMIN_PAGE_ROLES.webhooks,
  "/dashboard/admin/reconciliation": ADMIN_PAGE_ROLES.reconciliation,
  "/dashboard/admin/payment-simulator": ADMIN_PAGE_ROLES.paymentSimulator,
  "/dashboard/admin/status": ADMIN_PAGE_ROLES.status,
  "/dashboard/admin/settings": ADMIN_PAGE_ROLES.settings,
};
const OTHER_STAFF: AppRole[] = ["principal", "bursar", "registrar", "auditor"];

function visit(path: string, roles: AppRole[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={path} element={<ProtectedRoute allowedRoles={roles}><div>SECRET PAGE</div></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("admin-only pages (direct URL access)", () => {
  // superadmin@ and admin@ both hold the 'admin' role.
  for (const [path, roles] of Object.entries(PROTECTED)) {
    it(`admin/superadmin can open ${path}`, () => {
      currentRole = "admin";
      visit(path, roles);
      expect(screen.getByText("SECRET PAGE")).toBeInTheDocument();
    });
    for (const role of OTHER_STAFF) {
      it(`${role} is blocked from ${path}`, () => {
        currentRole = role;
        visit(path, roles);
        expect(screen.queryByText("SECRET PAGE")).not.toBeInTheDocument();
        expect(screen.getByText("Access Denied")).toBeInTheDocument();
      });
    }
  }

  it("re-issue actions are admin-only in permissions", () => {
    expect(ADMIN_PAGE_ROLES.dvaActions).toEqual(["admin"]);
  });
});

describe("DVA page action buttons", () => {
  const renderPage = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><DVAManagementPage /></MemoryRouter>
      </QueryClientProvider>,
    );
  beforeEach(() => { currentRole = "admin"; });

  it("admin sees re-issue and retire buttons", () => {
    renderPage();
    expect(screen.getByText(/Re-issue Wema DVAs/)).toBeInTheDocument();
    expect(screen.getByText(/Retire & reissue legacy/)).toBeInTheDocument();
  });

  for (const role of OTHER_STAFF) {
    it(`${role} does not see re-issue or retire buttons`, () => {
      currentRole = role;
      renderPage();
      expect(screen.queryByText(/Re-issue Wema DVAs/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Retire & reissue legacy/)).not.toBeInTheDocument();
    });
  }
});
