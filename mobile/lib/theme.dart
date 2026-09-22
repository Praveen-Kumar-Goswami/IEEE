import "package:flutter/material.dart";

const primary = Color(0xFF087F6B);
const primaryDark = Color(0xFF056052);
const lightPrimary = Color(0xFFDDF3EC);
const canvas = Color(0xFFF4FBF7);
const ink = Color(0xFF263330);
const muted = Color(0xFF687572);
const line = Color(0xFFDDE6E3);
const normalGreen = Color(0xFF16845B);
const warningAmber = Color(0xFFD99A19);
const alertRed = Color(0xFFD94A4A);
const infoBlue = Color(0xFF3B82A0);

ThemeData buildAppTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: primary,
    onPrimary: Colors.white,
    secondary: infoBlue,
    onSecondary: Colors.white,
    error: alertRed,
    onError: Colors.white,
    surface: Colors.white,
    onSurface: ink,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: canvas,
    textTheme: const TextTheme(
      headlineMedium: TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.4, color: ink),
      titleLarge: TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.3, color: ink),
      titleMedium: TextStyle(fontWeight: FontWeight.w700, color: ink),
      bodyMedium: TextStyle(height: 1.35, color: muted),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: canvas,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: line)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: line)),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: primary, width: 1.4),
      ),
      labelStyle: const TextStyle(color: muted),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: primary,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        side: const BorderSide(color: line),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      height: 68,
      backgroundColor: Colors.white,
      indicatorColor: lightPrimary,
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(color: selected ? primary : muted, size: 24);
      }),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 12,
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? primary : muted,
        );
      }),
    ),
  );
}

class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.color = Colors.white});

  final Widget child;
  final EdgeInsets padding;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color == Colors.white ? line : color),
        boxShadow: const [
          BoxShadow(color: Color(0x0A263330), blurRadius: 16, offset: Offset(0, 6)),
        ],
      ),
      child: child,
    );
  }
}
