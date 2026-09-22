/**
 * Boundary between the ESP32 firmware, the Flutter app, and this API.
 *
 * The ESP32 DevKit V1 (ESP32-WROOM-32) advertises this JSON over BLE.
 * The phone stores it in SQLite and later posts it to POST /v1/mobile/sync/readings.
 * deviceId is devices.serial_number, not the database UUID.
 * relativeMoistureValue is a copper-tape ADC count from 0 to 4095.
 *
 * Suggested breadboard map, 3.3 V logic:
 * - DS18B20 data: GPIO 4, 4.7 kΩ pull-up to 3.3 V
 * - BME280 I2C: SDA GPIO 21, SCL GPIO 22
 * - Copper-tape divider: GPIO 34 (ADC1), 10 kΩ
 * - Green LED: GPIO 25 through 220 Ω
 * - Yellow LED: GPIO 26 through 220 Ω
 * - Red LED: GPIO 27 through 220 Ω
 * - Active buzzer: GPIO 13
 * - Acknowledge button: GPIO 32, INPUT_PULLUP
 * - Session or pair button: GPIO 33, INPUT_PULLUP
 *
 * Green: normal operating or connected.
 * Yellow: watch, or sync still pending on the phone.
 * Red and buzzer: a configured indicator threshold was crossed.
 * Buttons: acknowledge the local indication, and start/stop or pair a session.
 */
export type BlePacket = {
  deviceId: string;
  sequence: number;
  capturedAt: string;
  localizedTemperatureC: number;
  ambientTemperatureC: number;
  humidityPercent: number;
  relativeMoistureValue: number;
  deviceStatus: "connected" | "normal" | "watch" | "attention" | "offline" | "syncing";
};

export const exampleBlePacket: BlePacket = {
  deviceId: "ESP32-001",
  sequence: 120,
  capturedAt: "2026-09-22T10:30:00Z",
  localizedTemperatureC: 36.8,
  ambientTemperatureC: 28.2,
  humidityPercent: 65.4,
  relativeMoistureValue: 412,
  deviceStatus: "connected",
};
