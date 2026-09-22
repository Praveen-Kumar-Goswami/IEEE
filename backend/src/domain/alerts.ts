export type AlertType =
  | "elevated_temperature"
  | "humidity_change"
  | "moisture_change"
  | "device_offline"
  | "sync_issue";

export type Severity = "info" | "watch" | "attention";
export type RuleScope = "global" | "device" | "patient";

export type AlertRule = {
  id: string;
  scope: RuleScope;
  patientId: string | null;
  deviceId: string | null;
  temperatureDeltaThreshold: number | null;
  humidityThreshold: number | null;
  moistureThreshold: number | null;
  enabled: boolean;
};

export type Sample = {
  id: string;
  clientReadingId: string;
  capturedAt: Date;
  localizedTemperatureC: number | null;
  ambientTemperatureC: number | null;
  humidityPercent: number | null;
  relativeMoistureValue: number | null;
  deviceStatus: string;
};

export type AlertDraft = {
  patientId: string;
  deviceId: string;
  sessionId: string;
  readingId: string;
  alertRuleId: string | null;
  alertType: AlertType;
  severity: Severity;
  message: string;
  dedupeKey: string;
};

const REVIEW =
  "This is a monitoring indicator requiring clinical review, not a diagnosis.";

export function rulesFor(rules: AlertRule[], patientId: string, deviceId: string): AlertRule[] {
  const specific = rules.filter(
    (rule) =>
      rule.enabled &&
      ((rule.scope === "patient" && rule.patientId === patientId) ||
        (rule.scope === "device" && rule.deviceId === deviceId)),
  );
  if (specific.length > 0) return specific.sort((a, b) => a.id.localeCompare(b.id));
  return rules
    .filter((rule) => rule.enabled && rule.scope === "global")
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function dedupeKey(ruleId: string, alertType: AlertType): string {
  return `${ruleId}:${alertType}`;
}

function baselineTemperature(history: Sample[]): number | null {
  const values = history
    .filter((item) => item.localizedTemperatureC != null)
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  if (values.length === 0) return null;
  const total = values.reduce((sum, item) => sum + (item.localizedTemperatureC ?? 0), 0);
  return total / values.length;
}

function safeMessage(message: string): string | null {
  if (/infection detected/i.test(message) || /diagnosed/i.test(message)) return null;
  if (!/monitoring indicator/i.test(message)) return null;
  return message;
}

export function evaluateNewAlerts(input: {
  rules: AlertRule[];
  patientId: string;
  deviceId: string;
  sessionId: string;
  accepted: Sample[];
  history: Sample[];
  activeKeys: Set<string>;
  now: Date;
  syncDelayMs: number;
}): AlertDraft[] {
  const rules = rulesFor(input.rules, input.patientId, input.deviceId);
  const accepted = input.accepted
    .slice()
    .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime() || a.id.localeCompare(b.id));
  const history = input.history.slice();
  const drafts: AlertDraft[] = [];

  const push = (draft: Omit<AlertDraft, "message"> & { message: string }) => {
    const message = safeMessage(draft.message);
    if (!message || input.activeKeys.has(draft.dedupeKey)) return;
    input.activeKeys.add(draft.dedupeKey);
    drafts.push({ ...draft, message });
  };

  for (const sample of accepted) {
    const baseline = baselineTemperature(history);
    for (const rule of rules) {
      if (
        sample.localizedTemperatureC != null &&
        baseline != null &&
        rule.temperatureDeltaThreshold != null &&
        Math.abs(sample.localizedTemperatureC - baseline) >= rule.temperatureDeltaThreshold
      ) {
        push({
          patientId: input.patientId,
          deviceId: input.deviceId,
          sessionId: input.sessionId,
          readingId: sample.id,
          alertRuleId: rule.id,
          alertType: "elevated_temperature",
          severity: "watch",
          dedupeKey: dedupeKey(rule.id, "elevated_temperature"),
          message: `Localized temperature trend changed from baseline. Review is recommended. ${REVIEW}`,
        });
      }
      if (
        sample.humidityPercent != null &&
        rule.humidityThreshold != null &&
        sample.humidityPercent >= rule.humidityThreshold
      ) {
        push({
          patientId: input.patientId,
          deviceId: input.deviceId,
          sessionId: input.sessionId,
          readingId: sample.id,
          alertRuleId: rule.id,
          alertType: "humidity_change",
          severity: "watch",
          dedupeKey: dedupeKey(rule.id, "humidity_change"),
          message: `Ambient humidity indicator is above the configured monitoring threshold. ${REVIEW}`,
        });
      }
      if (
        sample.relativeMoistureValue != null &&
        rule.moistureThreshold != null &&
        sample.relativeMoistureValue >= rule.moistureThreshold
      ) {
        push({
          patientId: input.patientId,
          deviceId: input.deviceId,
          sessionId: input.sessionId,
          readingId: sample.id,
          alertRuleId: rule.id,
          alertType: "moisture_change",
          severity: "attention",
          dedupeKey: dedupeKey(rule.id, "moisture_change"),
          message: `Relative moisture indicator is above the configured monitoring threshold. ${REVIEW}`,
        });
      }
    }
    if (sample.deviceStatus === "offline") {
      const key = "system:device_offline";
      push({
        patientId: input.patientId,
        deviceId: input.deviceId,
        sessionId: input.sessionId,
        readingId: sample.id,
        alertRuleId: null,
        alertType: "device_offline",
        severity: "watch",
        dedupeKey: key,
        message: `Device status is offline. Review is recommended. ${REVIEW}`,
      });
    }
    if (input.now.getTime() - sample.capturedAt.getTime() >= input.syncDelayMs) {
      push({
        patientId: input.patientId,
        deviceId: input.deviceId,
        sessionId: input.sessionId,
        readingId: sample.id,
        alertRuleId: null,
        alertType: "sync_issue",
        severity: "info",
        dedupeKey: "system:sync_issue",
        message: `Device has not synchronized recently. ${REVIEW}`,
      });
    }
    history.push(sample);
  }

  return drafts;
}
