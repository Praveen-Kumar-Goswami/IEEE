import "dart:async";

import "package:flutter/material.dart";
import "package:share_plus/share_plus.dart";

import "config.dart";
import "indicators.dart";
import "monitor.dart";
import "reading_store.dart";
import "session.dart";
import "theme.dart";

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.session});

  final SessionController session;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  late final MonitorController _monitor;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _monitor = MonitorController(() => widget.session.token)..restore();
  }

  @override
  void dispose() {
    _monitor.dispose();
    super.dispose();
  }

  void _open(Widget page) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _monitor,
      builder: (context, _) {
        return Scaffold(
          body: IndexedStack(
            index: _index,
            children: [
              HomeTab(
                monitor: _monitor,
                session: widget.session,
                onOpenMonitor: () => setState(() => _index = 1),
                onOpenAlerts: () => _open(AlertsPage(monitor: _monitor)),
              ),
              MonitorTab(monitor: _monitor),
              ReadingsTab(monitor: _monitor),
              AccountTab(
                session: widget.session,
                onOpenMonitor: () => setState(() => _index = 1),
                onOpenAlerts: () => _open(AlertsPage(monitor: _monitor)),
                onOpenHistory: () => _open(HistoryPage(monitor: _monitor)),
              ),
            ],
          ),
          bottomNavigationBar: NavigationBar(
            selectedIndex: _index,
            onDestinationSelected: (value) => setState(() => _index = value),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: "Home"),
              NavigationDestination(icon: Icon(Icons.wifi_tethering), selectedIcon: Icon(Icons.wifi_tethering), label: "Monitor"),
              NavigationDestination(icon: Icon(Icons.show_chart), selectedIcon: Icon(Icons.show_chart), label: "Readings"),
              NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: "Account"),
            ],
          ),
        );
      },
    );
  }
}

class HomeTab extends StatelessWidget {
  const HomeTab({
    super.key,
    required this.monitor,
    required this.session,
    required this.onOpenMonitor,
    required this.onOpenAlerts,
  });

  final MonitorController monitor;
  final SessionController session;
  final VoidCallback onOpenMonitor;
  final VoidCallback onOpenAlerts;

  @override
  Widget build(BuildContext context) {
    final latest = _latest(monitor);
    final active = monitor.sessionId != null || monitor.link != "off";
    final alerts = _alerts(monitor);
    final window = _window(monitor.recent, const Duration(hours: 6));
    final updated = latest == null ? "No reading yet" : "Last updated ${_shortClock(latest.capturedAt)}";
    return _Scroll(
      onRefresh: () async {
        await monitor.refreshSummary();
        await monitor.reloadLocal();
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("Hello,", style: TextStyle(color: muted, fontSize: 16)),
                    Text(_firstName(session.name), style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 10),
                    const Text("Smart Dressing Monitor", style: TextStyle(color: ink, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    const Text("Better care. Healthier tomorrow.", style: TextStyle(color: muted)),
                  ],
                ),
              ),
              _Bell(count: alerts.length, onPressed: onOpenAlerts),
            ],
          ),
          const SizedBox(height: 18),
          Material(
            color: active ? primary : Colors.white,
            borderRadius: BorderRadius.circular(22),
            child: InkWell(
              borderRadius: BorderRadius.circular(22),
              onTap: onOpenMonitor,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: active ? primary : line),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 54,
                      height: 54,
                      decoration: BoxDecoration(
                        color: active ? Colors.white.withValues(alpha: 0.16) : lightPrimary,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(Icons.monitor_heart_outlined, color: active ? Colors.white : primary),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            active ? "Monitoring Active" : "Monitoring idle",
                            style: TextStyle(color: active ? Colors.white : ink, fontWeight: FontWeight.w700, fontSize: 16),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "${monitor.serial.text.trim().isEmpty ? "ESP32" : monitor.serial.text.trim()} · $updated",
                            style: TextStyle(color: active ? const Color(0xFFD7F3EA) : muted, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    Icon(Icons.chevron_right, color: active ? Colors.white : muted),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _MetricTile(icon: Icons.thermostat, label: "Temperature", value: _temp(monitor), unit: "°C", tone: _tone(monitor))),
              const SizedBox(width: 10),
              Expanded(child: _MetricTile(icon: Icons.water_drop_outlined, label: "Humidity", value: _humid(monitor), unit: "%", tone: _tone(monitor))),
              const SizedBox(width: 10),
              Expanded(child: _MetricTile(icon: Icons.waves, label: "Moisture", value: _moist(monitor), unit: "ADC", tone: _tone(monitor))),
            ],
          ),
          const SizedBox(height: 14),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(child: Text("Temperature Trend", style: TextStyle(fontWeight: FontWeight.w700, color: ink))),
                    Text("Last 6 hours", style: TextStyle(color: muted.withValues(alpha: 0.9), fontSize: 12)),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(height: 140, child: TrendChart(values: window.map((row) => row.localizedTemperatureC).toList(), color: primary)),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: onOpenAlerts,
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: alerts.isEmpty ? line : const Color(0xFFF3C9C9)),
                  color: alerts.isEmpty ? Colors.white : const Color(0xFFFFF6F6),
                ),
                child: Row(
                  children: [
                    Icon(alerts.isEmpty ? Icons.info_outline : Icons.warning_amber_rounded, color: alerts.isEmpty ? infoBlue : alertRed),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            alerts.isEmpty ? "No alerts at the moment" : _alertTitle(alerts.first),
                            style: const TextStyle(fontWeight: FontWeight.w700, color: ink),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            alerts.isEmpty ? "Readings are inside the configured monitoring range." : _alertBody(alerts.first),
                            style: const TextStyle(color: muted, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: muted),
                  ],
                ),
              ),
            ),
          ),
          if (monitor.pending > 0) ...[
            const SizedBox(height: 14),
            FilledButton(onPressed: monitor.busy ? null : monitor.sync, child: Text("Sync ${monitor.pending} reading(s)")),
          ],
          if (monitor.status.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(monitor.status, style: const TextStyle(color: muted, fontSize: 13)),
          ],
        ],
      ),
    );
  }
}

