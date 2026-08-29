import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:convert';
import 'dart:io';
import 'package:android_intent_plus/android_intent.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:nemu/injection_container.dart';
import 'package:nemu/features/remote_config/presentation/cubit/remote_config_cubit.dart';
import 'package:nemu/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:nemu/features/security/presentation/cubit/security_cubit.dart';
import 'package:nemu/features/webview/presentation/pages/webview_page.dart';
import 'package:nemu/core/utils/overlay_manager.dart';
import 'package:external_app_launcher/external_app_launcher.dart';
import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;
import 'package:nemu/features/auth/data/models/user_model.dart';
import 'package:nemu/features/app_update/presentation/cubit/app_update_cubit.dart';
import 'package:nemu/features/app_update/presentation/cubit/app_update_state.dart';
import 'package:nemu/features/app_update/presentation/widgets/update_icon_button.dart';
import 'package:nemu/core/utils/constants.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nemu/core/services/rentahuman_sync_service.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:nemu/core/services/root_sharing_service.dart';
import '../widgets/notifications_bottom_sheet.dart';
import '../widgets/vpn_sharing_bottom_sheet.dart';
import '../widgets/security_card_widget.dart';

import 'package:nemu/features/network_monitor/presentation/cubit/network_monitor_cubit.dart';
import 'package:nemu/features/network_monitor/presentation/widgets/live_traffic_card.dart';
import 'package:nemu/features/remote_config/presentation/widgets/project_buttons_section.dart';
import 'package:nemu/features/auth/presentation/widgets/user_session_guard.dart';

class CheckConnectionPage extends StatelessWidget {
  const CheckConnectionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider.value(
          value: sl<SecurityCubit>()..checkConnection(),
        ),
        BlocProvider(
          create: (context) => sl<NetworkMonitorCubit>(),
        ),
        BlocProvider(
          create: (context) => sl<RemoteConfigCubit>()..fetchProjects(),
        ),
        BlocProvider(
          create: (context) => sl<AppUpdateCubit>(),
        ),
      ],
      child: const CheckConnectionView(),
    );
  }
}

class CheckConnectionView extends StatefulWidget {
  const CheckConnectionView({super.key});

  @override
  State<CheckConnectionView> createState() => _CheckConnectionViewState();
}

