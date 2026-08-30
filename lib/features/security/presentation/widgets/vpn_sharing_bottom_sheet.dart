import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nemu/core/services/root_sharing_service.dart';
import 'package:nemu/core/utils/constants.dart';
import 'package:nemu/core/utils/overlay_manager.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'package:nemu/features/security/presentation/cubit/security_cubit.dart';
import 'package:nemu/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:nemu/injection_container.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app_share_bottom_sheet.dart';
import 'vpn_sharing/sharing_header_widget.dart';
import 'vpn_sharing/strict_hotspot_card.dart';
import 'vpn_sharing/sharing_qr_card.dart';
import 'vpn_sharing/proxy_details_card.dart';
import 'vpn_sharing/root_sharing_card.dart';
import 'vpn_sharing/sharing_instructions_card.dart';

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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? AppTheme.darkSurface : AppTheme.lightSurface,
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
  final TextEditingController _ssidController = TextEditingController();
  final TextEditingController _passController = TextEditingController();

  String _currentHotspotIp = AppConstants.defaultHotspotFallbackIp;
  bool _isStrictRunning = false;
  bool _hasRoot = false;
  int _connectedDevices = 0;

  // Stable future — computed once in initState, not recreated on each rebuild
  late Future<List<dynamic>> _initFuture;

  @override
  void initState() {
    super.initState();
    _initFuture = Future.wait([
      RootSharingService().checkRoot(),
      OverlayManager.isStrictHotspotRunning(),
      OverlayManager.getConnectedHotspotDevicesCount(),
    ]);
    _loadSavedHotspotCredentials();
    _refreshHotspotIp();
  }

  Future<void> _refreshHotspotIp() async {
    final ip = await VpnSharingBottomSheet.getHotspotIP();
    if (mounted) {
      setState(() => _currentHotspotIp = ip);
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

  Future<void> _saveHotspotCredentials() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.hotspotPrefKeySsid, _ssidController.text);
      await prefs.setString(AppConstants.hotspotPrefKeyPass, _passController.text);
    } catch (_) {}
  }

  Future<void> _handleStrictToggle() async {
    if (_isStrictRunning) {
      final stopped = await OverlayManager.stopStrictHotspot();
      if (stopped) {
        await _loadSavedHotspotCredentials();
        await _refreshHotspotIp();
        if (mounted) {
          setState(() => _isStrictRunning = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("تم إيقاف الهوت سبوت الآمن")),
          );
        }
      }
    } else {
      final securityCubit = sl<SecurityCubit>();
      final bool isVpnConnected = securityCubit.state is SecurityLoaded &&
          (securityCubit.state as SecurityLoaded).isConnected;

      if (!isVpnConnected) {
        final authState = sl<AuthCubit>().state;
        if (authState is AuthAuthenticated) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text("⚡ جاري تشغيل اتصال البروكسي المشفر أولاً..."),
                duration: Duration(seconds: 2),
              ),
            );
          }
          await securityCubit.toggleVpn(
            connect: true,
            ip: authState.user.proxyIp,
            port: authState.user.proxyPort,
            user: authState.user.proxyUser,
            pass: authState.user.proxyPass,
          );
          await Future.delayed(AppConstants.vpnHandshakeDelay);
        } else {
          if (mounted) {
            HapticFeedback.heavyImpact();
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text("⚠️ يرجى تسجيل الدخول أولاً لتفعيل البروكسي الآمن"),
                backgroundColor: Colors.redAccent,
              ),
            );
          }
          return;
        }
      }

      final res = await OverlayManager.startStrictHotspot();
      if (!mounted) return;

      if (res != null && res['success'] == true) {
        setState(() {
          _isStrictRunning = true;
          if (res['ssid'] != null && res['ssid'].toString().isNotEmpty) {
            _ssidController.text = res['ssid'];
          }
          if (res['password'] != null && res['password'].toString().isNotEmpty) {
            _passController.text = res['password'];
          }
        });
        Future.delayed(const Duration(milliseconds: 600), _refreshHotspotIp);
        HapticFeedback.mediumImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text("تم تفعيل البروكسي والشبكة المعزولة بنجاح! 🛡️🚀")),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("فشل تشغيل النمط المعزول: ${res?['error'] ?? 'غير مدعوم'}")),
        );
      }
    }
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
      future: _initFuture,
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          _hasRoot = snapshot.data![0] as bool;
          _connectedDevices = snapshot.data![2] as int;
          final strictFromFuture = snapshot.data![1] as bool;
          if (!_isStrictRunning && strictFromFuture) {
            _isStrictRunning = strictFromFuture;
          }
        }

        final isDark = Theme.of(context).brightness == Brightness.dark;
        final primaryTextColor = isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary;
        final secondaryTextColor = isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary;
        final proxyUrl = "socks5://$_currentHotspotIp:${AppConstants.localSocksPort}";

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            color: isDark ? AppTheme.darkSurface : AppTheme.lightSurface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.06) : AppTheme.lightBorder,
              width: 1,
            ),
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
                    color: isDark
                        ? Colors.white.withValues(alpha: 0.2)
                        : Colors.black.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 16),

                // Header
                SharingHeaderWidget(connectedDevices: _connectedDevices),
                const SizedBox(height: 20),

                // STEP 1: Strict Hotspot & Wi-Fi Access
                _buildStepSection(
                  stepNumber: "1",
                  title: "اتصال الواي فاي والهوت سبوت",
                  subtitle: "شغّل الوضع الآمن لمنع أي تسريب، أو استخدم الهوت سبوت العادي",
                  primaryColor: primaryTextColor,
                  secondaryColor: secondaryTextColor,
                  child: StrictHotspotCard(
                    isStrict: _isStrictRunning,
                    ssidController: _ssidController,
                    passController: _passController,
                    onToggle: _handleStrictToggle,
                  ),
                ),
                const SizedBox(height: 16),

                // STEP 2: QR Code & Wi-Fi Details
                SharingQrCard(
                  proxyUrl: proxyUrl,
                  ssidController: _ssidController,
                  passController: _passController,
                  onCredentialsChanged: _saveHotspotCredentials,
                ),
                const SizedBox(height: 16),

                // STEP 3: Proxy Configuration (Host & Ports)
                _buildStepSection(
                  stepNumber: "2",
                  title: "إعدادات البروكسي للهاتف الآخر",
                  subtitle: "أدخل هذه البيانات في تطبيق Minute Data أو إعدادات الواي فاي",
                  primaryColor: primaryTextColor,
                  secondaryColor: secondaryTextColor,
                  child: ProxyDetailsCard(ipAddress: _currentHotspotIp),
                ),

                // Optional Root Sharing (if device is rooted)
                if (_hasRoot) ...[
                  const SizedBox(height: 16),
                  RootSharingCard(onToggled: () => setState(() {})),
                ],

                const SizedBox(height: 16),

                // STEP 4: How-to Setup Accordion
                const SharingInstructionsCard(),

                const SizedBox(height: 20),

                // Action Footer Buttons
                _buildFooterActions(context, isDark, primaryTextColor, secondaryTextColor),
                const SizedBox(height: 8),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildStepSection({
    required String stepNumber,
    required String title,
    required String subtitle,
    required Color primaryColor,
    required Color secondaryColor,
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
                color: AppTheme.accentGreen.withValues(alpha: 0.2),
                shape: BoxShape.circle,
                border: Border.all(color: AppTheme.accentGreen, width: 1),
              ),
              child: Text(
                stepNumber,
                style: const TextStyle(
                  color: AppTheme.accentGreen,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              title,
              style: TextStyle(
                color: primaryColor,
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(right: 30, top: 2, bottom: 10),
          child: Text(
            subtitle,
            style: TextStyle(color: secondaryColor, fontSize: 11),
          ),
        ),
        child,
      ],
    );
  }

  Widget _buildFooterActions(
    BuildContext context,
    bool isDark,
    Color primaryColor,
    Color secondaryColor,
  ) {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () {
              Navigator.pop(context);
              AppShareBottomSheet.show(context);
            },
            icon: Icon(
              Icons.qr_code_scanner_outlined,
              size: 16,
              color: isDark ? Colors.white : AppTheme.primaryBlue,
            ),
            label: Text(
              "مشاركة وتثبيت التطبيق APK",
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 12,
                color: isDark ? Colors.white : AppTheme.primaryBlue,
              ),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : AppTheme.primaryBlue.withValues(alpha: 0.08),
              elevation: 0,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: BorderSide(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.1)
                      : AppTheme.primaryBlue.withValues(alpha: 0.2),
                ),
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
                side: BorderSide(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.1)
                      : AppTheme.lightBorder,
                ),
              ),
            ),
            child: Text(
              "إغلاق",
              style: TextStyle(color: secondaryColor, fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ],
    );
  }
}
