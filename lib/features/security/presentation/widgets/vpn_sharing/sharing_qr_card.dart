import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:nemu/core/theme/app_theme.dart';

class SharingQrCard extends StatefulWidget {
  final String proxyUrl;
  final TextEditingController ssidController;
  final TextEditingController passController;
  final VoidCallback onCredentialsChanged;

  const SharingQrCard({
    super.key,
    required this.proxyUrl,
    required this.ssidController,
    required this.passController,
    required this.onCredentialsChanged,
  });

  @override
  State<SharingQrCard> createState() => _SharingQrCardState();
}

class _SharingQrCardState extends State<SharingQrCard> {
  int _selectedQrMode = 0; // 0: WiFi connect, 1: Proxy URL

  String _escapeWifiQrString(String input) {
    return input
        .replaceAll(r'\', r'\\')
        .replaceAll(';', r'\;')
        .replaceAll(',', r'\,')
        .replaceAll(':', r'\:');
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryTextColor = isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary;
    final secondaryTextColor = isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.03) : AppTheme.lightCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.08) : AppTheme.lightBorder),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                )
              ],
      ),
      child: Column(
        children: [
          // Segmented Tab for QR Mode
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedQrMode = 0;
                      });
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 7),
                      decoration: BoxDecoration(
                        color: _selectedQrMode == 0 ? AppTheme.accentGreen : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.wifi_outlined,
                            size: 14,
                            color: _selectedQrMode == 0 ? AppTheme.darkInk : secondaryTextColor,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            "اتصال واي فاي سريع",
                            style: TextStyle(
                              color: _selectedQrMode == 0 ? AppTheme.darkInk : secondaryTextColor,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedQrMode = 1;
                      });
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 7),
                      decoration: BoxDecoration(
                        color: _selectedQrMode == 1 ? AppTheme.accentGreen : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.bolt_outlined,
                            size: 14,
                            color: _selectedQrMode == 1 ? AppTheme.darkInk : secondaryTextColor,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            "كود البروكسي ⚡",
                            style: TextStyle(
                              color: _selectedQrMode == 1 ? AppTheme.darkInk : secondaryTextColor,
                              fontWeight: FontWeight.bold,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // QR Code Display
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: AppTheme.accentGreen.withValues(alpha: 0.15),
                      blurRadius: 15,
                      spreadRadius: 1,
                    )
                  ],
                ),
                child: QrImageView(
                  data: _selectedQrMode == 0
                      ? "WIFI:S:${_escapeWifiQrString(widget.ssidController.text.replaceAll('\"', ''))};T:WPA;P:${_escapeWifiQrString(widget.passController.text.replaceAll('\"', ''))};;"
                      : widget.proxyUrl,
                  version: QrVersions.auto,
                  size: 110.0,
                  gapless: false,
                  eyeStyle: const QrEyeStyle(
                    eyeShape: QrEyeShape.square,
                    color: AppTheme.darkInk,
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: AppTheme.darkInk,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _selectedQrMode == 0 ? "امسح الكاميرا للاتصال فوراً 📶" : "كود إعدادات البروكسي للتطبيقات ⚡",
                      style: TextStyle(color: primaryTextColor, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _selectedQrMode == 0
                          ? "وجّه كاميرا الهاتف الثاني نحو الكود للاتصال بشبكة الواي فاي بدون كتابة الباسوورد."
                          : "انسخ أو امسح هذا الرابط داخل برامج الشبكة أو Minute Data.",
                      style: TextStyle(color: secondaryTextColor, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Text fields for SSID and Password
          if (_selectedQrMode == 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: widget.ssidController,
                    style: TextStyle(color: primaryTextColor, fontSize: 12),
                    decoration: InputDecoration(
                      prefixIcon: Icon(Icons.wifi_outlined, size: 16, color: secondaryTextColor),
                      labelText: "اسم الشبكة (SSID)",
                      labelStyle: TextStyle(color: secondaryTextColor, fontSize: 11),
                      isDense: true,
                      filled: true,
                      fillColor: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                    onChanged: (_) {
                      widget.onCredentialsChanged();
                      setState(() {});
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: widget.passController,
                    style: TextStyle(color: primaryTextColor, fontSize: 12),
                    decoration: InputDecoration(
                      prefixIcon: Icon(Icons.key_outlined, size: 16, color: secondaryTextColor),
                      labelText: "كلمة السر (Password)",
                      labelStyle: TextStyle(color: secondaryTextColor, fontSize: 11),
                      isDense: true,
                      filled: true,
                      fillColor: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                    ),
                    onChanged: (_) {
                      widget.onCredentialsChanged();
                      setState(() {});
                    },
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
