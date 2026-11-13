"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export type WorkspaceOrg = {
  id: string;
  name: string;
  sector?: string;
  notes?: string;
};

const STORAGE_KEY = "ttx-workspace-org";
const COOKIE_KEY = "ttx-workspace-org";

type OrgContextValue = {
  organizations: WorkspaceOrg[];
  selectedOrgId: string | null;
  selectedOrg: WorkspaceOrg | null;
  setSelectedOrgId: (id: string | null) => void;
};

const OrgContext = createContext<OrgContextValue>({
  organizations: [],
  selectedOrgId: null,
  selectedOrg: null,
  setSelectedOrgId: () => {},
});

function writeOrgCookie(id: string | null) {
  if (typeof document === "undefined") return;
  if (id) {
    document.cookie = `${COOKIE_KEY}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
  } else {
    document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function WorkspaceOrgProvider({
  organizations,
  children,
  initialOrgId = null,
}: {
  organizations: WorkspaceOrg[];
  children: React.ReactNode;
  /** Cookie value from the server so first paint can match Ops filters. */
  initialOrgId?: string | null;
}) {
  const router = useRouter();
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(() => {
    if (initialOrgId && organizations.some((o) => o.id === initialOrgId)) {
      return initialOrgId;
    }
    return null;
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && organizations.some((o) => o.id === stored)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted workspace
      setSelectedOrgIdState(stored);
      writeOrgCookie(stored);
      return;
    }
    if (initialOrgId && organizations.some((o) => o.id === initialOrgId)) {
      setSelectedOrgIdState(initialOrgId);
      localStorage.setItem(STORAGE_KEY, initialOrgId);
      writeOrgCookie(initialOrgId);
      return;
    }
    // First-run / cleared cookie: auto-select when there is only one client.
    if (organizations.length === 1) {
      const onlyId = organizations[0]!.id;
      setSelectedOrgIdState(onlyId);
      localStorage.setItem(STORAGE_KEY, onlyId);
      writeOrgCookie(onlyId);
    }
  }, [organizations, initialOrgId]);

  const setSelectedOrgId = useCallback(
    (id: string | null) => {
      setSelectedOrgIdState(id);
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
      writeOrgCookie(id);
      router.refresh();
    },
    [router],
  );

  const selectedOrg = useMemo(
    () => organizations.find((o) => o.id === selectedOrgId) ?? null,
    [organizations, selectedOrgId],
  );

  const value = useMemo(
    () => ({
      organizations,
      selectedOrgId,
      selectedOrg,
      setSelectedOrgId,
    }),
    [organizations, selectedOrgId, selectedOrg, setSelectedOrgId],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useWorkspaceOrg() {
  return useContext(OrgContext);
}