class MonitorTab extends StatelessWidget {
  const MonitorTab({super.key, required this.monitor});

  final MonitorController monitor;

  @override
  Widget build(BuildContext context) {
    final latest = _latest(monitor);
    final active = monitor.sessionId != null;
    return _Scroll(
      onRefresh: monitor.reloadLocal,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Heading(title: "Monitor", subtitle: "Capture the dressing environment without removing it."),
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            child: Column(
              children: [
                _FieldRow(icon: Icons.verified_user_outlined, label: "Device serial", controller: monitor.serial),
                const Divider(height: 1, color: line),
                _FieldRow(icon: Icons.healing_outlined, label: "Simulated dressing", controller: monitor.label),
              ],
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: monitor.busy ? null : (active ? monitor.endSession : monitor.startSession),
            icon: Icon(active ? Icons.stop_rounded : Icons.play_arrow_rounded),
            label: Text(active ? "End session" : "Start session"),
          ),
          const SizedBox(height: 14),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("Current session", style: TextStyle(fontWeight: FontWeight.w700, color: ink, fontSize: 16)),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _SessionFact(label: "Duration", value: SessionClock(startedAt: monitor.sessionStartedAt, active: active))),
                    Expanded(child: _SessionFact(label: "Last reading", value: Text(latest == null ? "--:--" : _shortClock(latest.capturedAt), style: const TextStyle(fontWeight: FontWeight.w700, color: ink)))),
                    Expanded(
                      child: _SessionFact(
                        label: "Status",
                        value: Row(
                          children: [
                            Container(width: 8, height: 8, decoration: BoxDecoration(color: active ? normalGreen : muted, shape: BoxShape.circle)),
                            const SizedBox(width: 6),
                            Text(active ? "Active" : "Idle", style: TextStyle(fontWeight: FontWeight.w700, color: active ? normalGreen : muted)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          AppCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_linkTitle(monitor), style: const TextStyle(fontWeight: FontWeight.w700, color: ink, fontSize: 16)),
                const SizedBox(height: 6),
                const Text("Scan for the ESP32. Readings are stored on the phone first."),
                const SizedBox(height: 8),
                Text(monitor.status, style: const TextStyle(color: muted, fontSize: 13)),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: monitor.busy ? null : monitor.scan,
                  icon: const Icon(Icons.bluetooth_searching),
                  label: const Text("Find sensor"),
                ),
                if (monitor.link != "off") ...[
                  const SizedBox(height: 8),
                  FilledButton(onPressed: monitor.busy ? null : () => monitor.disconnect(), child: const Text("Disconnect")),
                ],
                for (final result in monitor.found)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.bluetooth, color: primary),
                    title: Text(result.device.platformName.isEmpty ? "Unnamed device" : result.device.platformName),
                    subtitle: Text(result.device.remoteId.str),
                    trailing: TextButton(
                      onPressed: monitor.busy ? null : () => monitor.connect(result.device),
                      child: const Text("Connect"),
                    ),
                  ),
                if (monitor.link == "bluetooth") ...[
                  const SizedBox(height: 8),
                  const Text("Bluetooth is connected. Wi-Fi keeps the stream steadier."),
                  const SizedBox(height: 8),
                  TextField(controller: monitor.wifiSsid, decoration: const InputDecoration(labelText: "Wi-Fi name")),
                  const SizedBox(height: 10),
                  TextField(controller: monitor.wifiPassword, obscureText: true, decoration: const InputDecoration(labelText: "Wi-Fi password")),
                  const SizedBox(height: 12),
                  FilledButton(onPressed: monitor.busy ? null : monitor.useWifi, child: const Text("Use Wi-Fi")),
                ],
                if (monitor.link == "wifi")
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text("Receiving readings from ${monitor.wifiIp}."),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _TestReadingCard(monitor: monitor),
        ],
      ),
    );
  }
}

