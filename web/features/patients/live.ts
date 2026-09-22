"use client";

import { useLiveStore } from "@/stores/live";
import type { DeviceHealth, PatientSummary, ReadingSample, SeriesPoint } from "@/types/domain";

const EMPTY: SeriesPoint[] = [];

/** Latest reading for a patient: the realtime stream if it has reported, otherwise the last stored reading. */
export function useLatestReading(patient: Pick<PatientSummary, "id" | "latest"> | null | undefined): ReadingSample | null {
  const live = useLiveStore((s) => (patient ? s.latest[patient.id] : undefined));
  return live ?? patient?.latest ?? null;
}

export function useLiveTrail(patientId: string | null | undefined): SeriesPoint[] {
  return useLiveStore((s) => (patientId ? (s.trail[patientId] ?? EMPTY) : EMPTY));
}

export function useDeviceHealth(patient: Pick<PatientSummary, "device"> | null | undefined): DeviceHealth | null {
  const live = useLiveStore((s) => (patient?.device ? s.deviceHealth[patient.device.id] : undefined));
  return live ?? patient?.device?.health ?? null;
}
