# Hardware

Breadboard prototype for a simulated dressing. All parts below are the parts on hand.

| Part | Quantity | Role |
| --- | --- | --- |
| ESP32 DevKit V1, ESP32-WROOM-32 | 1 | Controller and BLE radio |
| BME280 | 1 | Ambient temperature and humidity |
| DS18B20 waterproof probe, 1 m | 1 | Localized temperature |
| Copper tape, about 5 mm | 1 roll | Relative moisture electrodes |
| 10 kΩ resistor | 3–5 | Moisture divider |
| 4.7 kΩ resistor | 3–5 | DS18B20 pull-up |
| 220 Ω resistor | 5 | LED current limit |
| Green LED, 5 mm | 1 | Normal operation or connected |
| Yellow LED, 5 mm | 1 | Watch, or sync still pending |
| Red LED, 5 mm | 1 | Configured indicator threshold crossed |
| Active buzzer module | 1 | Same condition as the red LED |
| 6 × 6 mm tactile button | 2 | Acknowledge local indication; start, stop, or pair |
| Solderless breadboard | 1 | Assembly |
| Dupont jumper set | 1 | Wiring |
| USB data cable | 1 | Power and serial |

Suggested 3.3 V wiring:

- DS18B20 data to GPIO 4, with 4.7 kΩ from data to 3.3 V
- BME280 SDA GPIO 21, SCL GPIO 22, powered at 3.3 V
- Copper-tape divider into GPIO 34, an ADC1 input, using 10 kΩ
- Green LED GPIO 25, yellow GPIO 26, red GPIO 27, each through 220 Ω
- Active buzzer GPIO 13
- Acknowledge button GPIO 32 and session button GPIO 33, both `INPUT_PULLUP` to ground

`relative_moisture_value` is the 12-bit ADC count, 0 to 4095. A demonstration threshold of 350 is configuration, not a clinical moisture scale.

BLE packet the phone stores in SQLite:

```json
{
  "deviceId": "ESP32-001",
  "sequence": 120,
  "capturedAt": "2026-09-22T10:30:00Z",
  "localizedTemperatureC": 36.8,
  "ambientTemperatureC": 28.2,
  "humidityPercent": 65.4,
  "relativeMoistureValue": 412,
  "deviceStatus": "connected"
}
```

`deviceId` is `devices.serial_number`. The phone adds its own `client_reading_id` before upload.
