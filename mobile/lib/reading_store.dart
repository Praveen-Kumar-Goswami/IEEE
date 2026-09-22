import "package:path/path.dart" as p;
import "package:sqflite/sqflite.dart";

class StoredReading {
  StoredReading({
    required this.clientReadingId,
    required this.sessionId,
    required this.deviceSerial,
    required this.sequence,
    required this.capturedAt,
    required this.localizedTemperatureC,
    required this.ambientTemperatureC,
    required this.humidityPercent,
    required this.relativeMoistureValue,
    required this.deviceStatus,
    required this.syncStatus,
  });

  final String clientReadingId;
  final String sessionId;
  final String deviceSerial;
  final int sequence;
  final String capturedAt;
  final double localizedTemperatureC;
  final double ambientTemperatureC;
  final double humidityPercent;
  final int relativeMoistureValue;
  final String deviceStatus;
  final String syncStatus;

  Map<String, dynamic> toUploadJson() {
    return {
      "client_reading_id": clientReadingId,
      "sequence": sequence,
      "captured_at": capturedAt,
      "localized_temperature_c": localizedTemperatureC,
      "ambient_temperature_c": ambientTemperatureC,
      "humidity_percent": humidityPercent,
      "relative_moisture_value": relativeMoistureValue,
      "device_status": deviceStatus,
    };
  }

  static StoredReading fromRow(Map<String, Object?> row) {
    return StoredReading(
      clientReadingId: row["client_reading_id"]! as String,
      sessionId: row["session_id"]! as String,
      deviceSerial: row["device_serial"]! as String,
      sequence: row["sequence"] as int? ?? 0,
      capturedAt: row["captured_at"]! as String,
      localizedTemperatureC: (row["localized_temperature_c"] as num?)?.toDouble() ?? 0,
      ambientTemperatureC: (row["ambient_temperature_c"] as num?)?.toDouble() ?? 0,
      humidityPercent: (row["humidity_percent"] as num?)?.toDouble() ?? 0,
      relativeMoistureValue: row["relative_moisture_value"] as int? ?? 0,
      deviceStatus: row["device_status"]! as String,
      syncStatus: row["sync_status"]! as String,
    );
  }
}

class ReadingStore {
  Database? _database;

  Future<Database> _open() async {
    final existing = _database;
    if (existing != null) return existing;
    final file = p.join(await getDatabasesPath(), "smart_dressing.db");
    final database = await openDatabase(
      file,
      version: 1,
      onCreate: (db, version) {
        return db.execute("""
          CREATE TABLE readings (
            client_reading_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            device_serial TEXT NOT NULL,
            sequence INTEGER NOT NULL,
            captured_at TEXT NOT NULL,
            localized_temperature_c REAL NOT NULL,
            ambient_temperature_c REAL NOT NULL,
            humidity_percent REAL NOT NULL,
            relative_moisture_value INTEGER NOT NULL,
            device_status TEXT NOT NULL,
            sync_status TEXT NOT NULL
          )
        """);
      },
    );
    _database = database;
    return database;
  }

  Future<void> insert(StoredReading reading) async {
    final database = await _open();
    await database.insert("readings", {
      "client_reading_id": reading.clientReadingId,
      "session_id": reading.sessionId,
      "device_serial": reading.deviceSerial,
      "sequence": reading.sequence,
      "captured_at": reading.capturedAt,
      "localized_temperature_c": reading.localizedTemperatureC,
      "ambient_temperature_c": reading.ambientTemperatureC,
      "humidity_percent": reading.humidityPercent,
      "relative_moisture_value": reading.relativeMoistureValue,
      "device_status": reading.deviceStatus,
      "sync_status": reading.syncStatus,
    });
  }

  Future<List<StoredReading>> pending() async {
    final database = await _open();
    final rows = await database.query(
      "readings",
      where: "sync_status = ?",
      whereArgs: ["pending"],
      orderBy: "captured_at ASC",
      limit: 100,
    );
    return rows.map(StoredReading.fromRow).toList();
  }

  Future<int> pendingCount() async {
    final database = await _open();
    final rows = await database.rawQuery("SELECT COUNT(*) AS n FROM readings WHERE sync_status = 'pending'");
    return (rows.first["n"] as int?) ?? 0;
  }

  Future<List<StoredReading>> recent() async {
    final database = await _open();
    final rows = await database.query("readings", orderBy: "captured_at DESC", limit: 500);
    return rows.map(StoredReading.fromRow).toList();
  }

  Future<List<StoredReading>> all() async {
    final database = await _open();
    final rows = await database.query("readings", orderBy: "captured_at ASC");
    return rows.map(StoredReading.fromRow).toList();
  }

  Future<void> markSynced(Iterable<String> ids) async {
    final list = ids.toList();
    if (list.isEmpty) return;
    final database = await _open();
    final marks = List.filled(list.length, "?").join(",");
    await database.rawUpdate(
      "UPDATE readings SET sync_status = 'synced' WHERE client_reading_id IN ($marks)",
      list,
    );
  }
}
