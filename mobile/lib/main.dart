import "package:flutter/material.dart";

import "config.dart";
import "session.dart";
import "shell.dart";
import "theme.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const RootApp());
}

class RootApp extends StatefulWidget {
  const RootApp({super.key});

  @override
  State<RootApp> createState() => _RootAppState();
}

class _RootAppState extends State<RootApp> {
  final _session = SessionController();

  @override
  void initState() {
    super.initState();
    _session.restore();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "Smart Dressing",
      theme: buildAppTheme(),
      home: ListenableBuilder(
        listenable: _session,
        builder: (context, _) {
          if (!_session.ready) {
            return const Scaffold(body: Center(child: CircularProgressIndicator()));
          }
          if (_session.token.isEmpty) return AuthPage(session: _session);
          return AppShell(session: _session);
        },
      ),
    );
  }
}

class AuthPage extends StatefulWidget {
  const AuthPage({super.key, required this.session});

  final SessionController session;

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _register = false;
  bool _hidePassword = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    final password = _password.text;
    if (!email.contains("@") || password.length < 8) {
      setState(() => _error = "Use a valid email and a password of at least 8 characters.");
      return;
    }
    if (_register) {
      if (_name.text.trim().length < 2) {
        setState(() => _error = "Enter your name.");
        return;
      }
      final phone = _phone.text.trim();
      if (phone.length < 7) {
        setState(() => _error = "Enter a phone number.");
        return;
      }
      if (_confirm.text != password) {
        setState(() => _error = "The two passwords do not match.");
        return;
      }
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_register) {
        await widget.session.register(
          name: _name.text.trim(),
          phone: _phone.text.trim(),
          email: email,
          password: password,
        );
      } else {
        await widget.session.signIn(email: email, password: password);
      }
    } catch (error) {
      setState(() => _error = error.toString().replaceFirst("ApiException: ", ""));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AuthBackdrop(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_register ? "Create account" : "Welcome back", style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text(_register ? "Register with your name, phone, email, and password." : "Sign in with your email and password."),
            const SizedBox(height: 18),
            SegmentedButton<bool>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: false, label: Text("Sign in")),
                ButtonSegment(value: true, label: Text("Register")),
              ],
              selected: {_register},
              onSelectionChanged: (value) => setState(() {
                _register = value.first;
                _error = null;
              }),
            ),
            const SizedBox(height: 16),
            if (_register) ...[
              TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: "Full name")),
              const SizedBox(height: 10),
              TextField(controller: _phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: "Phone")),
              const SizedBox(height: 10),
            ],
            TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: "Email")),
            const SizedBox(height: 10),
            TextField(
              controller: _password,
              obscureText: _hidePassword,
              decoration: InputDecoration(
                labelText: "Password",
                suffixIcon: IconButton(
                  onPressed: () => setState(() => _hidePassword = !_hidePassword),
                  icon: Icon(_hidePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                ),
              ),
            ),
            if (_register) ...[
              const SizedBox(height: 10),
              TextField(controller: _confirm, obscureText: _hidePassword, decoration: const InputDecoration(labelText: "Confirm password")),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              _ErrorNote(message: _error!),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: Text(_busy ? "Please wait…" : _register ? "Create account" : "Sign in"),
            ),
            const SizedBox(height: 14),
            const Text(disclaimer, style: TextStyle(fontSize: 12, color: Color(0xFF66756E))),
          ],
        ),
      ),
    );
  }
}

class AuthBackdrop extends StatelessWidget {
  const AuthBackdrop({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: canvas,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
              child: Image.asset("logo.jpeg", height: 168),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
                children: [
                  AppCard(child: child),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorNote extends StatelessWidget {
  const _ErrorNote({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFFDECEC), borderRadius: BorderRadius.circular(12)),
      child: Text(message, style: const TextStyle(color: Color(0xFF8E1B14))),
    );
  }
}
