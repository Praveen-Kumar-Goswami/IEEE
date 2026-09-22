import { describe, expect, it } from "vitest";
import { presentStatus, rollupStatus } from "../src/domain/status.js";

describe("hardware indication", () => {
  it("maps connected operation to the green LED", () => {
    expect(presentStatus("connected")).toMatchObject({ led: "green", buzzer: false, status: "normal" });
  });

  it("maps watch and syncing to the yellow LED", () => {
    expect(presentStatus("watch").led).toBe("yellow");
    expect(presentStatus("syncing").led).toBe("yellow");
  });

  it("maps a threshold crossing to the red LED and buzzer", () => {
    const indication = presentStatus("attention");
    expect(indication.led).toBe("red");
    expect(indication.buzzer).toBe(true);
    expect(indication.label).toMatch(/not a diagnosis/i);
  });

  it("raises the summary to attention when an open indicator is attention", () => {
    expect(rollupStatus({ deviceStatus: "connected", openSeverities: ["attention"] })).toBe("attention");
  });
});
