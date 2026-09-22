import { ALERT_TYPE_LABEL, REPORT_TYPE_META } from "@/lib/domain/labels";
import { BRAND } from "@/lib/brand";
import { downloadText, toCsv } from "@/utils/csv";
import { formatDate } from "@/utils/format";
import type { DataService } from "@/services/data/types";
import type { ReportRecord, TimeRange } from "@/types/domain";

type Cell = string | number | boolean | null;
interface Table {
  columns: { key: string; label: string }[];
  rows: Record<string, Cell>[];
}

const iso = (t: number | string) => new Date(t).toISOString();
const within = (at: string, r: ReportRecord) => at >= r.periodStart && at <= r.periodEnd;

function rangeFor(r: ReportRecord): TimeRange {
  const days = (Date.parse(r.periodEnd) - Date.parse(r.periodStart)) / 86_400_000;
  return days <= 1 ? "24H" : days <= 7 ? "7D" : "30D";
}

/** Builds the report body from the same data service the dashboards use, so exports respect row level security. */
async function build(r: ReportRecord, data: DataService): Promise<Table> {
  switch (r.reportType) {
    case "patient_summary":
    case "session_summary": {
      if (!r.patient) throw new Error("This report needs a patient.");
      const series = await data.getSeries(r.patient.id, rangeFor(r));
      return {
        columns: [
          { key: "time", label: "Time (UTC)" },
          { key: "temp", label: "Localized temperature (°C)" },
          { key: "ambient", label: "Ambient temperature (°C)" },
          { key: "humidity", label: "Humidity (%RH)" },
          { key: "moisture", label: "Relative moisture (ADC)" },
        ],
        rows: series.points.map((p) => ({
          time: iso(p.t),
          temp: p.localizedTemperatureC?.toFixed(2) ?? null,
          ambient: p.ambientTemperatureC?.toFixed(2) ?? null,
          humidity: p.humidityPercent?.toFixed(1) ?? null,
          moisture: p.relativeMoistureValue != null ? Math.round(p.relativeMoistureValue) : null,
        })),
      };
    }
    case "indicator_log": {
      const alerts = (await data.listAlerts(r.patient ? { patientId: r.patient.id } : undefined)).filter((a) => within(a.createdAt, r));
      return {
        columns: [
          { key: "opened", label: "Opened (UTC)" },
          { key: "patient", label: "Patient" },
          { key: "room", label: "Room" },
          { key: "indicator", label: "Indicator" },
          { key: "severity", label: "Severity" },
          { key: "status", label: "Status" },
          { key: "ackBy", label: "Acknowledged by" },
          { key: "ackMin", label: "Minutes to acknowledge" },
        ],
        rows: alerts.map((a) => ({
          opened: a.createdAt,
          patient: a.patientName,
          room: a.roomLabel,
          indicator: ALERT_TYPE_LABEL[a.alertType],
          severity: a.severity,
          status: a.status,
          ackBy: a.acknowledgedBy?.name ?? null,
          ackMin: a.acknowledgedAt ? Math.round((Date.parse(a.acknowledgedAt) - Date.parse(a.createdAt)) / 60_000) : null,
        })),
      };
    }
    case "device_health": {
      const devices = await data.listDevices();
      return {
        columns: [
          { key: "serial", label: "Serial" },
          { key: "patient", label: "Patient" },
          { key: "health", label: "Health" },
          { key: "battery", label: "Battery (%)" },
          { key: "sync", label: "Last sync (UTC)" },
          { key: "firmware", label: "Firmware" },
        ],
        rows: devices.map((d) => ({ serial: d.serial, patient: d.patient?.name ?? null, health: d.health, battery: d.batteryPercent, sync: d.lastSyncAt, firmware: d.firmware })),
      };
    }
    case "audit_export": {
      const entries = await data.listAuditLogs({ since: r.periodStart, limit: 5000 });
      return {
        columns: [
          { key: "at", label: "Time (UTC)" },
          { key: "actor", label: "Actor" },
          { key: "role", label: "Role" },
          { key: "action", label: "Action" },
          { key: "entity", label: "Entity" },
          { key: "result", label: "Result" },
        ],
        rows: entries.filter((e) => within(e.createdAt, r)).map((e) => ({ at: e.createdAt, actor: e.actor?.name ?? "system", role: e.actor?.role ?? null, action: e.action, entity: e.entityType, result: e.result })),
      };
    }
    case "facility_activity": {
      const facilities = await data.listFacilities();
      return {
        columns: [
          { key: "name", label: "Facility" },
          { key: "code", label: "Code" },
          { key: "patients", label: "Patients" },
          { key: "staff", label: "Staff" },
          { key: "devices", label: "Devices" },
          { key: "alerts", label: "Open indicators" },
        ],
        rows: facilities.map((f) => ({ name: f.name, code: f.code, patients: f.patientCount, staff: f.staffCount, devices: f.deviceCount, alerts: f.openAlertCount })),
      };
    }
  }
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function printTable(title: string, subtitle: string, table: Table) {
  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) throw new Error("Allow pop-ups for this site to print the report.");
  const head = table.columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
  const body = table.rows
    .map((r) => `<tr>${table.columns.map((c) => `<td>${escapeHtml(String(r[c.key] ?? ""))}</td>`).join("")}</tr>`)
    .join("");
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    body{font:12px/1.5 ui-sans-serif,system-ui,sans-serif;color:#111;margin:32px}
    h1{font-size:20px;font-weight:500;margin:0 0 4px}p{color:#555;margin:0 0 20px}
    table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;font-variant-numeric:tabular-nums}
    th{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#555}
    footer{margin-top:24px;font-size:10px;color:#777}
  </style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  <footer>${escapeHtml(BRAND.name)} · ${escapeHtml(BRAND.disclaimer)}</footer></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export async function exportReport(r: ReportRecord, data: DataService) {
  const table = await build(r, data);
  const meta = REPORT_TYPE_META[r.reportType];
  const period = `${formatDate(r.periodStart, "long")} – ${formatDate(r.periodEnd, "long")}`;
  const slug = `${r.reportType}-${r.periodStart.slice(0, 10)}-${r.periodEnd.slice(0, 10)}${r.patient ? `-${r.patient.name.toLowerCase().replace(/\s+/g, "-")}` : ""}`;
  if (r.format === "csv") {
    downloadText(`${slug}.csv`, toCsv(table.rows, table.columns as { key: string; label: string }[]));
  } else {
    printTable(meta.label, `${r.patient ? `${r.patient.name} · ` : ""}${period} · ${table.rows.length} rows`, table);
  }
  return table.rows.length;
}
