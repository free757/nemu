import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:nemu/core/services/root_sharing_service.dart';
import 'package:nemu/core/utils/constants.dart';
import 'package:nemu/core/utils/overlay_manager.dart';
import 'package:nemu/features/security/presentation/cubit/security_cubit.dart';
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

      bool isVpnOrForbiddenRange(String ip) {
        if (ip.startsWith('127.') || ip.startsWith('100.') || ip.startsWith('26.26.') || ip.startsWith('192.168.')) return true;
        final parts = ip.split('.');
        if (parts.length == 4 && parts[0] == '172') {
          final s = int.tryParse(parts[1]) ?? 0;
          if (s >= 16 && s <= 19) return true;
        }
        return false;
      }

      const excludeNames = ['tun', 'vpn', 'ppp', 'rmnet', 'ccmni', 'dummy', 'lo', 'docker', 'wlan0'];

      for (var iface in interfaces) {
        final name = iface.name.toLowerCase();
        if (excludeNames.any((n) => name.contains(n))) continue;
        for (var addr in iface.addresses) {
          if (addr.isLoopback) continue;
          final ip = addr.address;
          if (isVpnOrForbiddenRange(ip)) continue;
          return ip;
        }
      }

      for (var iface in interfaces) {
        final name = iface.name.toLowerCase();
        if (excludeNames.any((n) => name.contains(n))) continue;
        for (var addr in iface.addresses) {
          if (addr.isLoopback) continue;
          if (!isVpnOrForbiddenRange(addr.address)) return addr.address;
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
  String _currentHotspotIp = AppConstants.defaultHotspotFallbackIp;
  bool _isStrictRunning = false;
  bool _showManualInstructions = false;

  @override
  void initState() {
    super.initState();
    _loadSavedHotspotCredentials();
    _checkStrictHotspotStatus();
    _refreshHotspotIp();
  }

  Future<void> _refreshHotspotIp() async {
    final ip = await VpnSharingBottomSheet.getHotspotIP();
    if (mounted) {
      setState(() {
        _currentHotspotIp = ip;
      });
    }
  }

  Future<void> _checkStrictHotspotStatus() async {
    final running = await OverlayManager.isStrictHotspotRunning();
    if (mounted) {
      setState(() {
        _isStrictRunning = running;
      });
    }
  }

  Future<void> _loadSavedHotspotCredentials() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedSsid = prefs.getString(AppConstants.hotspotPrefKeySsid) ?? AppConstants.defaultHotspotSsid;
      final savedPass = prefs.getString(AppConstants.hotspotPrefKeyPass) ?? AppConstants.defaultHotspotPass;
      if (mounted) {
        setState(() {
          _ssidController.text = savedSsid;
          _passController.text = savedPass;
        });
      }
    } catch (_) {
      _ssidController.text = AppConstants.defaultHotspotSsid;
      _passController.text = AppConstants.defaultHotspotPass;
    }
  }

  String _escapeWifiQrString(String input) {
    return input
        .replaceAll(r'\', r'\\')
        .replaceAll(';', r'\;')
        .replaceAll(',', r'\,')
        .replaceAll(':', r'\:');
  }

  Future<void> _saveHotspotCredentials() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.hotspotPrefKeySsid, _ssidController.text);
      await prefs.setString(AppConstants.hotspotPrefKeyPass, _passController.text);
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
        RootSharingService().checkRoot(),
        OverlayManager.isStrictHotspotRunning(),
        OverlayManager.getConnectedHotspotDevicesCount(),
      ]),
      builder: (context, snapshot) {
        final ipAddress = _currentHotspotIp;
        final hasRoot = (snapshot.data != null && snapshot.data!.isNotEmpty)
            ? snapshot.data![0] as bool
            : false;
        final strictRunning = (snapshot.data != null && snapshot.data!.length > 1)
            ? snapshot.data![1] as bool
            : _isStrictRunning;
        final connectedDevices = (snapshot.data != null && snapshot.data!.length > 2)
            ? snapshot.data![2] as int
            : 0;
        final proxyUrl = "socks5://$ipAddress:${AppConstants.localSocksPort}";

        return StatefulBuilder(
          builder: (context, setModalState) {
            final isStrict = _isStrictRunning || strictRunning;

            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
                border: Border.all(color: Colors.white.withOpacity(0.06), width: 1),
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Handle Bar
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Header
                    _buildHeader(connectedDevices),
                    const SizedBox(height: 20),

                    // STEP 1: Strict Hotspot & Wi-Fi Access
                    _buildStepSection(
                      stepNumber: "1",
                      title: "اتصال الواي فاي والهوت سبوت",
                      subtitle: "شغّل الوضع الآمن لمنع أي تسريب، أو استخدم الهوت سبوت العادي",
                      child: _buildStrictHotspotCard(context, isStrict, setModalState),
                    ),
                    const SizedBox(height: 16),

                    // STEP 2: QR Code & Wi-Fi Details
                    _buildQrAndCredentialsCard(context, isStrict, proxyUrl, setModalState),
                    const SizedBox(height: 16),

                    // STEP 3: Proxy Configuration (Host & Ports)
                    _buildStepSection(
                      stepNumber: "2",
                      title: "إعدادات البروكسي للهاتف الآخر",
                      subtitle: "أدخل هذه البيانات في تطبيق Minute Data أو إعدادات الواي فاي",
                      child: _buildProxyDetailsCard(context, ipAddress),
                    ),

                    // Optional Root Sharing (if device is rooted)
                    if (hasRoot) ...[
                      const SizedBox(height: 16),
                      _buildRootShareCard(context, setModalState),
                    ],

                    const SizedBox(height: 16),

                    // STEP 4: How-to Setup Accordion
                    _buildHowToSetupCard(),

                    const SizedBox(height: 20),

                    // Action Footer Buttons
                    _buildFooterActions(context),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  // --- Modular UI Sub-Widgets ---

  Widget _buildHeader(int connectedDevices) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.settings_input_antenna_outlined, size: 26, color: Colors.greenAccent),
            const SizedBox(width: 8),
            const Text(
              "مشاركة اتصال الـ VPN",
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: (connectedDevices > 0 ? Colors.greenAccent : Colors.white12).withOpacity(0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: connectedDevices > 0 ? Colors.greenAccent.withOpacity(0.4) : Colors.white12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.devices_outlined,
                    size: 13,
                    color: connectedDevices > 0 ? Colors.greenAccent : Colors.white54,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    "$connectedDevices جهاز متصل",
                    style: TextStyle(
                      color: connectedDevices > 0 ? Colors.greenAccent : Colors.white54,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          "شارك اتصال البروكسي المشفر مع الهواتف الأخرى بأمان تام وعزل للنت المباشر",
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildStepSection({
    required String stepNumber,
    required String title,
    required String subtitle,
    required Widget child,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 22,
              height: 22,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.greenAccent.withOpacity(0.2),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.greenAccent, width: 1),
              ),
              child: Text(
                stepNumber,
                style: const TextStyle(color: Colors.greenAccent, fontSize: 11, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(right: 30, top: 2, bottom: 10),
          child: Text(
            subtitle,
            style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11),
          ),
        ),
        child,
      ],
    );
  }

  Widget _buildStrictHotspotCard(BuildContext context, bool isStrict, StateSetter setModalState) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isStrict ? Colors.amberAccent.withOpacity(0.08) : Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isStrict ? Colors.amberAccent.withOpacity(0.4) : Colors.white.withOpacity(0.08),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isStrict ? Icons.shield_outlined : Icons.lock_outline,
                color: isStrict ? Colors.amberAccent : Colors.white70,
                size: 24,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "وضع الحظر التام (Strict Proxy Only)",
                      style: TextStyle(
                        color: isStrict ? Colors.amberAccent : Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isStrict
                          ? "النت المباشر محظور 100% — لا اتصال إلا عبر البروكسي 🛡️"
                          : "إنشاء شبكة هوت سبوت معزولة تمنع مرور أي نت مباشر",
                      style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11),
                    ),
                  ],
                ),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isStrict ? Colors.redAccent : Colors.amberAccent,
                  foregroundColor: AppTheme.darkInk,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () async {
                  if (isStrict) {
                    final stopped = await OverlayManager.stopStrictHotspot();
                    if (stopped) {
                      _isStrictRunning = false;
                      await _loadSavedHotspotCredentials();
                      await _refreshHotspotIp();
                      setModalState(() {});
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text("تم إيقاف الهوت سبوت الآمن")),
                        );
                      }
                    }
                  } else {
                    // Check if VPN is currently active and connected
                    final securityState = context.read<SecurityCubit>().state;
                    final bool isVpnConnected = securityState is SecurityLoaded && securityState.isConnected;
                    if (!isVpnConnected) {
                      if (context.mounted) {
                        HapticFeedback.heavyImpact();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("⚠️ يجب تشغيل اتصال الـ VPN أولاً قبل تفعيل شبكة الحظر الآمن!"),
                            backgroundColor: Colors.redAccent,
                            duration: Duration(seconds: 3),
                          ),
                        );
                      }
                      return;
                    }

                    final res = await OverlayManager.startStrictHotspot();
                    if (res != null && res['success'] == true) {
                      _isStrictRunning = true;
                      if (res['ssid'] != null && res['ssid'].toString().isNotEmpty) {
                        _ssidController.text = res['ssid'];
                      }
                      if (res['password'] != null && res['password'].toString().isNotEmpty) {
                        _passController.text = res['password'];
                      }
                      // Wait a brief moment for Android ap0 interface to come up then refresh IP live
                      Future.delayed(const Duration(milliseconds: 600), () async {
                        await _refreshHotspotIp();
                        if (context.mounted) {
                          setModalState(() {});
                        }
                      });
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
                icon: Icon(isStrict ? Icons.power_settings_new_outlined : Icons.security_outlined, size: 14),
                label: Text(
                  isStrict ? "إيقاف" : "تشغيل الآمن",
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                ),
              ),
            ],
          ),
          if (isStrict) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: Colors.amberAccent.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amberAccent.withOpacity(0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.wifi_lock_outlined, color: Colors.amberAccent, size: 15),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      "الشبكة: ${_ssidController.text}",
                      style: const TextStyle(color: Colors.amberAccent, fontSize: 11, fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: _passController.text));
                      HapticFeedback.lightImpact();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("تم نسخ كلمة مرور الشبكة الآمنة 📋"), duration: Duration(seconds: 1)),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.amberAccent.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.copy_outlined, size: 11, color: Colors.white),
                          SizedBox(width: 4),
                          Text("نسخ الباسوورد", style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildQrAndCredentialsCard(
    BuildContext context,
    bool isStrict,
    String proxyUrl,
    StateSetter setModalState,
  ) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        children: [
          // Segmented Tab for QR Mode
          Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.06),
              borderRadius: BorderRadius.circular(12),
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
                      setModalState(() {
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
                      color: Colors.greenAccent.withOpacity(0.1),
                      blurRadius: 15,
                      spreadRadius: 1,
                    )
                  ],
                ),
                child: QrImageView(
                  data: _selectedQrMode == 0
                      ? "WIFI:S:${_escapeWifiQrString(_ssidController.text.replaceAll('\"', ''))};T:WPA;P:${_escapeWifiQrString(_passController.text.replaceAll('\"', ''))};;"
                      : proxyUrl,
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
                      style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Text fields for SSID and Password (editable in standard mode, info in strict)
          if (_selectedQrMode == 0) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _ssidController,
                    style: const TextStyle(color: Colors.white, fontSize: 12),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.wifi_outlined, size: 16, color: Colors.white38),
                      labelText: "اسم الشبكة (SSID)",
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
                      prefixIcon: const Icon(Icons.key_outlined, size: 16, color: Colors.white38),
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
          ],
        ],
      ),
    );
  }

  Widget _buildProxyDetailsCard(BuildContext context, String ipAddress) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        children: [
          _buildSharingDetailRow(context, "عنوان IP للبروكسي (Host)", ipAddress, Icons.computer_outlined),
          const Divider(color: Colors.white10, height: 16),
          _buildSharingDetailRow(context, "المنفذ اليدوي (HTTP Port)", "${AppConstants.localHttpPort}", Icons.alt_route_outlined),
          const Divider(color: Colors.white10, height: 16),
          _buildSharingDetailRow(context, "منفذ التطبيقات (SOCKS5 Port)", "${AppConstants.localSocksPort}", Icons.cable_outlined),
          const Divider(color: Colors.white10, height: 16),
          _buildSharingDetailRow(context, "الـ Private DNS (لمنع التسريب)", AppConstants.privateDnsOneDot, Icons.dns_outlined),
        ],
      ),
    );
  }

  Widget _buildRootShareCard(BuildContext context, StateSetter setModalState) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.greenAccent.withOpacity(0.05),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.greenAccent.withOpacity(0.2), width: 1),
      ),
      child: Row(
        children: [
          const Icon(Icons.admin_panel_settings_outlined, color: Colors.greenAccent, size: 26),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "مشاركة الروت التلقائية (Root Auto Share)",
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 2),
                Text(
                  "مشاركة اتصال البروكسي تلقائياً دون أي إعداد يدوي على الهواتف المتصلة.",
                  style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 11),
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
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("تم تفعيل مشاركة الاتصال التلقائية بنجاح! 👑")),
                    );
                  }
                } else {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("فشل تفعيل مشاركة الاتصال. يرجى التحقق من صلاحيات الروت.")),
                    );
                  }
                }
              } else {
                final success = await RootSharingService().disableRootSharing();
                if (success) {
                  setModalState(() {});
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("تم إيقاف مشاركة الاتصال التلقائية.")),
                    );
                  }
                }
              }
            },
            activeColor: Colors.greenAccent,
          ),
        ],
      ),
    );
  }

  Widget _buildHowToSetupCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.02),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: () {
              setState(() {
                _showManualInstructions = !_showManualInstructions;
              });
            },
            child: Row(
              children: [
                const Icon(Icons.help_outline, color: Colors.greenAccent, size: 18),
                const SizedBox(width: 8),
                const Text(
                  "خطوات الإعداد على الهاتف الآخر (Minute Data)",
                  style: TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const Spacer(),
                Icon(
                  _showManualInstructions ? Icons.expand_less_outlined : Icons.expand_more_outlined,
                  color: Colors.white54,
                  size: 18,
                ),
              ],
            ),
          ),
          if (_showManualInstructions) ...[
            const SizedBox(height: 12),
            _buildSharingStepRow("1", "اتصل بشبكة الهوت سبوت (أو امسح كود الـ QR بالكاميرا)."),
            const SizedBox(height: 6),
            _buildSharingStepRow("2", "في الهاتف الآخر، ادخل إعدادات شبكة الواي فاي -> خيارات متقدمة -> البروكسي (Proxy) -> يدوي (Manual)."),
            const SizedBox(height: 6),
            _buildSharingStepRow("3", "اكتب عنوان الـ Host والمنفذ ${AppConstants.localHttpPort} (أو ضعهما داخل Minute Data مباشرة)."),
            const SizedBox(height: 6),
            _buildSharingStepRow("4", "🛡️ لمنع تسريب الـ DNS: في إعدادات الهاتف الثاني اذهب إلى Private DNS -> واكتب: ${AppConstants.privateDnsOneDot}."),
          ],
        ],
      ),
    );
  }

  Widget _buildFooterActions(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(context);
              AppShareBottomSheet.show(context);
            },
            icon: const Icon(Icons.qr_code_scanner_outlined, size: 16),
            label: const Text("مشاركة وتثبيت التطبيق APK", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white.withOpacity(0.08),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
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
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(color: Colors.white.withOpacity(0.1)),
              ),
            ),
            child: const Text("إغلاق", style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
          ),
        ),
      ],
    );
  }

  Widget _buildSharingDetailRow(BuildContext context, String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: Colors.white54, size: 18),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11)),
            const SizedBox(height: 2),
            Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14, fontFamily: 'monospace')),
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
              color: Colors.white.withOpacity(0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.copy_outlined, color: Colors.white70, size: 16),
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
          width: 16,
          height: 16,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Colors.greenAccent,
            shape: BoxShape.circle,
          ),
          child: Text(
            number,
            style: const TextStyle(color: AppTheme.darkInk, fontSize: 10, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 11, height: 1.3),
          ),
        ),
      ],
    );
  }
}
