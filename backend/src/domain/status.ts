export type LinkStatus = "normal" | "connected" | "watch" | "attention" | "offline" | "syncing";

export type IndicatorPresentation = {
  status: "normal" | "watch" | "attention" | "offline" | "syncing";
  led: "green" | "yellow" | "red" | "off";
  buzzer: boolean;
  label: string;
};

/**
 * ESP32 breadboard indication. Green is normal or connected.
 * Yellow is watch or sync pending. Red and the buzzer mean a configured
 * indicator threshold was crossed. This is not an infection signal.
 */
export function presentStatus(status: LinkStatus): IndicatorPresentation {
  switch (status) {
    case "attention":
      return {
        status: "attention",
        led: "red",
        buzzer: true,
        label: "Attention. A configured monitoring indicator changed. Clinical review is recommended. This is not a diagnosis.",
      };
    case "watch":
      return {
        status: "watch",
        led: "yellow",
        buzzer: false,
        label: "Watch. A predefined monitoring change was observed. This is not a diagnosis.",
      };
    case "syncing":
      return {
        status: "syncing",
        led: "yellow",
        buzzer: false,
        label: "Syncing. Stored readings are waiting to upload.",
      };
    case "offline":
      return {
        status: "offline",
        led: "off",
        buzzer: false,
        label: "Offline. The dressing monitor has not synchronized recently.",
      };
    case "normal":
    case "connected":
      return {
        status: status === "connected" ? "normal" : "normal",
        led: "green",
        buzzer: false,
        label: "Normal operation. The simulated dressing monitor is connected.",
      };
  }
}

export function rollupStatus(input: {
  deviceStatus: LinkStatus | null;
  openSeverities: Array<"info" | "watch" | "attention">;
}): LinkStatus {
  if (input.deviceStatus === "offline") return "offline";
  if (input.deviceStatus === "syncing") return "syncing";
  if (input.openSeverities.includes("attention") || input.deviceStatus === "attention") return "attention";
  if (
    input.openSeverities.includes("watch") ||
    input.openSeverities.includes("info") ||
    input.deviceStatus === "watch"
  ) {
    return "watch";
  }
  return input.deviceStatus === "connected" || input.deviceStatus === "normal" ? "normal" : "normal";
}
