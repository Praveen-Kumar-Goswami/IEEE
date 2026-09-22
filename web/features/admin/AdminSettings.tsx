"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime } from "@/utils/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useAction, useCan, useWorkspace } from "@/features/dashboard/context";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";
import { PreferencesCard } from "@/features/account/SettingsView";
import type { AlertRule, AlertThresholds } from "@/types/domain";

const FIELDS: { key: keyof AlertThresholds; label: string; unit: string; step: number; min: number; max: number; hint: string }[] = [
  { key: "temperatureDelta", label: "Temperature change", unit: "°C", step: 0.1, min: 0.1, max: 20, hint: "Rise in local temperature over the session baseline." },
  { key: "humidity", label: "Humidity", unit: "%RH", step: 1, min: 0, max: 100, hint: "Relative humidity under the dressing." },
  { key: "moisture", label: "Moisture", unit: "ADC", step: 10, min: 0, max: 4095, hint: "Raw reading from the capacitive moisture sensor, 0 to 4095." },
];

export function AdminSettings() {
  const { data } = useWorkspace();
  const rules = useQuery({ queryKey: ["rules"], queryFn: () => data.listAlertRules() });
  const global = rules.data?.find((r) => r.scope === "global");

  return (
    <>
      <PageHeader eyebrow="Platform" title="Settings" description="Alert thresholds for every facility, and your own workspace preferences." />
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <SectionTitle title="Global alert thresholds" meta={global ? `Updated ${formatDateTime(global.updatedAt)}` : undefined} />
          <div className="border-t border-(--line)">{global ? <ThresholdForm key={global.updatedAt} rule={global} /> : <SkeletonRows rows={3} />}</div>
        </Card>
        <div className="lg:col-span-5">
          <PreferencesCard />
        </div>
      </div>
    </>
  );
}

function ThresholdForm({ rule }: { rule: AlertRule }) {
  const canEdit = useCan("rules.configure");
  const [values, setValues] = useState<Record<keyof AlertThresholds, string>>({
    temperatureDelta: String(rule.temperatureDelta),
    humidity: String(rule.humidity),
    moisture: String(rule.moisture),
  });
  const save = useAction((d, t: AlertThresholds) => d.updateGlobalThresholds(t), {
    invalidate: ["rules", "audit", "series"],
    success: "Thresholds saved. New readings are checked against them.",
  });

  const parsed = Object.fromEntries(FIELDS.map((f) => [f.key, Number(values[f.key])])) as unknown as AlertThresholds;
  const errors = Object.fromEntries(
    FIELDS.map((f) => {
      const v = parsed[f.key];
      return [f.key, values[f.key].trim() === "" || Number.isNaN(v) ? "Enter a number" : v < f.min || v > f.max ? `Between ${f.min} and ${f.max}` : null];
    }),
  ) as Record<keyof AlertThresholds, string | null>;
  const dirty = FIELDS.some((f) => parsed[f.key] !== rule[f.key]);
  const valid = FIELDS.every((f) => !errors[f.key]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && dirty) save.mutate(parsed);
  };

  return (
    <form onSubmit={submit} className="space-y-5 p-5">
      <p className="text-small text-graphite-300">An indicator opens when a reading crosses one of these. They prompt a review; they do not diagnose. Per-patient rules override them.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} error={dirty ? errors[f.key] : null}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                step={f.step}
                min={f.min}
                max={f.max}
                value={values[f.key]}
                disabled={!canEdit}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                trailing={<span className="font-mono text-[11px] text-graphite-400">{f.unit}</span>}
                className="tabular font-mono"
              />
            )}
          </Field>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-(--line) pt-4">
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setValues({ temperatureDelta: String(rule.temperatureDelta), humidity: String(rule.humidity), moisture: String(rule.moisture) })}
          >
            Reset
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={!canEdit || !dirty || !valid} loading={save.isPending}>
          Save thresholds
        </Button>
      </div>
    </form>
  );
}
