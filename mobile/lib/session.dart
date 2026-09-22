import "dart:convert";

import "package:flutter/foundation.dart";
import "package:http/http.dart" as http;
import "package:shared_preferences/shared_preferences.dart";

import "api.dart";
import "config.dart";

class SessionController extends ChangeNotifier {
  String token = "";
  String name = "";
  String email = "";
  String phone = "";
  bool ready = false;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    token = prefs.getString("access_token") ?? "";
    name = prefs.getString("full_name") ?? "";
    email = prefs.getString("email") ?? "";
    phone = prefs.getString("phone") ?? "";
    ready = true;
    notifyListeners();
  }

  Future<void> signIn({required String email, required String password}) async {
    final session = await _post("/v1/auth/login", {
      "email": email,
      "password": password,
    });
    await _save(session);
  }

  Future<void> register({
    required String name,
    required String phone,
    required String email,
    required String password,
  }) async {
    final session = await _post("/v1/auth/register", {
      "full_name": name,
      "phone": phone,
      "email": email,
      "password": password,
    });
    await _save(session);
  }

  Future<void> signOut() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove("access_token");
    await prefs.remove("full_name");
    await prefs.remove("email");
    await prefs.remove("phone");
    token = "";
    name = "";
    email = "";
    phone = "";
    notifyListeners();
  }

  Future<void> _save(Map<String, dynamic> session) async {
    token = session["access_token"]?.toString() ?? "";
    name = session["full_name"]?.toString() ?? "";
    email = session["email"]?.toString() ?? "";
    phone = session["phone"]?.toString() ?? "";
    if (token.isEmpty) throw ApiException("Sign in could not be completed.");
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString("access_token", token);
    await prefs.setString("full_name", name);
    await prefs.setString("email", email);
    await prefs.setString("phone", phone);
    notifyListeners();
  }

  Future<Map<String, dynamic>> _post(String path, Map<String, String> body) async {
    final response = await http
        .post(
          Uri.parse("$apiBaseUrl$path"),
          headers: {"content-type": "application/json"},
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 25));
    final Object? decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    final payload = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    if (response.statusCode >= 400) {
      final error = payload["error"];
      final message = error is Map && error["message"] is String ? error["message"] as String : "That did not work. Try again.";
      throw ApiException(message);
    }
    final session = payload["session"];
    if (session is! Map) throw ApiException("Sign in could not be completed.");
    return session.map((key, value) => MapEntry(key.toString(), value));
  }
}
