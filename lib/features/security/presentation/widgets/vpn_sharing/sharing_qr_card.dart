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
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        children: [
          // Segmented Tab for QR Mode
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
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
                        color: _selectedQrMode == 0 ? Colors.greenAccent : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.wifi_outlined, size: 14, color: _selectedQrMode == 0 ? Colors.black : Colors.white70),
                          const SizedBox(width: 6),
                          Text(
                            "اتصال واي فاي سريع",
                            style: TextStyle(
                              color: _selectedQrMode == 0 ? Colors.black : Colors.white70,
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
                        color: _selectedQrMode == 1 ? Colors.greenAccent : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.bolt_outlined, size: 14, color: _selectedQrMode == 1 ? Colors.black : Colors.white70),
                          const SizedBox(width: 6),
                          Text(
                            "كود البروكسي ⚡",
                            style: TextStyle(
                              color: _selectedQrMode == 1 ? Colors.black : Colors.white70,
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
                      color: Colors.greenAccent.withValues(alpha: 0.1),
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
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _selectedQrMode == 0
                          ? "وجّه كاميرا الهاتف الثاني نحو الكود للاتصال بشبكة الواي فاي بدون كتابة الباسوورد."
                          : "انسخ أو امسح هذا الرابط داخل برامج الشبكة أو Minute Data.",
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Editable Fields
          if (_selectedQrMode == 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: widget.ssidController,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.wifi_outlined, size: 16, color: Colors.white38),
                      labelText: "اسم الشبكة (SSID)",
                      labelStyle: const TextStyle(color: Colors.white38, fontSize: 11),
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white.withValues(alpha: 0.04),
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
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.key_outlined, size: 16, color: Colors.white38),
                      labelText: "كلمة السر (Password)",
                      labelStyle: const TextStyle(color: Colors.white38, fontSize: 11),
                      isDense: true,
                      filled: true,
                      fillColor: Colors.white.withValues(alpha: 0.04),
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
