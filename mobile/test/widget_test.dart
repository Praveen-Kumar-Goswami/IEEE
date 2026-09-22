import "package:flutter_test/flutter_test.dart";
import "package:smart_dressing/ble_packet.dart";
import "package:smart_dressing/indicators.dart";
import "package:smart_dressing/reading_store.dart";

void main() {
  test("parses an ESP32 BLE packet", () {
    final packet = parseBlePayload(
      '{"deviceId":"ESP32-001","sequence":120,"capturedAt":"2026-09-22T10:30:00Z","localizedTemperatureC":36.8,"ambientTemperatureC":28.2,"humidityPercent":65.4,"relativeMoistureValue":412,"deviceStatus":"connected"}',
    );
    expect(packet?.deviceId, "ESP32-001");
    expect(packet?.relativeMoistureValue, 412);
  });

  test("flags a temperature change against earlier readings", () {
    final alerts = localIndicators(
      recent: [
        _reading(temp: 38.4, humidity: 60, moisture: 100, at: "2026-09-22T10:32:00Z"),
        _reading(temp: 36.5, humidity: 60, moisture: 100, at: "2026-09-22T10:31:00Z"),
        _reading(temp: 36.4, humidity: 60, moisture: 100, at: "2026-09-22T10:30:00Z"),
      ],
      temperatureDelta: 1,
      humidityLimit: 80,
      moistureLimit: 350,
    );
    expect(alerts.map((item) => item.type), ["elevated_temperature"]);
  });

  test("flags humidity and moisture at the saved thresholds", () {
    final alerts = localIndicators(
      recent: [_reading(temp: 36.6, humidity: 81, moisture: 360, at: "2026-09-22T10:30:00Z")],
      temperatureDelta: 1,
      humidityLimit: 80,
      moistureLimit: 350,
    );
    expect(alerts.map((item) => item.type), ["humidity_change", "moisture_change"]);
  });
}

StoredReading _reading({required double temp, required double humidity, required int moisture, required String at}) {
  return StoredReading(
    clientReadingId: "id",
    sessionId: "session",
    deviceSerial: "ESP32-001",
    sequence: 1,
    capturedAt: at,
    localizedTemperatureC: temp,
    ambientTemperatureC: 28,
    humidityPercent: humidity,
    relativeMoistureValue: moisture,
    deviceStatus: "connected",
    syncStatus: "pending",
  );
}
