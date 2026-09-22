import "dart:convert";

class BlePacket {
  const BlePacket({
    required this.deviceId,
    required this.sequence,
    required this.capturedAt,
    required this.localizedTemperatureC,
    required this.ambientTemperatureC,
    required this.humidityPercent,
    required this.relativeMoistureValue,
    required this.deviceStatus,
  });

  final String deviceId;
  final int sequence;
  final String capturedAt;
  final double localizedTemperatureC;
  final double ambientTemperatureC;
  final double humidityPercent;
  final int relativeMoistureValue;
  final String deviceStatus;
}

/// Parses one ESP32 notification. The phone later stores this in SQLite.
BlePacket? parseBlePayload(String raw) {
  final text = raw.trim();
  if (!text.startsWith("{") || !text.endsWith("}")) return null;
  final Object? decoded;
  try {
    decoded = jsonDecode(text);
  } catch (_) {
    return null;
  }
  if (decoded is! Map) return null;
  final json = decoded.map((key, value) => MapEntry(key.toString(), value));
  final deviceId = json["deviceId"];
  if (deviceId is! String || deviceId.isEmpty) return null;
  return BlePacket(
    deviceId: deviceId,
    sequence: _asInt(json["sequence"]) ?? 0,
    capturedAt: json["capturedAt"] is String ? json["capturedAt"] as String : DateTime.now().toUtc().toIso8601String(),
    localizedTemperatureC: _asDouble(json["localizedTemperatureC"]) ?? 0,
    ambientTemperatureC: _asDouble(json["ambientTemperatureC"]) ?? 0,
    humidityPercent: _asDouble(json["humidityPercent"]) ?? 0,
    relativeMoistureValue: _asInt(json["relativeMoistureValue"]) ?? 0,
    deviceStatus: json["deviceStatus"] is String ? json["deviceStatus"] as String : "connected",
  );
}

int? _asInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.round();
  if (value is String) return int.tryParse(value);
  return null;
}

double? _asDouble(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}
