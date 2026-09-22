"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from "@tanstack/react-query";
import { env } from "@/lib/env";
import { ROLE_HOME } from "@/lib/auth/roles";
import { can, type Permission } from "@/lib/auth/permissions";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { DemoDataService } from "@/services/data/demo/service";
import { SupabaseDataService } from "@/services/data/supabase/service";
import { DemoRealtimeSource } from "@/services/realtime/demo-source";
import { SupabaseRealtimeSource } from "@/services/realtime/supabase-source";
import type { DataService } from "@/services/data/types";
import type { RealtimeSource } from "@/services/realtime/types";
import { toast } from "@/stores/toast";
import type { Viewer } from "@/types/domain";

export interface Workspace {
  data: DataService;
  realtime: RealtimeSource;
  viewer: Viewer;
  /** Role home, e.g. "/nurse". */
  home: string;
}

const WorkspaceContext = createContext<Workspace | null>(null);

/**
 * Queries never run during server rendering, so the server gets a stub that fails loudly
 * if anything tries to fetch there instead of a Supabase client shared across requests.
 */
function serverStub<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (prop === "mode") return env.demoMode ? "demo" : "supabase";
      throw new Error(`${name}.${String(prop)} is only available in the browser.`);
    },
  });
}

function createWorkspace(viewer: Viewer): Workspace {
  const home = ROLE_HOME[viewer.role];
  if (typeof window === "undefined") {
    return { data: serverStub<DataService>("DataService"), realtime: serverStub<RealtimeSource>("RealtimeSource"), viewer, home };
  }
  if (env.demoMode) return { data: new DemoDataService(viewer), realtime: new DemoRealtimeSource(viewer), viewer, home };
  const db = getBrowserSupabase();
  return { data: new SupabaseDataService(db, viewer), realtime: new SupabaseRealtimeSource(db, viewer), viewer, home };
}

export function WorkspaceProvider({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: false, retry: 1 } } }),
  );
  const [workspace] = useState(() => createWorkspace(viewer));
  return (
    <QueryClientProvider client={client}>
      <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>
    </QueryClientProvider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside a role workspace.");
  return ctx;
}

export function useCan(permission: Permission) {
  return can(useWorkspace().viewer.role, permission);
}

interface ActionOptions<TArgs, TResult> {
  /** Query roots to refetch afterwards, e.g. ["alerts", "patients"]. */
  invalidate?: string[];
  success?: string | ((result: TResult, args: TArgs) => string);
  error?: string;
}

/** A data-service write with a toast on success or failure and the affected queries refetched. */
export function useAction<TArgs, TResult>(run: (data: DataService, args: TArgs) => Promise<TResult>, options: ActionOptions<TArgs, TResult> = {}) {
  const { data } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => run(data, args),
    onSuccess: (result, args) => {
      options.invalidate?.forEach((key) => void qc.invalidateQueries({ queryKey: [key] }));
      const message = typeof options.success === "function" ? options.success(result, args) : options.success;
      if (message) toast.success(message);
    },
    onError: (err) => toast.error(options.error ?? "That did not go through", err instanceof Error ? err.message : undefined),
  });
}
