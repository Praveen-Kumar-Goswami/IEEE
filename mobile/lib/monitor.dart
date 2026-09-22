import "dart:async";
import "dart:convert";
import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_blue_plus/flutter_blue_plus.dart";
import "package:path/path.dart" as p;
import "package:permission_handler/permission_handler.dart";
import "package:shared_preferences/shared_preferences.dart";
import "package:sqflite/sqflite.dart";
import "package:uuid/uuid.dart";

import "api.dart";
import "ble_packet.dart";
import "reading_store.dart";

class MonitorController extends ChangeNotifier {
  MonitorController(this.accessToken) {
    serial = TextEditingController(text: "ESP32-001");
    label = TextEditingController(text: "Simulated dressing, left forearm");
    temperature = TextEditingController(text: "36.8");
    ambient = TextEditingController(text: "28.2");
    humidity = TextEditingController(text: "65");
    moisture = TextEditingController(text: "180");
    wifiSsid = TextEditingController();
    wifiPassword = TextEditingController();
  }

  final String Function() accessToken;

  final ReadingStore store = ReadingStore();
  late final TextEditingController serial;
  late final TextEditingController label;
  late final TextEditingController temperature;
  late final TextEditingController ambient;
  late final TextEditingController humidity;
  late final TextEditingController moisture;
  late final TextEditingController wifiSsid;
  late final TextEditingController wifiPassword;

  String? sessionId;
  String? sessionStartedAt;
  bool sessionOnServer = false;
  double temperatureDelta = 1;
  double humidityLimit = 80;
  int moistureLimit = 350;
  String status = "Ready to monitor a simulated dressing.";
  String? indication;
  String led = "green";
  Map<String, dynamic>? summary;
  List<StoredReading> recent = [];
  int pending = 0;
  bool busy = false;
  String link = "off";
  String? connectedName;
  String? wifiIp;
  final List<ScanResult> found = [];

  StreamSubscription<List<ScanResult>>? _scanSub;
  StreamSubscription<List<int>>? _notifySub;
  BluetoothDevice? _device;
  BluetoothCharacteristic? _rx;
  Socket? _socket;
  String _bleBuffer = "";
  String _wifiBuffer = "";
  bool _disposed = false;

