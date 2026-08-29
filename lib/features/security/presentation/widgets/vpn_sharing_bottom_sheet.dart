import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:nemu/core/services/root_sharing_service.dart';
import 'package:nemu/core/utils/constants.dart';
import 'package:nemu/core/utils/overlay_manager.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'app_share_bottom_sheet.dart';

class VpnSharingBottomSheet extends StatefulWidget {
  const VpnSharingBottomSheet({super.key});

  static Future<String> getHotspotIP() async {
    try {
      const platform = MethodChannel('com.nemu.nemu/overlay');
      final String? ip = await platform.invokeMethod<String>('getHotspotIP');
      if (ip != null && ip.isNotEmpty) {
        debugPrint('[HotspotIP] Native result: $ip');
        return ip;
      }
    } catch (e) {
      debugPrint('[HotspotIP] Native call failed: $e');
    }

    try {
      final interfaces = await NetworkInterface.list(
        type: InternetAddressType.IPv4,
        includeLinkLocal: false,
      );

      bool isVpnRange(String ip) {
        if (ip.startsWith('127.') || ip.startsWith('100.') || ip.startsWith('26.26.')) return true;
        final parts = ip.split('.');
        if (parts.length == 4 && parts[0] == '172') {
          final s = int.tryParse(parts[1]) ?? 0;
          if (s >= 16 && s <= 31) return true;
        }
        return false;
      }

      bool isHomeWifi(String ip) =>
          ip.startsWith('192.168.0.') ||
          ip.startsWith('192.168.1.') ||
          ip.startsWith('192.168.2.');

      const excludeNames = ['tun', 'vpn', 'ppp', 'rmnet', 'ccmni', 'dummy', 'lo', 'docker'];

      for (var iface in interfaces) {
        final name = iface.name.toLowerCase();
        if (excludeNames.any((n) => name.contains(n))) continue;
        for (var addr in iface.addresses) {
          if (addr.isLoopback) continue;
          final ip = addr.address;
          if (isVpnRange(ip)) continue;
          if (isHomeWifi(ip)) continue;
          return ip;
        }
      }

      for (var iface in interfaces) {
        final name = iface.name.toLowerCase();
        if (excludeNames.any((n) => name.contains(n))) continue;
        for (var addr in iface.addresses) {
          if (addr.isLoopback) continue;
          if (!isVpnRange(addr.address)) return addr.address;
        }
      }
    } catch (e) {
      debugPrint('[HotspotIP] Error: $e');
    }
    return AppConstants.defaultHotspotFallbackIp;
  }

  static void show(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.black,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (context) => const VpnSharingBottomSheet(),
    );
  }

  @override
  State<VpnSharingBottomSheet> createState() => _VpnSharingBottomSheetState();
}

class _VpnSharingBottomSheetState extends State<VpnSharingBottomSheet> {
  int _selectedQrMode = 0; // 0: WiFi connect, 1: Proxy URL
  final TextEditingController _ssidController = TextEditingController();
  final TextEditingController _passController = TextEditingController();
  bool _isStrictRunning = false;

  @override
  void initState() {
    super.initState();
    _loadSavedHotspotCredentials();
  }

