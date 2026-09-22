import "reading_store.dart";

class MonitoringIndicator {
  const MonitoringIndicator({
    required this.type,
    required this.severity,
    required this.message,
    required this.createdAt,
  });

  final String type;
  final String severity;
  final String message;
  final String createdAt;
}

/// On-phone indicators. Temperature uses the mean of earlier readings, not a fever cutoff.
List<MonitoringIndicator> localIndicators({
  required List<StoredReading> recent,
  String? sessionId,
  required double temperatureDelta,
  required double humidityLimit,
  required int moistureLimit,
}) {
  final rows = recent.where((row) => sessionId == null || sessionId.isEmpty || row.sessionId == sessionId).toList();
  if (rows.isEmpty) return const [];
  final latest = rows.first;
  final found = <MonitoringIndicator>[];
  final temperatures = rows.reversed.map((row) => row.localizedTemperatureC).toList();
  if (temperatures.length > 1) {
    final earlier = temperatures.sublist(0, temperatures.length - 1);
    final baseline = earlier.reduce((sum, value) => sum + value) / earlier.length;
    if ((temperatures.last - baseline).abs() >= temperatureDelta) {
      found.add(MonitoringIndicator(
        type: "elevated_temperature",
        severity: "attention",
        message:
            "Localized temperature changed from the earlier readings in this session. This is a monitoring indicator requiring clinical review, not a diagnosis.",
        createdAt: latest.capturedAt,
      ));
    }
  }
  if (latest.humidityPercent >= humidityLimit) {
    found.add(MonitoringIndicator(
      type: "humidity_change",
      severity: "watch",
      message: "Humidity is at or above the monitoring threshold. This is a monitoring indicator requiring clinical review, not a diagnosis.",
      createdAt: latest.capturedAt,
    ));
  }
  if (latest.relativeMoistureValue >= moistureLimit) {
    found.add(MonitoringIndicator(
      type: "moisture_change",
      severity: "attention",
      message: "Relative moisture is at or above the monitoring threshold. This is a monitoring indicator requiring clinical review, not a diagnosis.",
      createdAt: latest.capturedAt,
    ));
  }
  return found;
}
