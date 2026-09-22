import "dart:convert";

import "package:http/http.dart" as http;

import "config.dart";

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class DressingApi {
  DressingApi(this.accessToken);

  final String accessToken;

  Future<Map<String, dynamic>> summary() {
    return _send("GET", "/v1/patients/me/summary");
  }

  Future<Map<String, dynamic>> createSession({
    required String id,
    required String deviceSerial,
    required String startedAt,
    required String label,
  }) {
    return _send("POST", "/v1/mobile/sessions", {
      "id": id,
      "device_serial": deviceSerial,
      "started_at": startedAt,
      "simulated_wound_label": label,
    });
  }

  Future<Map<String, dynamic>> endSession(String id) {
    return _send("POST", "/v1/mobile/sessions/$id/end", {});
  }

  Future<Map<String, dynamic>> syncReadings({
    required String deviceSerial,
    required String sessionId,
    required List<Map<String, dynamic>> readings,
  }) {
    return _send("POST", "/v1/mobile/sync/readings", {
      "device_serial": deviceSerial,
      "session_id": sessionId,
      "readings": readings,
    });
  }

  Future<Map<String, dynamic>> _send(String method, String path, [Object? body]) async {
    final request = http.Request(method, Uri.parse("$apiBaseUrl$path"));
    request.headers["authorization"] = "Bearer $accessToken";
    request.headers["content-type"] = "application/json";
    if (body != null) request.body = jsonEncode(body);
    final streamed = await request.send().timeout(const Duration(seconds: 25));
    final text = await streamed.stream.bytesToString();
    final Object? decoded = text.isEmpty ? <String, dynamic>{} : jsonDecode(text);
    final payload = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    if (streamed.statusCode >= 400) {
      final error = payload["error"];
      final message = error is Map && error["message"] is String
          ? error["message"] as String
          : "Request failed (${streamed.statusCode}).";
      throw ApiException(message);
    }
    return payload;
  }
}