  Future<void> _loadSavedHotspotCredentials() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedSsid = prefs.getString('hotspot_custom_ssid') ?? "NemuHotspot";
      final savedPass = prefs.getString('hotspot_custom_pass') ?? "12345678";
      if (mounted) {
        setState(() {
          _ssidController.text = savedSsid;
          _passController.text = savedPass;
        });
      }
    } catch (_) {
      _ssidController.text = "NemuHotspot";
      _passController.text = "12345678";
    }
  }

  Future<void> _saveHotspotCredentials() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('hotspot_custom_ssid', _ssidController.text);
      await prefs.setString('hotspot_custom_pass', _passController.text);
    } catch (_) {}
  }

  @override
  void dispose() {
    _ssidController.dispose();
    _passController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<dynamic>>(
      future: Future.wait([
        VpnSharingBottomSheet.getHotspotIP(),
        RootSharingService().checkRoot(),
      ]),
      builder: (context, snapshot) {
        final ipAddress = (snapshot.data != null && snapshot.data![0] != null)
            ? snapshot.data![0] as String
            : AppConstants.defaultHotspotFallbackIp;
        final hasRoot = (snapshot.data != null && snapshot.data!.length > 1)
            ? snapshot.data![1] as bool
            : false;
        final proxyUrl = "socks5://$ipAddress:${AppConstants.localSocksPort}";

        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
                border: Border.all(color: Colors.white.withOpacity(0.05), width: 1),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.settings_input_antenna, size: 28, color: Colors.greenAccent),
                        const SizedBox(width: 8),
                        const Text(
                          "مشاركة اتصال الـ VPN",
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.greenAccent,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "شارك اتصال الـ VPN الحالي مع الهواتف الأخرى المتصلة بالهوت سبوت الخاص بك بدون الحاجة لتثبيت التطبيق عليها.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                    ),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(16),
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: Colors.amberAccent.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.amberAccent.withOpacity(0.3), width: 1),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.shield_outlined, color: Colors.amberAccent, size: 28),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  "وضع الحظر التام (Strict Proxy Only)",
                                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  "منع تسريب أي إنترنت مباشر للأجهزة المتصلة إلا بعد كتابة الهوست والمنفذ.",
                                  style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _isStrictRunning ? Colors.redAccent : Colors.amberAccent,
                              foregroundColor: AppTheme.darkInk,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () async {
                              if (_isStrictRunning) {
                                final stopped = await OverlayManager.stopStrictHotspot();
                                if (stopped) {
                                  _isStrictRunning = false;
                                  await _loadSavedHotspotCredentials();
                                  setModalState(() {});
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text("تم إيقاف الهوت سبوت الآمن")),
                                    );
                                  }
                                }
                              } else {
                                final res = await OverlayManager.startStrictHotspot();
                                if (res != null && res['success'] == true) {
                                  _isStrictRunning = true;
                                  if (res['ssid'] != null && res['ssid'].toString().isNotEmpty) {
                                    _ssidController.text = res['ssid'];
                                  }
                                  if (res['password'] != null && res['password'].toString().isNotEmpty) {
                                    _passController.text = res['password'];
                                  }
                                  setModalState(() {});
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text("تم تشغيل الهوت سبوت الآمن! لن يعمل الإنترنت إلا بالبروكسي 🛡️")),
                                    );
                                  }
                                } else {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text("فشل تشغيل النمط المعزول: ${res?['error'] ?? 'غير مدعوم'}")),
                                    );
                                  }
                                }
                              }
                            },
                            child: Text(
                              _isStrictRunning ? "إيقاف" : "تشغيل الآمن",
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (hasRoot) ...[
                      Container(
                        padding: const EdgeInsets.all(16),
                        margin: const EdgeInsets.only(bottom: 20),
                        decoration: BoxDecoration(
                          color: Colors.greenAccent.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.greenAccent.withOpacity(0.2), width: 1),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.security, color: Colors.greenAccent, size: 28),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    "مشاركة الروت التلقائية (Root Auto Share)",
                                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    "مشاركة اتصال البروكسي تلقائياً مع الأجهزة المتصلة بالهوت سبوت دون أي إعداد يدوي عليها.",
                                    style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                            Switch(
                              value: RootSharingService().isSharing,
                              onChanged: (val) async {
                                if (val) {
                                  final success = await RootSharingService().enableRootSharing();
                                  if (success) {
                                    setModalState(() {});
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text("تم تفعيل مشاركة الاتصال التلقائية بنجاح! 👑")),
                                    );
                                  } else {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text("فشل تفعيل مشاركة الاتصال. يرجى التحقق من صلاحيات الروت.")),
                                    );
                                  }
                                } else {
                                  final success = await RootSharingService().disableRootSharing();
                                  if (success) {
                                    setModalState(() {});
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text("تم إيقاف مشاركة الاتصال التلقائية.")),
                                    );
                                  }
                                }
                              },
                              activeColor: Colors.greenAccent,
                            ),
                          ],
                        ),
                      ),
                    ],
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.03),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withOpacity(0.08)),
                      ),
                      child: Column(
                        children: [
                          _buildSharingDetailRow(context, "عنوان IP للبروكسي (Host)", ipAddress),
                          const Divider(color: Colors.white10, height: 20),
                          _buildSharingDetailRow(context, "المنفذ للـ Proxy اليدوي (HTTP)", "${AppConstants.localHttpPort}"),
                          const Divider(color: Colors.white10, height: 20),
                          _buildSharingDetailRow(context, "منفذ SOCKS5 (للتطبيقات)", "${AppConstants.localSocksPort}"),
                          const Divider(color: Colors.white10, height: 20),
                          _buildSharingDetailRow(context, "الـ Private DNS (لمنع التسريب 🛡️)", "one.one.one.one"),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.06),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: GestureDetector(
                              onTap: () {
                                setModalState(() {
                                  _selectedQrMode = 0;
                                });
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: _selectedQrMode == 0 ? Colors.greenAccent : Colors.transparent,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  "اتصال واي فاي سريع 📶",
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: _selectedQrMode == 0 ? Colors.black : Colors.white70,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: () {
                                setModalState(() {
                                  _selectedQrMode = 1;
                                });
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                decoration: BoxDecoration(
                                  color: _selectedQrMode == 1 ? Colors.greenAccent : Colors.transparent,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  "إعدادات البروكسي ⚡",
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: _selectedQrMode == 1 ? Colors.black : Colors.white70,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    if (_selectedQrMode == 0) ...[
                      Text(
                        "امسح الكاميرا من الهاتف الآخر للاتصال بالهوت سبوت فوراً:",
                        style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11),
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _ssidController,
                              style: const TextStyle(color: Colors.white, fontSize: 12),
                              decoration: InputDecoration(
                                labelText: "اسم الهوت سبوت (SSID)",
                                labelStyle: const TextStyle(color: Colors.white38, fontSize: 11),
                                isDense: true,
                                filled: true,
                                fillColor: Colors.white.withOpacity(0.04),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                              ),
                              onChanged: (_) {
                                _saveHotspotCredentials();
                                setModalState(() {});
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _passController,
                              style: const TextStyle(color: Colors.white, fontSize: 12),
                              decoration: InputDecoration(
                                labelText: "كلمة السر (Password)",
                                labelStyle: const TextStyle(color: Colors.white38, fontSize: 11),
                                isDense: true,
                                filled: true,
                                fillColor: Colors.white.withOpacity(0.04),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                              ),
                              onChanged: (_) {
                                _saveHotspotCredentials();
                                setModalState(() {});
                              },
                            ),
                          ),
                        ],
                      ),
                    ] else ...[
                      Text(
                        "كود إعدادات البروكسي لبرامج الشبكة:",
                        style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.greenAccent.withOpacity(0.1),
                            blurRadius: 20,
                            spreadRadius: 1,
                          )
                        ],
                      ),
                      child: QrImageView(
                        data: _selectedQrMode == 0
                            ? "WIFI:S:${_ssidController.text};T:WPA;P:${_passController.text};;"
                            : proxyUrl,
                        version: QrVersions.auto,
                        size: 140.0,
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
                    const SizedBox(height: 24),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.03),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withOpacity(0.05)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "طريقة الإعداد على الهاتف الآخر:",
                            style: TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 12),
                          _buildSharingStepRow("1", "قم بتشغيل نقطة الاتصال (Hotspot) في هذا الهاتف."),
                          const SizedBox(height: 8),
                          _buildSharingStepRow("2", "قم بتوصيل الهاتف الآخر بنفس شبكة الهوت سبوت."),
                          const SizedBox(height: 8),
                          _buildSharingStepRow("3", "في الهاتف الآخر، اذهب لإعدادات الواي فاي للشبكة المتصل بها -> خيارات متقدمة -> البروكسي (Proxy) -> اختر يدوي (Manual)."),
                          const SizedBox(height: 8),
                          _buildSharingStepRow("4", "أدخل الـ Host الموضح أعلاه، والـ Port أدخل ${AppConstants.localHttpPort} (أو ${AppConstants.localSocksPort} لبرامج SOCKS5) ثم اضغط حفظ."),
                          const SizedBox(height: 8),
                          _buildSharingStepRow("5", "🛡️ لمنع تسريب الـ DNS: في الهاتف الثاني اذهب للإعدادات -> Private DNS -> أدخل one.one.one.one واضغط حفظ."),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () {
                              Navigator.pop(context);
                              AppShareBottomSheet.show(context);
                            },
                            icon: const Icon(Icons.qr_code_scanner, size: 16),
                            label: const Text("مشاركة وتثبيت التطبيق APK", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white.withOpacity(0.08),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(15),
                                side: BorderSide(color: Colors.white.withOpacity(0.1)),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextButton(
                            onPressed: () => Navigator.pop(context),
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(15),
                                side: BorderSide(color: Colors.white.withOpacity(0.1)),
                              ),
                            ),
                            child: const Text("إغلاق", style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSharingDetailRow(BuildContext context, String label, String value) {
    return Row(
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11)),
            const SizedBox(height: 4),
            Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15, fontFamily: 'monospace')),
          ],
        ),
        const Spacer(),
        GestureDetector(
          onTap: () {
            Clipboard.setData(ClipboardData(text: value));
            HapticFeedback.lightImpact();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text("تم نسخ $label بنجاح! 📋"),
                backgroundColor: Colors.green,
                duration: const Duration(seconds: 1),
              ),
            );
          },
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.copy, color: Colors.white70, size: 16),
          ),
        ),
      ],
    );
  }

  Widget _buildSharingStepRow(String number, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 18,
          height: 18,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Colors.greenAccent,
            shape: BoxShape.circle,
          ),
          child: Text(
            number,
            style: const TextStyle(color: AppTheme.darkInk, fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 12, height: 1.3),
          ),
        ),
      ],
    );
  }
}