class _TestReadingCard extends StatefulWidget {
  const _TestReadingCard({required this.monitor});

  final MonitorController monitor;

  @override
  State<_TestReadingCard> createState() => _TestReadingCardState();
}

class _TestReadingCardState extends State<_TestReadingCard> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final monitor = widget.monitor;
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _open = !_open),
            child: Row(
              children: [
                const Expanded(child: Text("Enter a test reading", style: TextStyle(fontWeight: FontWeight.w700, color: ink))),
                Icon(_open ? Icons.expand_less : Icons.expand_more, color: muted),
              ],
            ),
          ),
          if (_open) ...[
            const SizedBox(height: 10),
            TextField(controller: monitor.temperature, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Localized °C")),
            const SizedBox(height: 10),
            TextField(controller: monitor.ambient, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Ambient °C")),
            const SizedBox(height: 10),
            TextField(controller: monitor.humidity, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Humidity %")),
            const SizedBox(height: 10),
            TextField(controller: monitor.moisture, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: "Moisture (0 to 4095)")),
            const SizedBox(height: 14),
            FilledButton(onPressed: monitor.busy ? null : monitor.addManual, child: const Text("Save sample")),
          ],
        ],
      ),
    );
  }
}

class ReadingsTab extends StatefulWidget {
  const ReadingsTab({super.key, required this.monitor});

  final MonitorController monitor;

  @override
  State<ReadingsTab> createState() => _ReadingsTabState();
}

class _ReadingsTabState extends State<ReadingsTab> {
  String _range = "1h";

  @override
  Widget build(BuildContext context) {
    final monitor = widget.monitor;
    final rows = _window(monitor.recent, _span(_range));
    final latest = rows.isEmpty ? _latest(monitor) : rows.last;
    return _Scroll(
      onRefresh: monitor.reloadLocal,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Heading(title: "Readings", subtitle: "${monitor.recent.length} stored on this phone"),
          _RangeChips(selected: _range, onSelected: (value) => setState(() => _range = value)),
          const SizedBox(height: 14),
          _SeriesCard(
            icon: Icons.thermostat,
            title: "Localized temperature",
            value: latest == null ? "–" : "${latest.localizedTemperatureC.toStringAsFixed(1)} °C",
            tone: _tone(monitor),
            values: rows.map((row) => row.localizedTemperatureC).toList(),
            color: primary,
          ),
          const SizedBox(height: 12),
          _SeriesCard(
            icon: Icons.water_drop_outlined,
            title: "Humidity",
            value: latest == null ? "–" : "${latest.humidityPercent.toStringAsFixed(0)}%",
            tone: _tone(monitor),
            values: rows.map((row) => row.humidityPercent).toList(),
            color: infoBlue,
          ),
          const SizedBox(height: 12),
          _SeriesCard(
            icon: Icons.waves,
            title: "Moisture",
            value: latest == null ? "–" : "${latest.relativeMoistureValue} ADC",
            tone: _tone(monitor),
            values: rows.map((row) => row.relativeMoistureValue.toDouble()).toList(),
            color: const Color(0xFF5B8DEF),
          ),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: monitor.busy ? null : monitor.sync, child: Text(monitor.pending == 0 ? "Sync now" : "Sync ${monitor.pending} on this phone")),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: () => _export(context, monitor), child: const Text("Export readings")),
        ],
      ),
    );
  }
}