class _CheckConnectionViewState extends State<CheckConnectionView> with WidgetsBindingObserver {
  StreamSubscription<List<Map<String, dynamic>>>? _notificationsSubscription;
  List<Map<String, dynamic>> _notifications = [];
  int _lastSeenCount = 0;
  bool _showOverlay = showOverlayNotifier.value;
  bool _isWebcamConnected = false;
  Timer? _webcamCheckTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _subscribeToNotifications();
    _loadOverlayPreference();
    _requestBatteryOptimizationExemption();
    _checkWebcamStatus();
    _webcamCheckTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      _checkWebcamStatus();
    });
  }

  Future<void> _requestBatteryOptimizationExemption() async {
    try {
      const platform = MethodChannel('com.nemu.nemu/overlay');
      await platform.invokeMethod('requestIgnoreBatteryOptimizations');
    } catch (_) {}
  }

  Future<void> _checkWebcamStatus() async {
    try {
      final bool connected = await OverlayManager.isExternalCameraConnected();
      if (mounted && connected != _isWebcamConnected) {
        setState(() {
          _isWebcamConnected = connected;
        });
      }
    } catch (_) {}
  }

  Future<void> _loadOverlayPreference() async {
    final prefs = await SharedPreferences.getInstance();
    final showOverlayPref = prefs.getBool('show_floating_overlay') ?? false;
    showOverlayNotifier.value = showOverlayPref;
    if (mounted) {
      setState(() {
        _showOverlay = showOverlayPref;
      });
    }
  }

  Future<void> _toggleOverlay(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('show_floating_overlay', value);
    showOverlayNotifier.value = value;
    if (mounted) {
      setState(() {
        _showOverlay = value;
      });
    }
  }

  Future<void> _syncRentAHuman() async {
    // Disabled by user request
    return;
  }

  void _subscribeToNotifications() {
    try {
      _notificationsSubscription?.cancel();
      _notificationsSubscription = Supabase.instance.client
          .from('notifications')
          .stream(primaryKey: ['id'])
          .order('created_at', ascending: false)
          .listen(
            (List<Map<String, dynamic>> data) {
              if (mounted) {
                if (data.length > _notifications.length && _notifications.isNotEmpty) {
                  final newNotif = data.first;
                  _showNewNotificationBanner(
                    newNotif['title'] ?? 'New Notification',
                    newNotif['content'] ?? '',
                  );
                }
                setState(() {
                  _notifications = data;
                });
              }
            },
            onError: (error) {
              debugPrint('[Notifications] Realtime stream error handled: $error');
            },
            cancelOnError: false,
          );
    } catch (_) {}
  }

  void _showNewNotificationBanner(String title, String content) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: Colors.transparent,
        elevation: 0,
        content: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E3A8A).withOpacity(0.95),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.blueAccent.withOpacity(0.5)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blueAccent.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.notifications_active, color: Colors.blueAccent),
              ),
              const SizedBox(width: 15),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 15),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      content,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        duration: const Duration(seconds: 4),
      ),
    );
  }

  void _showNotificationsBottomSheet() {
    NotificationsBottomSheet.show(context, _notifications);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _notificationsSubscription?.cancel();
    _webcamCheckTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      context.read<SecurityCubit>().checkConnection();
      _checkWebcamStatus();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Container(
        width: double.infinity,
        height: double.infinity,
        color: Colors.black,
        child: SafeArea(
          child: BlocBuilder<AuthCubit, AuthState>(
            builder: (context, authState) {
              if (authState is! AuthAuthenticated) return const SizedBox.shrink();
              final user = authState.user;

              return UserSessionGuard(
                userId: user.id,
                child: Column(
                  children: [
                    _buildHeader(context, user.username ?? 'User'),
                    Expanded(
                      child: RefreshIndicator(
                        color: Colors.greenAccent,
                        backgroundColor: Colors.black,
                        onRefresh: () async {
                          HapticFeedback.mediumImpact();
                          _syncRentAHuman();
                          await Future.wait([
                            context.read<SecurityCubit>().checkConnection(),
                            context.read<AppUpdateCubit>().checkForUpdate(AppConstants.appVersion),
                          ]);
                        },
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(), // Ensures pull-to-refresh works even on short screens
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          child: Column(
                            children: [
                              _buildUserCard(user),
                              const SizedBox(height: 12),
                              _buildQuickActionsGrid(context, user),
                              const SizedBox(height: 20),
                              _buildProxyCard(context, user),
                              const SizedBox(height: 12),
                              const LiveTrafficCard(),
                              const SizedBox(height: 20),
                              const ProjectButtonsSection(),
                              const SizedBox(height: 32),
                              Text(
                                "إصدار التطبيق: ${AppConstants.appVersion}",
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.35),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, String name) {
    final int unreadCount = _notifications.length - _lastSeenCount;

    return Padding(
      padding: const EdgeInsets.all(20.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Hello,", style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 16)),
              Text(name, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
            ],
          ),
          Row(
            children: [
              const AppUpdateIconButton(currentVersion: AppConstants.appVersion),
              const SizedBox(width: 8),
              Stack(
                clipBehavior: Clip.none,
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications_none, color: Colors.white70, size: 28),
                    onPressed: () {
                      setState(() {
                        _lastSeenCount = _notifications.length;
                      });
                      _showNotificationsBottomSheet();
                    },
                  ),
                  if (unreadCount > 0)
                    Positioned(
                      top: 8,
                      right: 8,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Colors.redAccent,
                          shape: BoxShape.circle,
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Text(
                          '$unreadCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.logout, color: Colors.white70, size: 26),
                onPressed: () => context.read<AuthCubit>().logout(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildUserCard(user) {
    return Card(
      color: Colors.white.withOpacity(0.05),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            const CircleAvatar(
              backgroundColor: Colors.blueAccent,
              child: Icon(Icons.person, color: Colors.white),
            ),
            const SizedBox(width: 15),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(user.phoneNumber ?? 'No Phone', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                Text(user.email ?? 'No Email', style: TextStyle(color: Colors.white.withOpacity(0.6), fontSize: 12)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionsGrid(BuildContext context, user) {
    final statusColor = _isWebcamConnected ? Colors.greenAccent : Colors.orangeAccent;
    final statusIcon = _isWebcamConnected ? Icons.videocam : Icons.videocam_off_outlined;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildGridItem(
                icon: Icons.layers,
                iconColor: Colors.blueAccent,
                title: "الزر العائم",
                onTap: () {
                  _toggleOverlay(!_showOverlay);
                  HapticFeedback.lightImpact();
                },
                trailing: SizedBox(
                  height: 30,
                  child: FittedBox(
                    fit: BoxFit.contain,
                    child: Switch(
                      value: _showOverlay,
                      onChanged: _toggleOverlay,
                      activeColor: Colors.blueAccent,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildGridItem(
                icon: Icons.security,
                iconColor: Colors.amberAccent,
                title: "بيانات الحساب",
                onTap: () => _showCredentialsBottomSheet(context, user),
                trailing: const Padding(
                  padding: EdgeInsets.only(top: 8.0),
                  child: Icon(Icons.arrow_forward_ios, size: 12, color: Colors.white38),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildGridItem(
                icon: statusIcon,
                iconColor: statusColor,
                title: "كاميرا الويب",
                onTap: () {
                  if (_isWebcamConnected) {
                    HapticFeedback.lightImpact();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("الكاميرا متصلة وتعمل بنجاح! جاهزة للعمل 🟢🎥"),
                        backgroundColor: Colors.green,
                      ),
                    );
                  } else {
                    _showWebcamHelpBottomSheet(context);
                  }
                },
                trailing: Container(
                  margin: const EdgeInsets.only(top: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _isWebcamConnected ? "متصلة" : "غير نشطة",
                    style: TextStyle(color: statusColor, fontSize: 9, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildGridItem(
                icon: Icons.qr_code_2,
                iconColor: Colors.greenAccent,
                title: "تثبيت ومشاركة",
                onTap: () => _showShareBottomSheet(context),
                trailing: const Padding(
                  padding: EdgeInsets.only(top: 8.0),
                  child: Icon(Icons.arrow_forward_ios, size: 12, color: Colors.white38),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildGridItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    return Card(
      margin: EdgeInsets.zero,
      color: Colors.white.withOpacity(0.05),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 14.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(height: 10),
              Text(
                title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              if (trailing != null) trailing,
            ],
          ),
        ),
      ),
    );
  }

  void _showCredentialsBottomSheet(BuildContext context, user) {
    String emailVal = user.email ?? '';
    String passwordVal = user.password ?? '';
    String codeVal = user.verificationCode ?? user.pin;
    bool isPasswordVisible = false;
    bool isLoading = true;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.black,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            if (isLoading) {
              isLoading = false;
              Supabase.instance.client
                  .from('app_users')
                  .select()
                  .eq('id', user.id)
                  .single()
                  .then((response) {
                final freshUser = UserModel.fromJson(response);
                if (context.mounted) {
                  context.read<AuthCubit>().updateUserInfo(freshUser);
                  setState(() {
                    emailVal = freshUser.email ?? '';
                    passwordVal = freshUser.password ?? '';
                    codeVal = freshUser.verificationCode ?? freshUser.pin;
                  });
                }
              }).catchError((_) {});
            }

            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
                border: Border.all(color: Colors.white.withOpacity(0.05), width: 1),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Center(
                    child: Icon(Icons.vpn_key, size: 36, color: Colors.amberAccent),
                  ),
                  const SizedBox(height: 10),
                  const Center(
                    child: Text(
                      "بيانات الاعتماد ورمز التحقق",
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Center(
                    child: Text(
                      "استخدم هذه البيانات لتسجيل الدخول في منصات العمل",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    "البريد الإلكتروني",
                    style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.03),
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.email_outlined, color: Colors.amberAccent, size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: SelectableText(
                            emailVal,
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                          ),
                        ),
                        GestureDetector(
                          onTap: () {
                            Clipboard.setData(ClipboardData(text: emailVal));
                            HapticFeedback.lightImpact();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("تم نسخ البريد الإلكتروني! 📋"),
                                backgroundColor: Colors.amber,
                              ),
                            );
                          },
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.copy, color: Colors.white, size: 16),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    "كلمة المرور",
                    style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.03),
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.lock_outline, color: Colors.amberAccent, size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: SelectableText(
                            isPasswordVisible ? passwordVal : '••••••••••••',
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                          ),
                        ),
                        GestureDetector(
                          onTap: () {
                            setState(() {
                              isPasswordVisible = !isPasswordVisible;
                            });
                            HapticFeedback.lightImpact();
                          },
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              isPasswordVisible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                              color: Colors.white,
                              size: 16,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () {
                            Clipboard.setData(ClipboardData(text: passwordVal));
                            HapticFeedback.lightImpact();
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text("تم نسخ كلمة المرور! 🔑"),
                                backgroundColor: Colors.amber,
                              ),
                            );
                          },
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(Icons.copy, color: Colors.white, size: 16),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.amberAccent.withOpacity(0.1),
                          Colors.orangeAccent.withOpacity(0.05),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.amberAccent.withOpacity(0.15)),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.timer_outlined, color: Colors.amberAccent, size: 16),
                            const SizedBox(width: 6),
                            Text(
                              "رمز التحقق النشط (LIVE PIN)",
                              style: TextStyle(
                                color: Colors.amberAccent.withOpacity(0.8),
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              codeVal,
                              style: const TextStyle(
                                color: Colors.amberAccent,
                                fontSize: 28,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 3,
                              ),
                            ),
                            const SizedBox(width: 15),
                            GestureDetector(
                              onTap: () {
                                Clipboard.setData(ClipboardData(text: codeVal));
                                HapticFeedback.mediumImpact();
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text("تم نسخ رمز التحقق بنجاح! ⏱️"),
                                    backgroundColor: Colors.amber,
                                  ),
                                );
                              },
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.amberAccent.withOpacity(0.2),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.copy, color: Colors.amberAccent, size: 18),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          "هذا الرمز يتطابق تلقائياً مع توقيت القاهرة لتأمين عملية تسجيل الدخول الخاصة بك.",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.4),
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text("إغلاق النافذة", style: TextStyle(fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amberAccent,
                      foregroundColor: const Color(0xFF16161A),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                    ),
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            );
          },
        );
      },
    );
  }



  void _showWebcamHelpBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.black,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
            border: Border.all(color: Colors.white.withOpacity(0.05), width: 1),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Center(
                child: Icon(Icons.usb_rounded, size: 40, color: Colors.amberAccent),
              ),
              const SizedBox(height: 10),
              const Center(
                child: Text(
                  "مساعد تشغيل الكاميرا والـ OTG",
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                ),
              ),
              const SizedBox(height: 6),
              Center(
                child: Text(
                  "حل مشكلة عدم تعرّف الهاتف على كاميرا الويب الخارجية",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
                ),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.03),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white.withOpacity(0.08)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      "💡 خطوات التفعيل السريعة:",
                      style: TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    const SizedBox(height: 12),
                    _buildStepRow("1", "اضغط على زر (فتح إعدادات الهاتف) بالأسفل."),
                    const SizedBox(height: 10),
                    _buildStepRow("2", "اكتب في شريط البحث العلوي بالإعدادات كلمة (OTG) أو (اتصال OTG)."),
                    const SizedBox(height: 10),
                    _buildStepRow("3", "قم بتفعيل الخيار (تغذية منفذ الـ USB / OTG)."),
                    const SizedBox(height: 10),
                    _buildStepRow("4", "ستجد أن ضوء الكاميرا قد اشتغل وحالة الاتصال أصبحت نشطة فوراً!"),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.redAccent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(color: Colors.redAccent.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: Colors.redAccent, size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        "ملاحظة لهواتف (Oppo, Realme, Vivo, OnePlus): يقوم النظام بإيقاف منفذ الـ OTG تلقائياً بعد 10 دقائق إذا لم تكن الكاميرا قيد الاستخدام لتوفير البطارية.",
                        style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 10, height: 1.4),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        OverlayManager.openSettings();
                        Navigator.pop(context);
                      },
                      icon: const Icon(Icons.settings, size: 18),
                      label: const Text("فتح إعدادات الهاتف", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amberAccent,
                        foregroundColor: const Color(0xFF16161A),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: () {
                      _checkWebcamStatus();
                      HapticFeedback.mediumImpact();
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text("تمت إعادة فحص حالة الكاميرا والـ OTG! 🔄"),
                          backgroundColor: Colors.blueAccent,
                        ),
                      );
                    },
                    child: const Icon(Icons.refresh, color: Colors.white),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white.withOpacity(0.08),
                      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15),
                        side: BorderSide(color: Colors.white.withOpacity(0.1)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStepRow(String number, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Colors.amberAccent,
            shape: BoxShape.circle,
          ),
          child: Text(
            number,
            style: const TextStyle(color: Color(0xFF16161A), fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 12, height: 1.3),
          ),
        ),
      ],
    );
  }



  void _showShareBottomSheet(BuildContext context) {
    final appUpdateState = context.read<AppUpdateCubit>().state;
    String apkUrl = "https://github.com/free757/nemu/releases/download/v${AppConstants.appVersion.split('+')[0]}/app-release.apk";
    if (appUpdateState is AppUpdateLoaded) {
      apkUrl = appUpdateState.updateInfo.downloadUrl;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.black,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          decoration: BoxDecoration(
            color: Colors.black,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
            border: Border.all(color: Colors.white.withOpacity(0.05), width: 1),
          ),
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
              const Icon(Icons.qr_code_scanner, size: 36, color: Colors.greenAccent),
              const SizedBox(height: 10),
              const Text(
                "تثبيت ومشاركة تطبيق Nemu",
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
              ),
              const SizedBox(height: 6),
              Text(
                "وجه كاميرا الهاتف الآخر نحو كود الـ QR لتحميل وتثبيت ملف الـ APK مباشرة",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.greenAccent.withOpacity(0.15),
                      blurRadius: 30,
                      spreadRadius: 2,
                    )
                  ],
                ),
                child: QrImageView(
                  data: apkUrl,
                  version: QrVersions.auto,
                  size: 200.0,
                  gapless: false,
                  eyeStyle: const QrEyeStyle(
                    eyeShape: QrEyeShape.square,
                    color: Color(0xFF16161A),
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: Color(0xFF16161A),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.03),
                  borderRadius: BorderRadius.circular(15),
                  border: Border.all(color: Colors.white.withOpacity(0.08)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.link, color: Colors.greenAccent, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        apkUrl,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11),
                      ),
                    ),
                    const SizedBox(width: 10),
                    GestureDetector(
                      onTap: () {
                        Clipboard.setData(ClipboardData(text: apkUrl));
                        HapticFeedback.lightImpact();
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text("تم نسخ رابط تحميل APK بنجاح! 📋"),
                            backgroundColor: Colors.green,
                          ),
                        );
                      },
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.copy, color: Colors.white, size: 16),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        HapticFeedback.mediumImpact();
                        Share.share(
                          "يمكنك تحميل وتثبيت تطبيق Nemu مباشرة من الرابط التالي:\n$apkUrl",
                          subject: "تحميل تطبيق Nemu APK",
                        );
                      },
                      icon: const Icon(Icons.share, size: 18),
                      label: const Text("مشاركة الرابط", style: TextStyle(fontWeight: FontWeight.bold)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.greenAccent,
                        foregroundColor: const Color(0xFF16161A),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text("إغلاق", style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(15),
                          side: BorderSide(color: Colors.white.withOpacity(0.1)),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
          ),
        );
      },
    );
  }

  Widget _buildProxyCard(BuildContext context, user) {
    return SecurityCardWidget(user: user);
  }

  void _showVpnSharingBottomSheet(BuildContext context) {
    VpnSharingBottomSheet.show(context);
  }

  Widget _buildInfoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Colors.white38),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(color: Colors.white38, fontSize: 13)),
          const Spacer(),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}
