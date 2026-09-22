"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Download, FileText, Printer } from "lucide-react";
import { cn } from "@/utils/cn";
import { REPORT_TYPE_META } from "@/lib/domain/labels";
import { BEZIER, DURATION } from "@/lib/motion/tokens";
import { formatDate, formatRelative } from "@/utils/format";
import { toast } from "@/stores/toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useAction, useWorkspace } from "@/features/dashboard/context";
import { PageHeader, SectionTitle } from "@/features/dashboard/PageHeader";
import type { ReportFormat, ReportRecord, ReportRequest, ReportType } from "@/types/domain";
import { exportReport } from "./export";

const CLINICAL: ReportType[] = ["patient_summary", "session_summary", "indicator_log"];
const ADMIN: ReportType[] = ["indicator_log", "device_health", "facility_activity", "audit_export", "patient_summary"];
const NEEDS_PATIENT: ReportType[] = ["patient_summary", "session_summary"];

export function ReportsView() {
  const { data, viewer } = useWorkspace();
  const types = viewer.role === "admin" ? ADMIN : CLINICAL;
  const reports = useQuery({ queryKey: ["reports"], queryFn: () => data.listReports() });
  const patients = useQuery({ queryKey: ["patients"], queryFn: () => data.listPatients() });
  const [type, setType] = useState<ReportType>(types[0]);
  const [format, setFormat] = useState<ReportFormat>("csv");
  const [days, setDays] = useState<"7" | "30" | "90">("7");
  const [patientId, setPatientId] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);

  const request = useAction((d, input: ReportRequest) => d.requestReport(input), {
    invalidate: ["reports"],
    success: "Report queued. It will be ready in a moment.",
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const end = new Date();
    const start = new Date(end.getTime() - Number(days) * 86_400_000);
    const needsPatient = NEEDS_PATIENT.includes(type);
    request.mutate({
      reportType: type,
      format,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      patientId: needsPatient ? patientId || patients.data?.[0]?.id || null : null,
    });
  };

  const download = async (r: ReportRecord) => {
    setExporting(r.id);
    try {
      const rows = await exportReport(r, data);
      toast.success(r.format === "csv" ? "CSV downloaded" : "Print view opened", `${rows} rows`);
    } catch (err) {
      toast.error("Export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Export"
        title="Reports"
        description="Build a report from the monitoring record. CSV opens in any spreadsheet; PDF opens a print view you can save."
      />
      <div className="grid items-start gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <SectionTitle title="New report" />
          <form onSubmit={submit} className="space-y-5 border-t border-(--line) p-5">
            <fieldset>
              <legend className="mb-2 text-small font-medium text-graphite-100">Report</legend>
              <div className="space-y-2">
                {types.map((t) => (
                  <label
                    key={t}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-md border p-3.5 transition-colors duration-(--dur-micro)",
                      type === t ? "border-signal/40 bg-signal/[0.05]" : "border-(--line) hover:border-(--line-strong)",
                    )}
                  >
                    <input type="radio" name="report-type" value={t} checked={type === t} onChange={() => setType(t)} className="mt-1 accent-(--color-signal)" />
                    <span>
                      <span className="block text-small font-medium text-bone">{REPORT_TYPE_META[t].label}</span>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-graphite-400">{REPORT_TYPE_META[t].description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <AnimatePresence initial={false}>
              {NEEDS_PATIENT.includes(type) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: DURATION.standardFast, ease: BEZIER.outExpo }} className="overflow-hidden">
                  <Field label="Patient">
                    {({ id }) => (
                      <Select id={id} value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                        {(patients.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.fullName}
                            {p.roomLabel ? ` · ${p.roomLabel}` : ""}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-small font-medium text-graphite-100">Period</p>
                <Segmented
                  label="Period"
                  size="md"
                  value={days}
                  onChange={setDays}
                  options={[
                    { value: "7", label: "7 days" },
                    { value: "30", label: "30 days" },
                    { value: "90", label: "90 days" },
                  ]}
                />
              </div>
              <div>
                <p className="mb-2 text-small font-medium text-graphite-100">Format</p>
                <Segmented
                  label="Format"
                  size="md"
                  value={format}
                  onChange={setFormat}
                  options={[
                    { value: "csv", label: "CSV" },
                    { value: "pdf", label: "PDF" },
                  ]}
                />
              </div>
            </div>
            <Button type="submit" variant="primary" className="w-full" loading={request.isPending} iconLeft={<FileText className="size-4" />}>
              Generate report
            </Button>
          </form>
        </Card>

        <Card className="lg:col-span-7">
          <SectionTitle title={viewer.role === "admin" ? "All reports" : "Your reports"} meta={reports.data ? `${reports.data.length}` : undefined} />
          {reports.error ? (
            <ErrorState error={reports.error} onRetry={() => reports.refetch()} />
          ) : !reports.data ? (
            <SkeletonRows rows={4} />
          ) : reports.data.length === 0 ? (
            <EmptyState icon={<FileText />} title="No reports yet" body="Generated reports stay here so the team can download them again." />
          ) : (
            <ul className="divide-y divide-(--line) border-t border-(--line)">
              <AnimatePresence initial={false}>
                {reports.data.map((r) => (
                  <motion.li
                    key={r.id}
                    layout="position"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: DURATION.standard, ease: BEZIER.outExpo }}
                    className="flex flex-wrap items-center gap-4 px-5 py-4"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-(--line) font-mono text-[10px] uppercase text-graphite-300">{r.format}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small font-medium text-bone">{REPORT_TYPE_META[r.reportType].label}</p>
                      <p className="truncate text-[12px] text-graphite-400">
                        {r.patient && <>{r.patient.name} · </>}
                        {formatDate(r.periodStart)} – {formatDate(r.periodEnd)} · {r.createdBy.name} · {formatRelative(r.createdAt)}
                      </p>
                    </div>
                    {r.status === "queued" ? (
                      <span className="flex items-center gap-2 text-small text-graphite-300">
                        <Spinner className="size-3.5 text-signal" /> Preparing
                      </span>
                    ) : r.status === "failed" ? (
                      <Badge tone="critical">Failed</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={exporting === r.id}
                        iconLeft={r.format === "csv" ? <Download className="size-3.5" /> : <Printer className="size-3.5" />}
                        onClick={() => download(r)}
                      >
                        {r.format === "csv" ? "Download" : "Print"}
                      </Button>
                    )}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