class AlertsPage extends StatelessWidget {
  const AlertsPage({super.key, required this.monitor});

  final MonitorController monitor;

  @override
  Widget build(BuildContext context) {
    final alerts = _alerts(monitor);
    return Scaffold(
      backgroundColor: canvas,
      body: _Scroll(
        onRefresh: () async {
          await monitor.refreshSummary();
          await monitor.reloadLocal();
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _Heading(title: "Alerts", subtitle: "Stay informed about configured monitoring changes.", back: true),
            if (alerts.isEmpty)
              const AppCard(
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: normalGreen),
                    SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text("All clear", style: TextStyle(fontWeight: FontWeight.w700, color: ink)),
                          SizedBox(height: 2),
                          Text("No open monitoring indicators."),
                        ],
                      ),
                    ),
                  ],
                ),
              )
            else
              for (final alert in alerts) ...[
                _AlertCard(alert: alert),
                const SizedBox(height: 10),
              ],
            const SizedBox(height: 16),
            const Text("Alert thresholds", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: ink)),
            const SizedBox(height: 6),
            const Text("These are monitoring limits, not a diagnosis."),
            const SizedBox(height: 10),
            _ThresholdRow(
              icon: Icons.thermostat,
              title: "Temperature",
              detail: "${monitor.temperatureDelta.toStringAsFixed(1)} °C change from earlier readings",
              initial: monitor.temperatureDelta.toString(),
              note: "Localized temperature is compared with the average of earlier readings in the session. It is not a fixed fever range.",
              onSave: (text) async {
                final value = double.tryParse(text);
                if (value == null || value < 0.1 || value > 10) return "Enter a change from 0.1 to 10 °C.";
                await monitor.setTemperatureDelta(value);
                return null;
              },
            ),
            _ThresholdRow(
              icon: Icons.water_drop_outlined,
              title: "Humidity",
              detail: "Watch from ${monitor.humidityLimit.toStringAsFixed(0)}%",
              initial: monitor.humidityLimit.toStringAsFixed(0),
              note: "Humidity is watched when it reaches this threshold.",
              onSave: (text) async {
                final value = double.tryParse(text);
                if (value == null || value < 1 || value > 100) return "Enter humidity from 1 to 100.";
                await monitor.setHumidityLimit(value);
                return null;
              },
            ),
            _ThresholdRow(
              icon: Icons.waves,
              title: "Moisture",
              detail: "Attention from ${monitor.moistureLimit} ADC",
              initial: monitor.moistureLimit.toString(),
              note: "Moisture is the ESP32 ADC count from the copper sensor, from 0 to 4095. It is not a clinical exudate measurement.",
              onSave: (text) async {
                final value = int.tryParse(text);
                if (value == null || value < 1 || value > 4095) return "Enter an ADC count from 1 to 4095.";
                await monitor.setMoistureLimit(value);
                return null;
              },
            ),
          ],
        ),
      ),
    );
  }
}

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key, required this.monitor});

  final MonitorController monitor;

  @override
  Widget build(BuildContext context) {
    final groups = _groupDays(monitor.recent);
    return Scaffold(
      backgroundColor: canvas,
      body: _Scroll(
        onRefresh: monitor.reloadLocal,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _Heading(title: "Monitoring History", subtitle: "View past readings stored on this phone.", back: true),
            if (groups.isEmpty)
              const AppCard(child: Text("No readings stored yet."))
            else
              OutlinedButton(onPressed: () => _export(context, monitor), child: const Text("Export readings")),
            for (final group in groups) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 8, top: 6),
                child: Text(group.label, style: const TextStyle(fontWeight: FontWeight.w700, color: ink)),
              ),
              AppCard(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                child: Column(
                  children: [
                    for (var i = 0; i < group.rows.length; i++) ...[
                      if (i > 0) const Divider(height: 1, color: line),
                      _HistoryRow(reading: group.rows[i]),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }
}

class AccountTab extends StatelessWidget {
  const AccountTab({
    super.key,
    required this.session,
    required this.onOpenMonitor,
    required this.onOpenAlerts,
    required this.onOpenHistory,
  });

  final SessionController session;
  final VoidCallback onOpenMonitor;
  final VoidCallback onOpenAlerts;
  final VoidCallback onOpenHistory;

  @override
  Widget build(BuildContext context) {
    final name = session.name.isEmpty ? "Patient" : session.name;
    final initial = name.trim().isEmpty ? "P" : name.trim()[0].toUpperCase();
    return _Scroll(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _Heading(title: "Account", subtitle: "Patient monitoring access"),
          AppCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 26,
                  backgroundColor: lightPrimary,
                  child: Text(initial, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: primary)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w700, color: ink, fontSize: 16)),
                      const SizedBox(height: 2),
                      Text(session.email.isEmpty ? "Patient" : session.email),
                      if (session.phone.isNotEmpty) Text(session.phone),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const AppCard(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.health_and_safety_outlined, color: primary),
                SizedBox(width: 12),
                Expanded(child: Text(disclaimer)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          AppCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                _MenuRow(icon: Icons.settings_outlined, label: "Device settings", onTap: onOpenMonitor),
                const Divider(height: 1, color: line),
                _MenuRow(icon: Icons.tune, label: "Threshold settings", onTap: onOpenAlerts),
                const Divider(height: 1, color: line),
                _MenuRow(icon: Icons.history, label: "Session history", onTap: onOpenHistory),
                const Divider(height: 1, color: line),
                _MenuRow(
                  icon: Icons.info_outline,
                  label: "App information",
                  onTap: () {
                    showDialog<void>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text("Smart Dressing"),
                        content: const Text("Smart Dressing Monitor\n\n$disclaimer"),
                        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text("Close"))],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: session.signOut, child: const Text("Sign out")),
        ],
      ),
    );
  }
}

