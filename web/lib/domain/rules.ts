import type { AlertSeverity, AlertThresholds, AlertType, ReadingSample } from "@/types/domain";
import { mean } from "@/utils/math";

/** Global demonstration rule seeded in the database (alert_rules a1111111-…). */
export const GLOBAL_THRESHOLDS: AlertThresholds = { temperatureDelta: 1.0, humidity: 80, moisture: 350 };

export const REVIEW_SUFFIX = "This is a monitoring indicator requiring clinical review, not a diagnosis.";

export interface IndicatorDraft {
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
}

/**
 * Same rules as backend/src/domain/alerts.ts: temperature against the session mean,
 * humidity and moisture against absolute thresholds, offline from device status.
 */
export function evaluateSample(
  sample: ReadingSample,
  sessionHistory: number[],
  thresholds: AlertThresholds = GLOBAL_THRESHOLDS,
): IndicatorDraft[] {
  const drafts: IndicatorDraft[] = [];
  const baseline = sessionHistory.length > 0 ? mean(sessionHistory) : null;

  if (
    sample.localizedTemperatureC != null &&
    baseline != null &&
    Math.abs(sample.localizedTemperatureC - baseline) >= thresholds.temperatureDelta
  ) {
    drafts.push({
      alertType: "elevated_temperature",
      severity: "watch",
      message: `Localized temperature trend changed from baseline. Review is recommended. ${REVIEW_SUFFIX}`,
    });
  }
  if (sample.humidityPercent != null && sample.humidityPercent >= thresholds.humidity) {
    drafts.push({
      alertType: "humidity_change",
      severity: "watch",
      message: `Ambient humidity indicator is above the configured monitoring threshold. ${REVIEW_SUFFIX}`,
    });
  }
  if (sample.relativeMoistureValue != null && sample.relativeMoistureValue >= thresholds.moisture) {
    drafts.push({
      alertType: "moisture_change",
      severity: "attention",
      message: `Relative moisture indicator is above the configured monitoring threshold. ${REVIEW_SUFFIX}`,
    });
  }
  if (sample.deviceStatus === "offline") {
    drafts.push({
      alertType: "device_offline",
      severity: "watch",
      message: `Device status is offline. Review is recommended. ${REVIEW_SUFFIX}`,
    });
  }
  return drafts;
}

const BLOCKED_WORDING = [/infection detected/i, /diagnosed/i];

/** The database rejects notes with diagnosis wording; check before sending. */
export function checkClinicalWording(text: string): string | null {
  if (BLOCKED_WORDING.some((pattern) => pattern.test(text))) {
    return "Notes describe indicators, not diagnoses. Remove “diagnosed” or “infection detected”.";
  }
  return null;
}
