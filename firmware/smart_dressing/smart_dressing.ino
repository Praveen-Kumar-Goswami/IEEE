#include <Adafruit_BME280.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <DallasTemperature.h>
#include <OneWire.h>
#include <WiFi.h>
#include <Wire.h>
#include <time.h>

// Phone flow: Bluetooth scan and connect, then Wi-Fi for the reading stream.
// Advertised name is the device serial. Port 8080 sends one JSON reading per line.
// Wiring follows docs/HARDWARE.md.
// Libraries: OneWire, DallasTemperature, Adafruit BME280, Adafruit Unified Sensor.
// Bluetooth plus Wi-Fi does not fit the default flash layout. Pick
// Tools > Partition Scheme > "Huge APP (3MB No OTA/1MB SPIFFS)".
//
// Green: normal, steady with a phone linked, blinking while waiting for one.
// Yellow: humidity watch. Blinking yellow: monitoring paused.
// Red with beeps: attention. Blinking red: a sensor is not answering.
// Acknowledge button silences the beeps until the attention condition clears.
// Session button pauses monitoring. Resuming starts a fresh temperature baseline.

enum Level { LEVEL_NORMAL, LEVEL_WATCH, LEVEL_ATTENTION };

struct Reading {
  float localizedC;
  float ambientC;
  float humidity;
  int moisture;
  bool valid;
};

struct Button {
  int pin;
  bool down;
  uint32_t changedAt;
};

static const char *DEVICE_ID = "ESP32-001";
static const char *SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *RX_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";
static const char *TX_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E";

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

// Set to true if the buzzer sounds whenever it should be quiet.
const bool BUZZER_ACTIVE_LOW = false;

// Same demonstration defaults as the phone app. Not clinical cutoffs.
const float TEMPERATURE_DELTA_C = 1.0;
const float HUMIDITY_WATCH_PERCENT = 80.0;
const int MOISTURE_ATTENTION_COUNT = 350;

const uint32_t READ_INTERVAL_MS = 1000;
const uint32_t WIFI_JOIN_TIMEOUT_MS = 15000;
const uint32_t SEQUENCE_MAX = 1000000;
// 20 bytes fits the smallest BLE MTU. The phone reassembles lines on '\n'.
const size_t BLE_CHUNK = 20;

OneWire oneWire(PIN_DS18B20);
DallasTemperature probe(&oneWire);
Adafruit_BME280 bme;
bool bmeReady = false;

BLEServer *bleServer = nullptr;
BLECharacteristic *txChar = nullptr;
volatile bool bleConnected = false;
volatile bool restartAdvertising = false;
SemaphoreHandle_t rxLock;
String rxBuffer;

WiFiServer server(8080);
WiFiClient client;
bool wifiJoining = false;
bool wifiReady = false;
uint32_t wifiJoinStarted = 0;

Button ackButton = {PIN_BUTTON_ACK, false, 0};
Button sessionButton = {PIN_BUTTON_SESSION, false, 0};

uint32_t sequenceNumber = 1;
bool monitoring = true;
bool sensorFault = false;
bool acknowledged = false;
Level level = LEVEL_NORMAL;
double baselineSum = 0;
uint32_t baselineCount = 0;
uint32_t lastReadAt = 0;

class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *) override {
    bleConnected = true;
  }
  void onDisconnect(BLEServer *) override {
    bleConnected = false;
    restartAdvertising = true;
  }
};

class RxCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    String chunk = characteristic->getValue().c_str();
    xSemaphoreTake(rxLock, portMAX_DELAY);
    rxBuffer += chunk;
    if (rxBuffer.length() > 512) rxBuffer = "";
    xSemaphoreGive(rxLock);
  }
};

void setBuzzer(bool on) {
  digitalWrite(PIN_BUZZER, on != BUZZER_ACTIVE_LOW ? HIGH : LOW);
}

void chirp() {
  setBuzzer(true);
  delay(40);
  setBuzzer(false);
}

bool pressed(Button &button) {
  const bool down = digitalRead(button.pin) == LOW;
  if (down == button.down || millis() - button.changedAt < 50) return false;
  button.down = down;
  button.changedAt = millis();
  return down;
}

bool phoneLinked() {
  return bleConnected || (wifiReady && client.connected());
}

void sendBle(const String &message) {
  if (!bleConnected || txChar == nullptr) return;
  for (size_t start = 0; start < message.length(); start += BLE_CHUNK) {
    String part = message.substring(start, start + BLE_CHUNK);
    txChar->setValue((uint8_t *)part.c_str(), part.length());
    txChar->notify();
    delay(10);
  }
}

void sendLine(const String &line) {
  if (wifiReady && client.connected()) {
    client.print(line);
  } else {
    sendBle(line);
  }
}

