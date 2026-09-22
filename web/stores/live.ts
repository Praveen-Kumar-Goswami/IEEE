"use client";

import { create } from "zustand";
import type { DeviceHealth, ReadingSample, SeriesPoint } from "@/types/domain";
import type { ConnectionState } from "@/services/realtime/types";

/** Readings kept per patient for live charts: about 30 minutes at one sample every 5 s. */
const TRAIL_LENGTH = 360;

interface LiveState {
  connection: ConnectionState;
  latest: Record<string, ReadingSample>;
  trail: Record<string, SeriesPoint[]>;
  deviceHealth: Record<string, DeviceHealth>;
  lastEventAt: number | null;
  setConnection: (state: ConnectionState) => void;
  pushReading: (patientId: string, reading: ReadingSample) => void;
  setDeviceHealth: (deviceId: string, health: DeviceHealth) => void;
  reset: () => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  connection: "connecting",
  latest: {},
  trail: {},
  deviceHealth: {},
  lastEventAt: null,
  setConnection: (connection) => set({ connection }),
  pushReading: (patientId, reading) =>
    set((s) => {
      const point: SeriesPoint = {
        t: Date.parse(reading.capturedAt),
        localizedTemperatureC: reading.localizedTemperatureC,
        ambientTemperatureC: reading.ambientTemperatureC,
        humidityPercent: reading.humidityPercent,
        relativeMoistureValue: reading.relativeMoistureValue,
      };
      const trail = [...(s.trail[patientId] ?? []), point].slice(-TRAIL_LENGTH);
      return { latest: { ...s.latest, [patientId]: reading }, trail: { ...s.trail, [patientId]: trail }, lastEventAt: Date.now() };
    }),
  setDeviceHealth: (deviceId, health) => set((s) => ({ deviceHealth: { ...s.deviceHealth, [deviceId]: health }, lastEventAt: Date.now() })),
  reset: () => set({ connection: "connecting", latest: {}, trail: {}, deviceHealth: {}, lastEventAt: null }),
}));
