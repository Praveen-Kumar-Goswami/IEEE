"use client";

import type { ReactNode } from "react";
import { useMounted } from "@/hooks/use-mounted";
import { useMotionStore, type MotionPreference } from "@/stores/motion";
import { useUiStore } from "@/stores/ui";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";

/** Personal preferences, stored in this browser. */
export function PreferencesCard() {
  const mounted = useMounted();
  const motion = useMotionStore((s) => s.preference);
  const setMotion = useMotionStore((s) => s.setPreference);
  const ui = useUiStore();

  return (
    <Card>
      <SectionTitle title="Preferences" meta="Saved in this browser" />
      <div className="divide-y divide-(--line) border-t border-(--line)">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-body text-bone">Motion</p>
            <p className="mt-0.5 text-small text-graphite-300">Follow the system setting, or turn animation down for this workspace.</p>
          </div>
          <Segmented<MotionPreference>
            label="Motion"
            value={mounted ? motion : "system"}
            onChange={setMotion}
            options={[
              { value: "system", label: "System" },
              { value: "reduced", label: "Reduced" },
              { value: "full", label: "Full" },
            ]}
          />
        </div>
        <Row>
          <Switch checked={mounted && ui.alertSound} onChange={ui.setAlertSound} label="Alert sound" description="A soft chime when a new indicator opens for one of your patients." />
        </Row>
        <Row>
          <Switch checked={mounted && ui.compactTables} onChange={ui.setCompactTables} label="Compact tables" description="Shorter rows in patient, staff and device tables." />
        </Row>
        <Row>
          <Switch checked={mounted && ui.sidebarCollapsed} onChange={() => ui.toggleSidebar()} label="Collapsed sidebar" description="Icons only on large screens." />
        </Row>
      </div>
    </Card>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="px-5 py-4">{children}</div>;
}

export function SettingsView() {
  return (
    <>
      <PageHeader eyebrow="Account" title="Settings" description="Preferences for how the workspace looks and alerts you." />
      <div className="max-w-3xl">
        <PreferencesCard />
      </div>
    </>
  );
}