class _Scroll extends StatelessWidget {
  const _Scroll({required this.child, this.onRefresh});

  final Widget child;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final view = ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      children: [child],
    );
    return SafeArea(
      child: onRefresh == null ? view : RefreshIndicator(color: primary, onRefresh: onRefresh!, child: view),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading({required this.title, required this.subtitle, this.back = false});

  final String title;
  final String subtitle;
  final bool back;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12, bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (back)
            IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              padding: EdgeInsets.zero,
              alignment: Alignment.centerLeft,
              icon: const Icon(Icons.arrow_back, color: ink),
            ),
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 4),
          Text(subtitle),
        ],
      ),
    );
  }
}

class _Bell extends StatelessWidget {
  const _Bell({required this.count, required this.onPressed});

  final int count;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          onPressed: onPressed,
          style: IconButton.styleFrom(backgroundColor: Colors.white, side: const BorderSide(color: line)),
          icon: const Icon(Icons.notifications_none, color: ink),
        ),
        if (count > 0)
          Positioned(
            right: 8,
            top: 8,
            child: Container(width: 8, height: 8, decoration: const BoxDecoration(color: alertRed, shape: BoxShape.circle)),
          ),
      ],
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({required this.icon, required this.label, required this.value, required this.unit, required this.tone});

  final IconData icon;
  final String label;
  final String value;
  final String unit;
  final _Tone tone;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: primary, size: 18),
          const SizedBox(height: 8),
          Text(label, style: const TextStyle(fontSize: 12, color: muted)),
          const SizedBox(height: 4),
          Text(value == "–" ? "–" : "$value$unit", style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: ink)),
          const SizedBox(height: 6),
          _Pill(tone: value == "–" ? _Tone.idle : tone),
        ],
      ),
    );
  }
}

class _SeriesCard extends StatelessWidget {
  const _SeriesCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.tone,
    required this.values,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String value;
  final _Tone tone;
  final List<double> values;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(color: lightPrimary, shape: BoxShape.circle),
                child: Icon(icon, color: primary, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(title, style: const TextStyle(color: muted))),
              _Pill(tone: values.isEmpty ? _Tone.idle : tone),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: ink)),
          const SizedBox(height: 8),
          SizedBox(height: 110, child: TrendChart(values: values, color: color)),
        ],
      ),
    );
  }
}

class _RangeChips extends StatelessWidget {
  const _RangeChips({required this.selected, required this.onSelected});

