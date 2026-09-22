#include <Adafruit_BME280.h>
#include <DallasTemperature.h>
#include <OneWire.h>
#include <Wire.h>

// Bench check for the wiring in docs/HARDWARE.md. Serial Monitor at 115200.
// Green LED on = sketch running. Hold acknowledge button = red LED + buzzer.
// Hold session button = yellow LED.
// Libraries: OneWire, DallasTemperature, Adafruit BME280, Adafruit Unified Sensor.

const int PIN_DS18B20 = 4;
const int PIN_SDA = 21;
const int PIN_SCL = 22;
const int PIN_MOISTURE = 34;
const int PIN_LED_GREEN = 25;
const int PIN_LED_YELLOW = 26;
const int PIN_LED_RED = 27;
const int PIN_BUZZER = 13;
const int PIN_BUTTON_ACK = 32;
const int PIN_BUTTON_SESSION = 33;

OneWire oneWire(PIN_DS18B20);
DallasTemperature probe(&oneWire);
Adafruit_BME280 bme;
bool bmeReady = false;

uint8_t readChipId(uint8_t address) {
  Wire.beginTransmission(address);
  Wire.write(0xD0);
  if (Wire.endTransmission(false) != 0) return 0;
  if (Wire.requestFrom((int)address, 1) != 1) return 0;
  return Wire.read();
}

void checkBme280() {
  Wire.begin(PIN_SDA, PIN_SCL);
  const uint8_t addresses[] = {0x76, 0x77};
  for (uint8_t address : addresses) {
    const uint8_t chipId = readChipId(address);
    if (chipId == 0) continue;
    Serial.printf("I2C sensor at 0x%02X, chip id 0x%02X", address, chipId);
    if (chipId == 0x60) {
      Serial.println(" (BME280)");
      bmeReady = bme.begin(address, &Wire);
    } else if (chipId == 0x58) {
      Serial.println(" (BMP280: temperature only, no humidity)");
    } else {
      Serial.println(" (unknown)");
    }
    return;
  }
  Serial.println("No BME280 on I2C. Check 3.3 V, GND, SDA 21, SCL 22.");
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nSmart dressing hardware test");

  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_BUTTON_ACK, INPUT_PULLUP);
  pinMode(PIN_BUTTON_SESSION, INPUT_PULLUP);
  analogReadResolution(12);

  const int leds[] = {PIN_LED_GREEN, PIN_LED_YELLOW, PIN_LED_RED};
  for (int pin : leds) {
    digitalWrite(pin, HIGH);
    delay(400);
    digitalWrite(pin, LOW);
  }
  digitalWrite(PIN_BUZZER, HIGH);
  delay(300);
  digitalWrite(PIN_BUZZER, LOW);

  checkBme280();

  probe.begin();
  Serial.printf("DS18B20 probes found: %d\n", probe.getDeviceCount());
  probe.setWaitForConversion(false);
  probe.requestTemperatures();

  digitalWrite(PIN_LED_GREEN, HIGH);
}

void loop() {
  const bool ackDown = digitalRead(PIN_BUTTON_ACK) == LOW;
  const bool sessionDown = digitalRead(PIN_BUTTON_SESSION) == LOW;
  digitalWrite(PIN_LED_RED, ackDown);
  digitalWrite(PIN_BUZZER, ackDown);
  digitalWrite(PIN_LED_YELLOW, sessionDown);

  static uint32_t lastPrint = 0;
  if (millis() - lastPrint < 1000) {
    delay(20);
    return;
  }
  lastPrint = millis();

  const float probeC = probe.getTempCByIndex(0);
  probe.requestTemperatures();

  if (probeC == DEVICE_DISCONNECTED_C) {
    Serial.print("probe MISSING | ");
  } else {
    Serial.printf("probe %.2f C | ", probeC);
  }
  if (bmeReady) {
    Serial.printf("ambient %.2f C, humidity %.1f %% | ", bme.readTemperature(), bme.readHumidity());
  } else {
    Serial.print("BME280 MISSING | ");
  }
  Serial.printf("moisture ADC %d | ack %s | session %s\n",
                analogRead(PIN_MOISTURE),
                ackDown ? "DOWN" : "up",
                sessionDown ? "DOWN" : "up");
}