  DressingApi _api() {
    final token = accessToken();
    if (token.isEmpty) throw ApiException("Sign in again.");
    return DressingApi(token);
  }

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    sessionId = prefs.getString("session_id");
    sessionStartedAt = prefs.getString("session_started_at");
    sessionOnServer = prefs.getBool("session_on_server") ?? sessionId != null;
    temperatureDelta = prefs.getDouble("temperature_delta") ?? 1;
    humidityLimit = prefs.getDouble("humidity_limit") ?? 80;
    moistureLimit = prefs.getInt("moisture_limit") ?? 350;
    serial.text = prefs.getString("device_serial") ?? serial.text;
    label.text = prefs.getString("session_label") ?? label.text;
    wifiSsid.text = prefs.getString("wifi_ssid") ?? "";
    await reloadLocal();
    await refreshSummary();
  }

  Future<void> reloadLocal() async {
    recent = await store.recent();
    pending = await store.pendingCount();
    _notify();
  }

  Future<void> refreshSummary() async {
    try {
      summary = await _api().summary();
      final value = summary?["indication"];
      if (value is Map) {
        indication = value["label"]?.toString();
        led = value["led"]?.toString() ?? "green";
      }
      _notify();
    } catch (error) {
      status = messageOf(error);
      _notify();
    }
  }

  Future<void> startSession() async {
    await _run("Starting session…", () async {
      final id = const Uuid().v4();
      final startedAt = DateTime.now().toUtc().toIso8601String();
      var onServer = false;
      String? serverNote;
      try {
        await _api().createSession(
          id: id,
          deviceSerial: serial.text.trim(),
          startedAt: startedAt,
          label: label.text.trim(),
        );
        onServer = true;
      } catch (error) {
        serverNote = messageOf(error);
      }
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString("session_id", id);
      await prefs.setString("session_started_at", startedAt);
      await prefs.setBool("session_on_server", onServer);
      await prefs.setString("device_serial", serial.text.trim());
      await prefs.setString("session_label", label.text.trim());
      sessionId = id;
      sessionStartedAt = startedAt;
      sessionOnServer = onServer;
      status = onServer
          ? "Session started. Readings stay on the phone until sync."
          : "Session is running on this phone. Sync will upload it. $serverNote";
    });
  }

  Future<void> endSession() async {
    final id = sessionId;
    if (id == null) return;
    await _run("Ending session…", () async {
      if (sessionOnServer) await _api().endSession(id);
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove("session_id");
      await prefs.remove("session_started_at");
      await prefs.remove("session_on_server");
      sessionId = null;
      sessionStartedAt = null;
      sessionOnServer = false;
      status = "Session completed.";
    });
  }

  Future<void> addManual() async {
    final localized = double.tryParse(temperature.text.trim());
    final room = double.tryParse(ambient.text.trim());
    final humid = double.tryParse(humidity.text.trim());
    final moistureCount = int.tryParse(moisture.text.trim());
    if (localized == null || room == null || humid == null || moistureCount == null) {
      status = "Enter numeric temperature, humidity, and moisture.";
      _notify();
      return;
    }
    if (humid < 0 || humid > 100 || moistureCount < 0 || moistureCount > 4095) {
      status = "Humidity is 0–100. Moisture is an ADC count from 0 to 4095.";
      _notify();
      return;
    }
    final prefs = await SharedPreferences.getInstance();
    final sequence = prefs.getInt("next_sequence") ?? 1;
    await prefs.setInt("next_sequence", sequence + 1);
    await saveSample(
      serial: serial.text.trim(),
      sequence: sequence,
      capturedAt: DateTime.now().toUtc().toIso8601String(),
      temperature: localized,
      ambient: room,
      humidity: humid,
      moisture: moistureCount,
      deviceStatus: "connected",
    );
    status = "Sample saved on the phone.";
    _notify();
  }

  Future<void> saveSample({
    required String serial,
    required int sequence,
    required String capturedAt,
    required double temperature,
    required double ambient,
    required double humidity,
    required int moisture,
    required String deviceStatus,
  }) async {
    final id = sessionId ?? await _localSession();
    await store.insert(StoredReading(
      clientReadingId: const Uuid().v4(),
      sessionId: id,
      deviceSerial: serial,
      sequence: sequence,
      capturedAt: capturedAt,
      localizedTemperatureC: temperature,
      ambientTemperatureC: ambient,
      humidityPercent: humidity,
      relativeMoistureValue: moisture,
      deviceStatus: deviceStatus,
      syncStatus: "pending",
    ));
    await reloadLocal();
  }

  Future<void> sync() async {
    await _run("Uploading…", () async {
      final rows = await store.pending();
      if (rows.isEmpty) {
        status = "Everything is already sent.";
        return;
      }
      final bySession = <String, List<StoredReading>>{};
      for (final row in rows) {
        bySession.putIfAbsent(row.sessionId, () => []).add(row);
      }
      var uploaded = 0;
      for (final entry in bySession.entries) {
        final result = await _uploadSession(entry.key, entry.value);
        final ids = <String>[...stringList(result["uploaded"]), ...stringList(result["skipped"])];
        await store.markSynced(ids);
        uploaded += stringList(result["uploaded"]).length;
      }
      await reloadLocal();
      await refreshSummary();
      status = "Sent $uploaded reading(s).";
    });
  }

  Future<Map<String, dynamic>> _uploadSession(String id, List<StoredReading> rows) async {
    try {
      return await _api().syncReadings(
        deviceSerial: rows.first.deviceSerial,
        sessionId: id,
        readings: rows.map((row) => row.toUploadJson()).toList(),
      );
    } on ApiException catch (error) {
      if (!error.message.toLowerCase().contains("not found")) rethrow;
      await _api().createSession(
        id: id,
        deviceSerial: rows.first.deviceSerial,
        startedAt: rows.first.capturedAt,
        label: label.text.trim().isEmpty ? "Simulated dressing" : label.text.trim(),
      );
      if (id == sessionId) {
        sessionOnServer = true;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool("session_on_server", true);
      }
      return _api().syncReadings(
        deviceSerial: rows.first.deviceSerial,
        sessionId: id,
        readings: rows.map((row) => row.toUploadJson()).toList(),
      );
    }
  }

  Future<void> setTemperatureDelta(double value) => _saveLimit("temperature_delta", value, () => temperatureDelta = value);

  Future<void> setHumidityLimit(double value) => _saveLimit("humidity_limit", value, () => humidityLimit = value);

  Future<void> setMoistureLimit(int value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt("moisture_limit", value);
    moistureLimit = value;
    status = "Moisture threshold saved on this phone.";
    _notify();
  }

  Future<void> _saveLimit(String key, double value, void Function() apply) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(key, value);
    apply();
    status = "Threshold saved on this phone.";
    _notify();
  }

  Future<String> exportCsv() async {
    final rows = await store.all();
    if (rows.isEmpty) throw ApiException("No readings to export yet.");
    final buffer = StringBuffer("captured_at,device_serial,sequence,localized_temperature_c,ambient_temperature_c,humidity_percent,relative_moisture_value,sync_status\n");
    for (final row in rows) {
      buffer.writeln(
        "${row.capturedAt},${row.deviceSerial},${row.sequence},${row.localizedTemperatureC},${row.ambientTemperatureC},${row.humidityPercent},${row.relativeMoistureValue},${row.syncStatus}",
      );
    }
    final file = File(p.join(await getDatabasesPath(), "smart-dressing-readings.csv"));
    await file.writeAsString(buffer.toString());
    return file.path;
  }

  Future<String> _localSession() async {
    final prefs = await SharedPreferences.getInstance();
    final existing = prefs.getString("local_capture_id");
    if (existing != null && existing.isNotEmpty) return existing;
    final created = const Uuid().v4();
    await prefs.setString("local_capture_id", created);
    return created;
  }

  Future<void> scan() async {
    await _run("Searching for the sensor…", () async {
      final permissions = await [Permission.bluetoothScan, Permission.bluetoothConnect, Permission.locationWhenInUse].request();
      final blocked = permissions.values.any((status) => status.isPermanentlyDenied);
      final allowed = (permissions[Permission.bluetoothScan]?.isGranted ?? false) && (permissions[Permission.bluetoothConnect]?.isGranted ?? false);
      if (!allowed) {
        throw ApiException(blocked
            ? "Bluetooth is blocked. Allow it in the phone settings for Smart Dressing."
            : "Allow Bluetooth so the phone can find the sensor.");
      }
      if (await FlutterBluePlus.isSupported == false) {
        throw ApiException("This phone does not support Bluetooth.");
      }
      final adapter = await FlutterBluePlus.adapterState.first.timeout(
        const Duration(seconds: 4),
        onTimeout: () => BluetoothAdapterState.unknown,
      );
      if (adapter != BluetoothAdapterState.on) {
        try {
          await FlutterBluePlus.turnOn(timeout: 15);
        } catch (_) {
          throw ApiException("Turn on Bluetooth, then search again.");
        }
      }
      found.clear();
      await _scanSub?.cancel();
      _scanSub = FlutterBluePlus.scanResults.listen((results) {
      found
        ..clear()
        ..addAll(results);
      found.sort((a, b) => _rank(a).compareTo(_rank(b)));
      _notify();
      });
      await FlutterBluePlus.startScan(timeout: const Duration(seconds: 8), androidUsesFineLocation: true);
      status = found.isEmpty ? "No devices found. Move closer and search again." : "Tap Connect on the dressing sensor.";
    });
  }

  Future<void> connect(BluetoothDevice device) async {
    await _run("Connecting by Bluetooth…", () async {
      await FlutterBluePlus.stopScan();
      await disconnect(quiet: true);
      await device.connect(timeout: const Duration(seconds: 15), autoConnect: false);
      final services = await device.discoverServices();
      const tx = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
      const rx = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
      BluetoothCharacteristic? notify;
      BluetoothCharacteristic? write;
      for (final service in services) {
        for (final characteristic in service.characteristics) {
          final id = characteristic.uuid.str.toLowerCase();
          if (id == tx || (notify == null && characteristic.properties.notify)) notify = characteristic;
          if (id == rx || (write == null && (characteristic.properties.write || characteristic.properties.writeWithoutResponse))) {
            write = characteristic;
          }
        }
      }
      if (notify == null) throw ApiException("This device did not share sensor readings. Try the dressing monitor.");
      await notify.setNotifyValue(true);
      await _notifySub?.cancel();
      _bleBuffer = "";
      _notifySub = notify.onValueReceived.listen(_onBleBytes);
      _device = device;
      _rx = write;
      link = "bluetooth";
      connectedName = device.platformName.isEmpty ? "Dressing sensor" : device.platformName;
      if (device.platformName.isNotEmpty) serial.text = device.platformName;
      status = "Connected by Bluetooth. You can switch to Wi-Fi for a steadier stream.";
    });
  }

  Future<void> useWifi() async {
    final name = wifiSsid.text.trim();
    if (name.isEmpty) {
      status = "Enter the Wi-Fi name the phone is using.";
      _notify();
      return;
    }
    if (_rx == null || link == "off") {
      status = "Connect by Bluetooth first, then switch to Wi-Fi.";
      _notify();
      return;
    }
    await _run("Asking the sensor to join Wi-Fi…", () async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString("wifi_ssid", name);
      final payload = utf8.encode("${jsonEncode({
        "cmd": "wifi",
        "ssid": name,
        "password": wifiPassword.text,
      })}\n");
      await _rx!.write(payload, withoutResponse: _rx!.properties.writeWithoutResponse && !_rx!.properties.write);
      status = "Wi-Fi details sent. Waiting for the sensor address.";
    });
  }

  Future<void> disconnect({bool quiet = false}) async {
    await _socket?.close();
    _socket = null;
    wifiIp = null;
    await _notifySub?.cancel();
    _notifySub = null;
    final device = _device;
    _device = null;
    _rx = null;
    if (device != null) {
      try {
        await device.disconnect();
      } catch (_) {}
    }
    link = "off";
    connectedName = null;
    try {
      await FlutterBluePlus.stopScan();
    } catch (_) {}
    if (!quiet) {
      status = "Disconnected.";
      _notify();
    }
  }

  void _onBleBytes(List<int> bytes) => _collect(bytes, true);

  void _collect(List<int> bytes, bool bluetooth) {
    if (bytes.isEmpty) return;
    if (bluetooth) {
      _bleBuffer += utf8.decode(bytes, allowMalformed: true);
    } else {
      _wifiBuffer += utf8.decode(bytes, allowMalformed: true);
    }
    final source = bluetooth ? _bleBuffer : _wifiBuffer;
    final split = _takeChunks(source);
    if (bluetooth) {
      _bleBuffer = split.rest;
    } else {
      _wifiBuffer = split.rest;
    }
    for (final chunk in split.chunks) {
      _handleChunk(chunk);
    }
  }

  void _handleChunk(String chunk) {
    final text = chunk.trim();
    if (!text.startsWith("{") || !text.endsWith("}")) return;
    Object? decoded;
    try {
      decoded = jsonDecode(text);
    } catch (_) {
      return;
    }
    if (decoded is! Map) return;
    final json = decoded.map((key, value) => MapEntry(key.toString(), value));
    if (json["cmd"] == "wifi") {
      final ip = json["ip"];
      if (ip is String && ip.isNotEmpty) unawaited(_openWifi(ip));
      if (json["deviceId"] is String && (json["deviceId"] as String).isNotEmpty) {
        serial.text = json["deviceId"] as String;
      }
      return;
    }
    final packet = parseBlePayload(text);
    if (packet != null) unawaited(_savePacket(packet));
  }

  Future<void> _openWifi(String ip) async {
    if (wifiIp == ip && _socket != null) return;
    try {
      await _socket?.close();
      final socket = await Socket.connect(ip, 8080, timeout: const Duration(seconds: 8));
      _socket = socket;
      wifiIp = ip;
      link = "wifi";
      status = "Connected by Wi-Fi at $ip. Readings are coming in.";
      _notify();
      socket.listen(
        (bytes) => _collect(bytes, false),
        onError: (Object error) {
          status = "Wi-Fi stream stopped. Bluetooth is still available.";
          link = _device == null ? "off" : "bluetooth";
          _notify();
        },
        onDone: () {
          if (link == "wifi") {
            link = _device == null ? "off" : "bluetooth";
            wifiIp = null;
            status = "Wi-Fi disconnected.";
            _notify();
          }
        },
      );
    } catch (_) {
      status = "Bluetooth is connected, but Wi-Fi did not open. Check that the phone and sensor are on the same network.";
      _notify();
    }
  }

  Future<void> _savePacket(BlePacket packet) async {
    final parsed = DateTime.tryParse(packet.capturedAt);
    final capturedAt = parsed == null || DateTime.now().difference(parsed).inDays.abs() > 2
        ? DateTime.now().toUtc().toIso8601String()
        : packet.capturedAt;
    await saveSample(
      serial: serial.text.trim().isEmpty ? packet.deviceId : serial.text.trim(),
      sequence: packet.sequence,
      capturedAt: capturedAt,
      temperature: packet.localizedTemperatureC,
      ambient: packet.ambientTemperatureC,
      humidity: packet.humidityPercent,
      moisture: packet.relativeMoistureValue,
      deviceStatus: packet.deviceStatus,
    );
  }

  Future<void> _run(String label, Future<void> Function() action) async {
    busy = true;
    status = label;
    _notify();
    try {
      await action();
    } catch (error) {
      status = messageOf(error);
    } finally {
      busy = false;
      _notify();
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _scanSub?.cancel();
    _notifySub?.cancel();
    _socket?.close();
    serial.dispose();
    label.dispose();
    temperature.dispose();
    ambient.dispose();
    humidity.dispose();
    moisture.dispose();
    wifiSsid.dispose();
    wifiPassword.dispose();
    super.dispose();
  }
}