  final String selected;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final label in ["1h", "6h", "24h", "7d"]) ...[
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: ChoiceChip(
                label: Center(child: Text(label)),
                selected: selected == label,
                showCheckmark: false,
                selectedColor: primary,
                backgroundColor: Colors.white,
                labelStyle: TextStyle(color: selected == label ? Colors.white : muted, fontWeight: FontWeight.w700),
                side: const BorderSide(color: line),
                onSelected: (_) => onSelected(label),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _FieldRow extends StatelessWidget {
  const _FieldRow({required this.icon, required this.label, required this.controller});

  final IconData icon;
  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: primary, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: TextField(
            controller: controller,
            decoration: InputDecoration(
              labelText: label,
              filled: false,
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
            ),
          ),
        ),
      ],
    );
  }
}

class _SessionFact extends StatelessWidget {
  const _SessionFact({required this.label, required this.value});

  final String label;
  final Widget value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: muted, fontSize: 12)),
        const SizedBox(height: 4),
        value,
      ],
    );
  }
}

class SessionClock extends StatefulWidget {
  const SessionClock({super.key, required this.startedAt, required this.active});

  final String? startedAt;
  final bool active;

  @override
  State<SessionClock> createState() => _SessionClockState();
}

class _SessionClockState extends State<SessionClock> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && widget.active) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Text(_duration(widget.startedAt, widget.active), style: const TextStyle(fontWeight: FontWeight.w700, color: ink));
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.alert});

  final Map alert;

  @override
  Widget build(BuildContext context) {
    final severe = alert["severity"]?.toString() == "attention";
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: severe ? const Color(0xFFFFF1F1) : const Color(0xFFFFF8EC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: severe ? const Color(0xFFF3C9C9) : const Color(0xFFF3E2B8)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.warning_amber_rounded, color: severe ? alertRed : warningAmber),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_alertTitle(alert), style: const TextStyle(fontWeight: FontWeight.w700, color: ink)),
                const SizedBox(height: 4),
                Text(_alertBody(alert), style: const TextStyle(color: muted)),
                const SizedBox(height: 6),
                Text(_shortClock(alert["created_at"]?.toString() ?? ""), style: const TextStyle(color: muted, fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ThresholdRow extends StatelessWidget {
  const _ThresholdRow({
    required this.icon,
    required this.title,
    required this.detail,
    required this.initial,
    required this.note,
    required this.onSave,
  });

  final IconData icon;
  final String title;
  final String detail;
  final String initial;
  final String note;
  final Future<String?> Function(String text) onSave;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AppCard(
        child: Row(
          children: [
            Icon(icon, color: primary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: ink)),
                  Text(detail, style: const TextStyle(color: muted, fontSize: 13)),
                ],
              ),
            ),
            TextButton(
              onPressed: () async {
                final saved = await showDialog<String>(
                  context: context,
                  builder: (context) => _ThresholdDialog(title: title, note: note, initial: initial),
                );
                if (saved == null || !context.mounted) return;
                final error = await onSave(saved);
                if (!context.mounted || error == null) return;
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error)));
              },
              child: const Text("Edit"),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThresholdDialog extends StatefulWidget {
  const _ThresholdDialog({required this.title, required this.note, required this.initial});

  final String title;
  final String note;
  final String initial;

  @override
  State<_ThresholdDialog> createState() => _ThresholdDialogState();
}

class _ThresholdDialogState extends State<_ThresholdDialog> {
  late final TextEditingController _controller = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(widget.note),
          const SizedBox(height: 12),
          TextField(controller: _controller, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: "Threshold")),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text("Cancel")),
        FilledButton(onPressed: () => Navigator.pop(context, _controller.text.trim()), child: const Text("Save")),
      ],
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.reading});

  final StoredReading reading;

  @override
  Widget build(BuildContext context) {
    final synced = reading.syncStatus == "synced";
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          const Icon(Icons.schedule, size: 18, color: muted),
          const SizedBox(width: 10),
          Expanded(child: Text(_clock(reading.capturedAt), style: const TextStyle(color: ink, fontWeight: FontWeight.w600))),
          Text("${reading.localizedTemperatureC.toStringAsFixed(1)} °C", style: const TextStyle(fontWeight: FontWeight.w700, color: ink)),
          const SizedBox(width: 10),
          _Pill(tone: synced ? _Tone.normal : _Tone.watch, label: synced ? "Synced" : "On phone"),
        ],
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: muted),
      title: Text(label, style: const TextStyle(color: ink, fontWeight: FontWeight.w600)),
      trailing: const Icon(Icons.chevron_right, color: muted),
      onTap: onTap,
    );
  }
}

