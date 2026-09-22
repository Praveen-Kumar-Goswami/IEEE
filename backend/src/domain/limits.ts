/** Bounds shared by the phone, the ESP32 packet, and the database checks. */
export const LIMITS = {
  batchMax: 100,
  localizedTempMin: -55,
  localizedTempMax: 125,
  ambientTempMin: -40,
  ambientTempMax: 85,
  humidityMin: 0,
  humidityMax: 100,
  moistureMin: 0,
  moistureMax: 4095,
  batteryMin: 0,
  batteryMax: 100,
  sequenceMin: 0,
  sequenceMax: 1_000_000,
  futureSkewMs: 5 * 60 * 1000,
  sessionSkewMs: 5 * 60 * 1000,
  offlineWindowMs: 90 * 24 * 60 * 60 * 1000,
  syncDelayMs: 30 * 60 * 1000,
  pageDefault: 50,
  pageMax: 200,
  bodyMaxChars: 1_000_000,
} as const;

export const DISCLAIMER =
  "Monitoring indicators from a simulated dressing only. They are not a diagnosis and do not replace clinical review.";