String takeCommand() {
  String line;
  xSemaphoreTake(rxLock, portMAX_DELAY);
  const int end = rxBuffer.indexOf('\n');
  if (end >= 0) {
    line = rxBuffer.substring(0, end);
    rxBuffer.remove(0, end + 1);
  } else if (rxBuffer.endsWith("}")) {
    line = rxBuffer;
    rxBuffer = "";
  }
  xSemaphoreGive(rxLock);
  return line;
}

bool readField(const String &json, const char *key, String &out) {
  const String token = String("\"") + key + "\":\"";
  int i = json.indexOf(token);
  if (i < 0) return false;
  out = "";
  for (i += token.length(); i < (int)json.length(); i++) {
    char c = json[i];
    if (c == '"') return true;
    if (c == '\\' && i + 1 < (int)json.length()) c = json[++i];
    out += c;
  }
  return false;
}

void startWifi(const String &ssid, const String &password) {
  if (client) client.stop();
  wifiReady = false;
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  wifiJoining = true;
  wifiJoinStarted = millis();
  Serial.printf("Joining Wi-Fi \"%s\"\n", ssid.c_str());
}

void stopWifi() {
  if (client) client.stop();
  server.end();
  wifiJoining = false;
  wifiReady = false;
  WiFi.disconnect(true);
  Serial.println("Wi-Fi off");
}

void updateWifi() {
  if (wifiJoining) {
    if (WiFi.status() == WL_CONNECTED) {
      wifiJoining = false;
      wifiReady = true;
      server.begin();
      configTime(0, 0, "pool.ntp.org", "time.google.com");
      const String ip = WiFi.localIP().toString();
      Serial.printf("Wi-Fi connected at %s:8080\n", ip.c_str());
      sendBle("{\"cmd\":\"wifi\",\"ok\":true,\"ip\":\"" + ip + "\",\"deviceId\":\"" + String(DEVICE_ID) + "\"}\n");
    } else if (millis() - wifiJoinStarted > WIFI_JOIN_TIMEOUT_MS) {
      wifiJoining = false;
      WiFi.disconnect(true);
      Serial.println("Wi-Fi join failed");
      sendBle("{\"cmd\":\"wifi\",\"ok\":false,\"deviceId\":\"" + String(DEVICE_ID) + "\"}\n");
    }
    return;
  }
  if (wifiReady && WiFi.status() == WL_CONNECTED && !client.connected()) {
    WiFiClient next = server.accept();
    if (next) client = next;
  }
}

void handleCommand(const String &line) {
  if (line.indexOf("\"cmd\":\"wifi\"") >= 0) {
    String ssid;
    String password;
    readField(line, "ssid", ssid);
    readField(line, "password", password);
    if (ssid.length() > 0) startWifi(ssid, password);
  } else if (line.indexOf("\"cmd\":\"disconnect\"") >= 0) {
    stopWifi();
  }
}

bool startBme() {
  if (!bme.begin(0x76, &Wire) && !bme.begin(0x77, &Wire)) return false;
  // Low oversampling keeps the module from warming itself and skewing ambient readings.
  bme.setSampling(Adafruit_BME280::MODE_NORMAL,
                  Adafruit_BME280::SAMPLING_X1,
                  Adafruit_BME280::SAMPLING_X1,
                  Adafruit_BME280::SAMPLING_X1,
                  Adafruit_BME280::FILTER_OFF,
                  Adafruit_BME280::STANDBY_MS_1000);
  return true;
}

void startSensors() {
  Wire.begin(PIN_SDA, PIN_SCL);
  bmeReady = startBme();
  if (!bmeReady) Serial.println("BME280 not found on SDA 21 / SCL 22");
  probe.begin();
  if (probe.getDeviceCount() == 0) Serial.println("DS18B20 not found on GPIO 4");
  probe.setWaitForConversion(false);
  probe.requestTemperatures();
}

void startBle() {
  BLEDevice::init(DEVICE_ID);
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());
  BLEService *service = bleServer->createService(SERVICE_UUID);
  txChar = service->createCharacteristic(TX_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  txChar->addDescriptor(new BLE2902());
  BLECharacteristic *rx = service->createCharacteristic(
    RX_UUID,
    BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR
  );
  rx->setCallbacks(new RxCallbacks());
  service->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->start();
}

int readMoisture() {
  uint32_t total = 0;
  for (int i = 0; i < 16; i++) total += analogRead(PIN_MOISTURE);
  return total / 16;
}

Reading takeReading() {
  Reading reading;
  reading.localizedC = probe.getTempCByIndex(0);
  probe.requestTemperatures();
  if (!bmeReady) bmeReady = startBme();
  reading.ambientC = bmeReady ? bme.readTemperature() : NAN;
  reading.humidity = bmeReady ? bme.readHumidity() : NAN;
  reading.moisture = readMoisture();
  // 85.0 is the DS18B20 power-on value, seen when the probe loses power.
  reading.valid = reading.localizedC != DEVICE_DISCONNECTED_C && reading.localizedC != 85.0f &&
                  !isnan(reading.ambientC) && !isnan(reading.humidity);
  return reading;
}