enum _Tone { normal, watch, attention, idle }

class _Pill extends StatelessWidget {
  const _Pill({required this.tone, this.label});

  final _Tone tone;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      _Tone.normal => normalGreen,
      _Tone.watch => warningAmber,
      _Tone.attention => alertRed,
      _Tone.idle => muted,
    };
    final text = label ??
        switch (tone) {
          _Tone.normal => "Normal",
          _Tone.watch => "Watch",
          _Tone.attention => "Attention",
          _Tone.idle => "Waiting",
        };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class TrendChart extends StatelessWidget {
  const TrendChart({super.key, required this.values, required this.color});

  final List<double> values;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _TrendPainter(values, color), child: const SizedBox.expand());
  }
}

class _TrendPainter extends CustomPainter {
  _TrendPainter(this.values, this.color);

  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) {
      final idle = Paint()
        ..color = line
        ..strokeWidth = 2;
      canvas.drawLine(Offset(0, size.height * 0.55), Offset(size.width, size.height * 0.55), idle);
      return;
    }
    final minValue = values.reduce((a, b) => a < b ? a : b);
    final maxValue = values.reduce((a, b) => a > b ? a : b);
    final span = (maxValue - minValue).abs() < 0.01 ? 1.0 : maxValue - minValue;
    final path = Path();
    final fill = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * i / (values.length - 1);
      final y = size.height - ((values[i] - minValue) / span) * (size.height - 16) - 8;
      if (i == 0) {
        path.moveTo(x, y);
        fill.moveTo(x, size.height);
        fill.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fill.lineTo(x, y);
      }
    }
    fill.lineTo(size.width, size.height);
    fill.close();
    canvas.drawPath(fill, Paint()..color = color.withValues(alpha: 0.16));
    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..strokeWidth = 2.4
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(covariant _TrendPainter oldDelegate) => oldDelegate.values != values || oldDelegate.color != color;
}

class _DayGroup {
  _DayGroup(this.label, this.rows);
  final String label;
  final List<StoredReading> rows;
}

List<_DayGroup> _groupDays(List<StoredReading> rows) {
  final groups = <String, List<StoredReading>>{};
  final labels = <String, String>{};
  for (final row in rows) {
    final time = DateTime.tryParse(row.capturedAt)?.toLocal();
    if (time == null) continue;
    final key = "${time.year}-${time.month}-${time.day}";
    groups.putIfAbsent(key, () => []).add(row);
    labels[key] = _dayLabel(time);
  }
  return [
    for (final entry in groups.entries) _DayGroup(labels[entry.key]!, entry.value),
  ];
}

String _dayLabel(DateTime time) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(time.year, time.month, time.day);
  if (day == today) return "Today";
  if (day == today.subtract(const Duration(days: 1))) {
    return "Yesterday, ${time.day} ${_month(time.month)} ${time.year}";
  }
  return "${time.day} ${_month(time.month)} ${time.year}";
}

String _month(int month) {
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[month - 1];
}

String _linkTitle(MonitorController monitor) {
  if (monitor.link == "wifi") return "Wi-Fi · ${monitor.connectedName ?? "Dressing sensor"}";
  if (monitor.link == "bluetooth") return "Bluetooth · ${monitor.connectedName ?? "Dressing sensor"}";
  return "Dressing sensor";
}

StoredReading? _latest(MonitorController monitor) => monitor.recent.isEmpty ? null : monitor.recent.first;

List<StoredReading> _window(List<StoredReading> rows, Duration span) {
  final cutoff = DateTime.now().subtract(span);
  final matched = rows.where((row) {
    final time = DateTime.tryParse(row.capturedAt)?.toLocal();
    return time != null && !time.isBefore(cutoff);
  }).toList();
  return matched.reversed.toList();
}

Duration _span(String range) {
  return switch (range) {
    "1h" => const Duration(hours: 1),
    "24h" => const Duration(hours: 24),
    "7d" => const Duration(days: 7),
    _ => const Duration(hours: 6),
  };
}