int _rank(ScanResult result) {
  final name = result.device.platformName.toLowerCase();
  if (name.contains("esp") || name.contains("dress")) return 0;
  if (name.isEmpty) return 2;
  return 1;
}

({List<String> chunks, String rest}) _takeChunks(String source) {
  final chunks = <String>[];
  var rest = source;
  while (rest.contains("\n") || rest.trim().endsWith("}")) {
    final newline = rest.indexOf("\n");
    if (newline >= 0) {
      chunks.add(rest.substring(0, newline));
      rest = rest.substring(newline + 1);
      continue;
    }
    chunks.add(rest.trim());
    rest = "";
    break;
  }
  return (chunks: chunks, rest: rest);
}

String messageOf(Object error) {
  if (error is ApiException) return error.message;
  final text = error.toString();
  if (text.contains("bluetooth") || text.contains("Bluetooth")) return "Turn on Bluetooth and allow the phone to scan.";
  if (text.contains("SocketException") || text.contains("Failed host lookup") || text.contains("ClientException")) {
    return "The phone could not reach the server. Readings stay on this phone until sync.";
  }
  if (text.length < 160 && !text.contains("eyJ")) return text;
  return "The request could not be completed.";
}

List<String> stringList(Object? value) {
  if (value is! List) return const [];
  return value.whereType<String>().toList();
}