Level evaluate(const Reading &reading) {
  bool temperatureChanged = false;
  if (baselineCount > 0) {
    const double baseline = baselineSum / baselineCount;
    temperatureChanged = fabs(reading.localizedC - baseline) >= TEMPERATURE_DELTA_C;
  }
  baselineSum += reading.localizedC;
  baselineCount++;
  if (reading.moisture >= MOISTURE_ATTENTION_COUNT || temperatureChanged) return LEVEL_ATTENTION;
  if (reading.humidity >= HUMIDITY_WATCH_PERCENT) return LEVEL_WATCH;
  return LEVEL_NORMAL;
}

const char *levelName(Level value) {
  if (value == LEVEL_ATTENTION) return "attention";
  if (value == LEVEL_WATCH) return "watch";
  return "normal";
}

// Before NTP sync this is 1970, and the phone swaps in its own clock.
String timestamp() {
  char text[25];
  const time_t now = time(nullptr);
  struct tm utc;
  gmtime_r(&now, &utc);
  strftime(text, sizeof(text), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return text;
}

String readingJson(const Reading &reading) {
  String line = "{\"deviceId\":\"";
  line += DEVICE_ID;
  line += "\",\"sequence\":";
  line += String(sequenceNumber);
  line += ",\"capturedAt\":\"";
  line += timestamp();
  line += "\",\"localizedTemperatureC\":";
  line += String(reading.localizedC, 2);
  line += ",\"ambientTemperatureC\":";
  line += String(reading.ambientC, 2);
  line += ",\"humidityPercent\":";
  line += String(reading.humidity, 1);
  line += ",\"relativeMoistureValue\":";
  line += String(reading.moisture);
  line += ",\"deviceStatus\":\"";
  line += levelName(level);
  line += "\"}\n";
  sequenceNumber = sequenceNumber >= SEQUENCE_MAX ? 1 : sequenceNumber + 1;
  return line;
}

void readAndSend() {
  const Reading reading = takeReading();
  if (!monitoring) return;
  sensorFault = !reading.valid;
  if (sensorFault) {
    Serial.println("Sensor fault, reading not sent. Check the DS18B20 on GPIO 4 and the BME280 on I2C.");
    return;
  }
  level = evaluate(reading);
  if (level != LEVEL_ATTENTION) acknowledged = false;
  const String line = readingJson(reading);
  Serial.print(line);
  sendLine(line);
}

void toggleMonitoring() {
  monitoring = !monitoring;
  if (monitoring) {
    baselineSum = 0;
    baselineCount = 0;
    acknowledged = false;
    level = LEVEL_NORMAL;
  }
  Serial.println(monitoring ? "Monitoring resumed, new temperature baseline" : "Monitoring paused");
}

void showStatus() {
  const uint32_t now = millis();
  const bool blink = (now / 500) % 2 == 0;
  bool green = false;
  bool yellow = false;
  bool red = false;
  bool buzz = false;
  if (!monitoring) {
    yellow = blink;
  } else if (sensorFault) {
    red = blink;
  } else if (level == LEVEL_ATTENTION) {
    red = true;
    buzz = !acknowledged && now % 1000 < 200;
  } else if (level == LEVEL_WATCH) {
    yellow = true;
  } else {
    green = phoneLinked() || blink;
  }
  digitalWrite(PIN_LED_GREEN, green);
  digitalWrite(PIN_LED_YELLOW, yellow);
  digitalWrite(PIN_LED_RED, red);
  setBuzzer(buzz);
}

void setup() {
  Serial.begin(115200);
  rxLock = xSemaphoreCreateMutex();

  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  setBuzzer(false);
  pinMode(PIN_BUTTON_ACK, INPUT_PULLUP);
  pinMode(PIN_BUTTON_SESSION, INPUT_PULLUP);
  analogReadResolution(12);

  startSensors();
  startBle();
  Serial.printf("%s ready, advertising over Bluetooth\n", DEVICE_ID);
  lastReadAt = millis();
}

void loop() {
  const String command = takeCommand();
  if (command.length() > 0) handleCommand(command);

  if (restartAdvertising) {
    restartAdvertising = false;
    delay(300);
    bleServer->startAdvertising();
  }
  updateWifi();

  if (pressed(ackButton)) {
    chirp();
    if (level == LEVEL_ATTENTION) acknowledged = true;
  }
  if (pressed(sessionButton)) {
    chirp();
    toggleMonitoring();
  }

  if (millis() - lastReadAt >= READ_INTERVAL_MS) {
    lastReadAt = millis();
    readAndSend();
  }
  showStatus();
  delay(10);
}