List<Map> _alerts(MonitorController monitor) {
  final local = localIndicators(
    recent: monitor.recent,
    sessionId: monitor.sessionId,
    temperatureDelta: monitor.temperatureDelta,
    humidityLimit: monitor.humidityLimit,
    moistureLimit: monitor.moistureLimit,
  ).map((item) => {
        "alert_type": item.type,
        "severity": item.severity,
        "message": item.message,
        "created_at": item.createdAt,
      });
  final value = monitor.summary?["open_indicators"];
  final remote = value is List ? value.whereType<Map>() : const Iterable<Map>.empty();
  final merged = <String, Map>{};
  for (final alert in [...local, ...remote]) {
    final type = alert["alert_type"]?.toString() ?? alert["message"]?.toString() ?? "indicator";
    merged.putIfAbsent(type, () => alert);
  }
  return merged.values.toList();
}

String _alertTitle(Map alert) {
  return switch (alert["alert_type"]?.toString()) {
    "elevated_temperature" => "Temperature indicator",
    "humidity_change" => "Humidity indicator",
    "moisture_change" => "Moisture indicator",
    "device_offline" => "Device offline",
    "sync_issue" => "Sync indicator",
    _ => "Monitoring indicator",
  };
}

String _alertBody(Map alert) {
  final message = alert["message"]?.toString();
  if (message != null && message.isNotEmpty) return message;
  return "A monitoring indicator needs clinical review. This is not a diagnosis.";
}

_Tone _tone(MonitorController monitor) {
  final alerts = _alerts(monitor);
  if (alerts.any((alert) => alert["severity"] == "attention") || monitor.led == "red") return _Tone.attention;
  if (alerts.isNotEmpty || monitor.led == "yellow") return _Tone.watch;
  if (monitor.recent.isEmpty) return _Tone.idle;
  return _Tone.normal;
}

Future<void> _export(BuildContext context, MonitorController monitor) async {
  try {
    final path = await monitor.exportCsv();
    await SharePlus.instance.share(ShareParams(files: [XFile(path)], subject: "Smart Dressing readings"));
  } catch (error) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(messageOf(error))));
  }
}

String _temp(MonitorController monitor) {
  final latest = _latest(monitor);
  if (latest != null) return latest.localizedTemperatureC.toStringAsFixed(1);
  return _metric(monitor.summary?["trend"] is Map ? (monitor.summary!["trend"] as Map)["localized_temperature_c"] : null, "latest");
}

String _humid(MonitorController monitor) {
  final latest = _latest(monitor);
  if (latest != null) return latest.humidityPercent.toStringAsFixed(0);
  return _metric(monitor.summary?["trend"] is Map ? (monitor.summary!["trend"] as Map)["humidity_percent"] : null, "latest");
}

String _moist(MonitorController monitor) {
  final latest = _latest(monitor);
  if (latest != null) return latest.relativeMoistureValue.toString();
  return _metric(monitor.summary?["trend"] is Map ? (monitor.summary!["trend"] as Map)["relative_moisture_value"] : null, "latest");
}

String _metric(Object? node, String key) {
  if (node is! Map) return "–";
  final value = node[key];
  if (value == null) return "–";
  if (value is num) return value is int ? value.toString() : value.toStringAsFixed(1);
  return value.toString();
}

String _firstName(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return "there";
  return trimmed.split(RegExp(r"\s+")).first;
}

String _duration(String? iso, bool active) {
  if (!active || iso == null) return "00:00:00";
  final start = DateTime.tryParse(iso);
  if (start == null) return "00:00:00";
  final elapsed = DateTime.now().difference(start.toLocal());
  if (elapsed.isNegative) return "00:00:00";
  final hours = elapsed.inHours.toString().padLeft(2, "0");
  final minutes = (elapsed.inMinutes % 60).toString().padLeft(2, "0");
  final seconds = (elapsed.inSeconds % 60).toString().padLeft(2, "0");
  return "$hours:$minutes:$seconds";
}

String _shortClock(String iso) {
  final time = DateTime.tryParse(iso)?.toLocal();
  if (time == null) return "--:--";
  final hour = time.hour.toString().padLeft(2, "0");
  final minute = time.minute.toString().padLeft(2, "0");
  return "$hour:$minute";
}

String _clock(String iso) {
  final time = DateTime.tryParse(iso)?.toLocal();
  if (time == null) return iso;
  final hour = time.hour % 12 == 0 ? 12 : time.hour % 12;
  final minute = time.minute.toString().padLeft(2, "0");
  final suffix = time.hour >= 12 ? "PM" : "AM";
  return "$hour:$minute $suffix";
}
