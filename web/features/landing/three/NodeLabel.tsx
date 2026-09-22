"use client";

import { Html } from "@react-three/drei";
import { useNow } from "@/hooks/use-now";
import { showcaseSample, showcaseTime } from "../data/showcase";

type LabelMetric = "temp" | "humidity" | "moisture" | "link";

const META: Record<LabelMetric, { sensor: string; unit: string }> = {
  temp: { sensor: "DS18B20", unit: "°C" },
  humidity: { sensor: "BME280", unit: "%RH" },
  moisture: { sensor: "Electrodes", unit: "ADC" },
  link: { sensor: "ESP32", unit: "" },
};

function valueFor(metric: LabelMetric, now: number | null) {
  if (now == null) return "--";
  const s = showcaseSample(showcaseTime(now));
  if (metric === "temp") return s.localizedTemperatureC?.toFixed(1) ?? "--";
  if (metric === "humidity") return s.humidityPercent?.toFixed(1) ?? "--";
  if (metric === "moisture") return String(s.relativeMoistureValue ?? "--");
  return "BLE";
}

/** Telemetry marker pinned to a sensor. Screen-space so text stays crisp. */
export function NodeLabel({ position, metric }: { position: [number, number, number]; metric: LabelMetric }) {
  const now = useNow(1000);
  const meta = META[metric];
  return (
    <Html position={position} center={false} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="flex -translate-y-full items-end gap-2 whitespace-nowrap pb-1 font-mono text-[10px] uppercase tracking-[0.14em]">
        <span aria-hidden className="mb-[-4px] block h-7 w-px bg-linear-to-t from-signal/70 to-transparent" />
        <span className="rounded-sm border border-(--line-strong) bg-graphite-950/70 px-2 py-1 text-graphite-200 backdrop-blur-sm">
          <span className="text-graphite-400">{meta.sensor}</span>{" "}
          <span className="tabular text-bone">{valueFor(metric, now)}</span>
          {meta.unit && <span className="text-graphite-400"> {meta.unit}</span>}
        </span>
      </div>
    </Html>
  );
}
