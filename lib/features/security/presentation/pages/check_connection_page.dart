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

final ValueNotifier<bool> showOverlayNotifier = ValueNotifier<bool>(false);

class CheckConnectionPage extends StatelessWidget {
  const CheckConnectionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (context) => sl<SecurityCubit>()..checkConnection(),
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
    _checkWebcamStatus();
    _webcamCheckTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      _checkWebcamStatus();
    });
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
    final authState = context.read<AuthCubit>().state;
    if (authState is AuthAuthenticated) {
      final hasApiKey = authState.user.rahApiKey != null && authState.user.rahApiKey!.isNotEmpty;
      final isProxyConnected = vpnStatusNotifier.value == 'CONNECTED';

      print('[RentAHumanSyncTrigger] ℹ️ Checking sync conditions: Has API Key: $hasApiKey, Proxy Connected: $isProxyConnected');

      if (hasApiKey && isProxyConnected) {
        try {
          await RentAHumanSyncService().syncRentAHumanData(
            userId: authState.user.id,
            apiKey: authState.user.rahApiKey!,
          );
        } catch (_) {}
      } else {
        print('[RentAHumanSyncTrigger] ⚠️ Sync skipped: API Key configured = $hasApiKey, Proxy connection status = ${vpnStatusNotifier.value}');
      }
    } else {
      print('[RentAHumanSyncTrigger] ⚠️ Sync skipped: User is not authenticated.');
    }
  }

  void _subscribeToNotifications() {
    try {
      _notificationsSubscription = Supabase.instance.client
          .from('notifications')
          .stream(primaryKey: ['id'])
          .order('created_at', ascending: false)
          .listen((List<Map<String, dynamic>> data) {
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
          });
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
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return Container(
          height: MediaQuery.of(context).size.height * 0.7,
          decoration: const BoxDecoration(
            color: Color(0xFF1E293B),
            borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            boxShadow: [
              BoxShadow(color: Colors.black54, blurRadius: 20, spreadRadius: 5),
            ],
          ),
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              const SizedBox(height: 20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      "Notifications",
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.white70),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ),
              const Divider(color: Colors.white12, height: 20),
              Expanded(
                child: _notifications.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.notifications_off_outlined, color: Colors.white24, size: 60),
                            SizedBox(height: 16),
                            Text(
                              "No Notifications Yet",
                              style: TextStyle(color: Colors.white38, fontSize: 16),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                        physics: const BouncingScrollPhysics(),
                        itemCount: _notifications.length,
                        itemBuilder: (context, index) {
                          final notif = _notifications[index];
                          String dateStr = '';
                          try {
                            final parsedDate = DateTime.parse(notif['created_at']);
                            dateStr = "${parsedDate.day}/${parsedDate.month} ${parsedDate.hour.toString().padLeft(2, '0')}:${parsedDate.minute.toString().padLeft(2, '0')}";
                          } catch (_) {}

                          return Container(
                            margin: const EdgeInsets.only(bottom: 12),
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.05),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: Colors.white.withOpacity(0.05)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: Colors.blueAccent.withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: const Icon(
                                        Icons.notifications,
                                        color: Colors.blueAccent,
                                        size: 18,
                                      ),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            notif['title'] ?? '',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            dateStr,
                                            style: TextStyle(
                                              color: Colors.white.withOpacity(0.4),
                                              fontSize: 11,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 12),
                                Text(
                                  notif['content'] ?? '',
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.8),
                                    fontSize: 14,
                                    height: 1.4,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          ),
        );
      },
    );
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
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F2027), Color(0xFF203A43), Color(0xFF2C5364)],
          ),
        ),
        child: SafeArea(
          child: BlocBuilder<AuthCubit, AuthState>(
            builder: (context, authState) {
              if (authState is! AuthAuthenticated) return const SizedBox.shrink();
              final user = authState.user;

              return BlockChecker(
                userId: user.id,
                child: Column(
                  children: [
                    _buildHeader(context, user.username ?? 'User'),
                    Expanded(
                      child: RefreshIndicator(
                        color: Colors.greenAccent,
                        backgroundColor: const Color(0xFF1E1E1E),
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
                              const SizedBox(height: 30),
                              const ProjectButtonsSection(),
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
      backgroundColor: const Color(0xFF16161A),
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
                color: const Color(0xFF16161A),
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
      backgroundColor: const Color(0xFF16161A),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          decoration: BoxDecoration(
            color: const Color(0xFF16161A),
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
      backgroundColor: const Color(0xFF16161A),
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (context) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          decoration: BoxDecoration(
            color: const Color(0xFF16161A),
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
    return BlocBuilder<SecurityCubit, SecurityState>(
      builder: (context, state) {
        bool isLoaded = state is SecurityLoaded;
        bool isUSA = isLoaded && (state as SecurityLoaded).status.isUSA;
        bool isConnected = isLoaded && (state as SecurityLoaded).isConnected;
        String ip = isLoaded ? (state as SecurityLoaded).status.ip : 'Checking...';

        return Card(
          color: Colors.white.withOpacity(0.08),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(25), side: BorderSide(color: isUSA ? Colors.greenAccent.withOpacity(0.3) : Colors.white10)),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Text("Proxy Connection", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
                        const SizedBox(width: 8),
                        IconButton(
                          constraints: const BoxConstraints(),
                          padding: EdgeInsets.zero,
                          icon: const Icon(Icons.refresh, color: Colors.white54, size: 20),
                          onPressed: () {
                            HapticFeedback.lightImpact();
                            context.read<SecurityCubit>().checkConnection();
                          },
                        ),
                      ],
                    ),
                    state is SecurityLoading
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.greenAccent),
                            ),
                          )
                        : Switch(
                            value: isConnected,
                            onChanged: (val) {
                              HapticFeedback.lightImpact();
                              context.read<SecurityCubit>().toggleVpn(
                                connect: val,
                                ip: user.proxyIp,
                                port: user.proxyPort,
                                user: user.proxyUser,
                                pass: user.proxyPass,
                              );
                            },
                            activeColor: Colors.greenAccent,
                          ),
                  ],
                ),
                const Divider(color: Colors.white10, height: 30),
                _buildInfoRow(Icons.language, "Current IP", ip),
                _buildInfoRow(Icons.security, "Protocol", "SOCKS5"),
                _buildInfoRow(Icons.location_on, "Target", "United States"),
                if (isUSA)
                   const Padding(
                     padding: EdgeInsets.only(top: 10),
                     child: Text("Connected Successfully ✅", style: TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold)),
                   ),
                if (isLoaded) ...[
                  if (isConnected && (state as SecurityLoaded).status.timezoneMismatch)
                    Padding(
                      padding: const EdgeInsets.only(top: 15),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(15),
                          border: Border.all(color: Colors.red.withOpacity(0.2)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Row(
                              children: [
                                Icon(Icons.timer_off_outlined, color: Colors.redAccent, size: 20),
                                SizedBox(width: 8),
                                Text(
                                  "تعديل المنطقة الزمنية مطلوب",
                                  style: TextStyle(color: Colors.redAccent, fontSize: 13, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              "يرجى ضبط الهاتف على توقيت الـ IP الحالي:",
                              style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.black26,
                                    borderRadius: BorderRadius.circular(8),
                                    border: Border.all(color: Colors.white10),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.public, color: Colors.blueAccent, size: 14),
                                      const SizedBox(width: 6),
                                      Text(
                                        (state as SecurityLoaded).status.timezone,
                                        style: const TextStyle(color: Colors.blueAccent, fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                                      ),
                                    ],
                                  ),
                                ),
                                InkWell(
                                  onTap: () async {
                                    if (Platform.isAndroid) {
                                      const intent = AndroidIntent(
                                        action: 'android.settings.DATE_SETTINGS',
                                      );
                                      await intent.launch();
                                    } else if (Platform.isIOS) {
                                      final Uri url = Uri.parse('app-settings:');
                                      if (await canLaunchUrl(url)) {
                                        await launchUrl(url);
                                      }
                                    }
                                  },
                                  borderRadius: BorderRadius.circular(8),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: Colors.redAccent,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Row(
                                      children: [
                                        Icon(Icons.settings, color: Colors.white, size: 14),
                                        SizedBox(width: 4),
                                        Text(
                                          "الإعدادات",
                                          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
                if (state is SecurityLoading)
                   const Padding(
                     padding: EdgeInsets.only(top: 10),
                     child: Text("Updating connection status...", style: TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold)),
                   ),
              ],
            ),
          ),
        );
      },
    );
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

class ProjectButtonsSection extends StatefulWidget {
  const ProjectButtonsSection({super.key});

  @override
  State<ProjectButtonsSection> createState() => _ProjectButtonsSectionState();
}

class _ProjectButtonsSectionState extends State<ProjectButtonsSection> {
  String? _loadingProjectId;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SecurityCubit, SecurityState>(
      builder: (context, securityState) {
        if (securityState is SecurityLoaded) {
          final status = securityState.status;

          // 1. Timezone mismatch check
          if (status.timezoneMismatch) {
            return Opacity(
              opacity: 0.5,
              child: Column(
                children: [
                  const Icon(Icons.timer_off_outlined, color: Colors.white24, size: 40),
                  const SizedBox(height: 10),
                  Text("اضبط المنطقة الزمنية لفتح المشاريع", style: TextStyle(color: Colors.white.withOpacity(0.3))),
                ],
              ),
            );
          }

          // 2. Proxy connection/USA validation check
          if (!status.isUSA) {
            return Opacity(
              opacity: 0.5,
              child: Column(
                children: [
                  const Icon(Icons.lock_outline, color: Colors.white24, size: 40),
                  const SizedBox(height: 10),
                  Text("Connect to proxy to unlock projects", style: TextStyle(color: Colors.white.withOpacity(0.3))),
                ],
              ),
            );
          }
        } else {
          // If not loaded yet (initial/loading), show connection locked instructions
          return Opacity(
            opacity: 0.5,
            child: Column(
              children: [
                const Icon(Icons.lock_outline, color: Colors.white24, size: 40),
                const SizedBox(height: 10),
                Text("Connect to proxy to unlock projects", style: TextStyle(color: Colors.white.withOpacity(0.3))),
              ],
            ),
          );
        }

        return BlocBuilder<RemoteConfigCubit, RemoteConfigState>(
          builder: (context, state) {
            if (state is RemoteConfigLoading) {
              return const CircularProgressIndicator();
            } else if (state is RemoteConfigLoaded) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Available Projects", style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 15),
                  ...state.projects.where((p) {
                    final authState = context.read<AuthCubit>().state;
                    final uiSettings = authState is AuthAuthenticated ? authState.user.uiSettings : null;
                    if (uiSettings != null && uiSettings['projects'] != null && uiSettings['projects'][p.id] != null) {
                      return uiSettings['projects'][p.id] == true;
                    }
                    return p.isVisible;
                  }).map((project) {
                    final bool isLoading = _loadingProjectId == project.id;

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 15),
                      child: InkWell(
                        onTap: (_loadingProjectId != null) ? null : () async {
                          setState(() {
                            _loadingProjectId = project.id;
                          });
                          try {
                            final hasAndroidPackage = project.androidPackageName != null && project.androidPackageName!.isNotEmpty;
                            final hasIosScheme = project.iosUrlScheme != null && project.iosUrlScheme!.isNotEmpty;
                            
                            if (hasAndroidPackage || hasIosScheme) {
                              final authState = context.read<AuthCubit>().state;
                              if (authState is AuthAuthenticated) {
                                final hasPermission = await OverlayManager.checkPermission();
                                if (!hasPermission) {
                                  await OverlayManager.requestPermission();
                                }
                                
                                final securityCubit = context.read<SecurityCubit>();
                                final proxyStatusStr = securityCubit.vpnStatusNotifier.value == 'CONNECTED' ? 'active' : 'inactive';

                                String emailVal = authState.user.email ?? '';
                                String passwordVal = authState.user.password ?? '';
                                String codeVal = authState.user.verificationCode ?? authState.user.pin;

                                // Fetch live, real-time user credentials from the database before showing the overlay
                                try {
                                  final response = await Supabase.instance.client
                                      .from('app_users')
                                      .select()
                                      .eq('id', authState.user.id)
                                      .single();
                                  final freshUser = UserModel.fromJson(response);
                                  emailVal = freshUser.email ?? '';
                                  passwordVal = freshUser.password ?? '';
                                  codeVal = freshUser.verificationCode ?? freshUser.pin;
                                  
                                  // Sync local memory state
                                  if (mounted) {
                                    context.read<AuthCubit>().updateUserInfo(freshUser);
                                  }
                                } catch (e) {
                                  // Fail gracefully to cached values if network issues occur
                                }

                                await OverlayManager.showOverlay(
                                  email: emailVal,
                                  password: passwordVal,
                                  code: codeVal,
                                  proxyStatus: proxyStatusStr,
                                );
                              }

                              await LaunchApp.openApp(
                                androidPackageName: project.androidPackageName,
                                iosUrlScheme: project.iosUrlScheme,
                                appStoreLink: project.appStoreLink,
                                openStore: true,
                              );
                            } else {
                              String? userEmail;
                              String? userPassword;
                              final authState = context.read<AuthCubit>().state;
                              if (authState is AuthAuthenticated) {
                                userEmail = authState.user.email;
                                userPassword = authState.user.password;
                              }

                              if (mounted) {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => WebViewPage(
                                      config: project,
                                      autoEmail: userEmail,
                                      autoPassword: userPassword,
                                    ),
                                  ),
                                );
                              }
                            }
                          } finally {
                            if (mounted) {
                              setState(() {
                                _loadingProjectId = null;
                              });
                            }
                          }
                        },
                        child: Container(
                          padding: const EdgeInsets.all(15),
                          decoration: BoxDecoration(
                            color: Color(int.parse(project.color)).withOpacity(0.2),
                            borderRadius: BorderRadius.circular(15),
                            border: Border.all(color: Color(int.parse(project.color)).withOpacity(0.5)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(color: Color(int.parse(project.color)), borderRadius: BorderRadius.circular(10)),
                                child: const Icon(Icons.language, color: Colors.white),
                              ),
                              const SizedBox(width: 15),
                              Text(project.name, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                              const Spacer(),
                              isLoading
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white70),
                                      ),
                                    )
                                  : const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.white38),
                            ],
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ],
              );
            }
            return const SizedBox.shrink();
          },
        );
      },
    );
  }
}
class BlockChecker extends StatefulWidget {
  final String userId;
  final Widget child;
  const BlockChecker({super.key, required this.userId, required this.child});

  @override
  State<BlockChecker> createState() => _BlockCheckerState();
}

class _BlockCheckerState extends State<BlockChecker> {
  Timer? _timer;
  Timer? _heartbeatTimer;
  Timer? _rentahumanTimer;
  StreamSubscription<List<Map<String, dynamic>>>? _miscSubscription;
  StreamSubscription<List<Map<String, dynamic>>>? _remoteConfigSubscription;

  @override
  void initState() {
    super.initState();
    _checkBlockStatus();
    _timer = Timer.periodic(const Duration(seconds: 4), (timer) {
      _checkBlockStatus();
    });

    _sendHeartbeat();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      _sendHeartbeat();
    });

    _syncRentAHuman();
    _rentahumanTimer = Timer.periodic(const Duration(minutes: 5), (timer) {
      _syncRentAHuman();
    });

    // Listen to local VPN state updates to reflect colour change on overlay
    vpnStatusNotifier.addListener(_onVpnStatusChanged);

    // Listen to local overlay setting changes
    showOverlayNotifier.addListener(_onOverlayPreferenceChanged);

    // Subscribe to misc_items realtime updates to keep overlay fresh
    try {
      _miscSubscription = Supabase.instance.client
          .from('misc_items')
          .stream(primaryKey: ['id'])
          .listen((_) {
            _initOverlay();
          });
    } catch (_) {}

    // Subscribe to remote_configs realtime updates to keep overlay and projects fresh
    try {
      _remoteConfigSubscription = Supabase.instance.client
          .from('remote_configs')
          .stream(primaryKey: ['id'])
          .listen((_) {
            _initOverlay();
            if (mounted) {
              context.read<RemoteConfigCubit>().getProjects();
            }
          });
    } catch (_) {}

    // Launch the persistent floating bubble immediately
    _initOverlay();
  }

  /// Called once on startup — shows the floating bubble regardless of connection state.
  Future<void> _initOverlay() async {
    // Check if user has disabled the overlay locally
    if (!showOverlayNotifier.value) {
      OverlayManager.hideOverlay();
      return;
    }

    // 1. Check / request overlay permission
    final hasPermission = await OverlayManager.checkPermission();
    if (!hasPermission) {
      await OverlayManager.requestPermission();
      await Future.delayed(const Duration(seconds: 2));
      final granted = await OverlayManager.checkPermission();
      if (!granted) return; // User denied — cannot show overlay
    }

    if (!mounted) return;

    // 2. Get auth state
    final authState = context.read<AuthCubit>().state;
    if (authState is! AuthAuthenticated) return;

    String emailVal = authState.user.email ?? '';
    String passwordVal = authState.user.password ?? '';
    String codeVal = authState.user.verificationCode ?? authState.user.pin;

    // 3. Fetch latest credentials from Supabase
    try {
      final response = await Supabase.instance.client
          .from('app_users')
          .select()
          .eq('id', authState.user.id)
          .single();
      final freshUser = UserModel.fromJson(response);
      emailVal = freshUser.email ?? '';
      passwordVal = freshUser.password ?? '';
      codeVal = freshUser.verificationCode ?? freshUser.pin;

      if (mounted) {
        context.read<AuthCubit>().updateUserInfo(freshUser);
      }
    } catch (_) {
      // Fall back to cached credentials on network error
    }

    // 4. Fetch misc items (global, same for all users)
    String miscJson = '[]';
    try {
      final miscResponse = await Supabase.instance.client
          .from('misc_items')
          .select('title, content')
          .order('display_order', ascending: true);
      miscJson = jsonEncode(miscResponse);
    } catch (_) {}

    // 4.5 Fetch overlay button settings from remote config
    bool showOpenAppBtn = true;
    bool showMiscBtn = true;
    try {
      final configResponse = await Supabase.instance.client
          .from('remote_configs')
          .select('config_value')
          .eq('config_key', 'overlay_ui_settings')
          .maybeSingle();
      if (configResponse != null && configResponse['config_value'] != null) {
        final configValue = configResponse['config_value'] as Map<String, dynamic>;
        showOpenAppBtn = configValue['show_open_app'] ?? true;
        showMiscBtn = configValue['show_misc'] ?? true;
      }
    } catch (_) {}

    // Apply user-specific UI settings overrides if available
    final uiSettings = context.read<AuthCubit>().state is AuthAuthenticated 
        ? (context.read<AuthCubit>().state as AuthAuthenticated).user.uiSettings 
        : null;
    
    if (uiSettings != null && uiSettings['overlay'] != null) {
      if (uiSettings['overlay']['show_open_app'] != null) {
        showOpenAppBtn = uiSettings['overlay']['show_open_app'];
      }
      if (uiSettings['overlay']['show_misc'] != null) {
        showMiscBtn = uiSettings['overlay']['show_misc'];
      }
    }

    // 5. Determine current proxy colour based on VPN state
    final proxyStatus = vpnStatusNotifier.value == 'CONNECTED' ? 'active' : 'inactive';

    // 6. Show the overlay (always visible — stays until app is killed)
    await OverlayManager.showOverlay(
      email: emailVal,
      password: passwordVal,
      code: codeVal,
      proxyStatus: proxyStatus,
      miscItemsJson: miscJson,
      showOpenAppBtn: showOpenAppBtn,
      showMiscBtn: showMiscBtn,
    );
  }

  void _onOverlayPreferenceChanged() {
    if (showOverlayNotifier.value) {
      _initOverlay();
    } else {
      OverlayManager.hideOverlay();
    }
  }

  void _onVpnStatusChanged() {
    final String vpnState = vpnStatusNotifier.value;
    final String proxyStatus = vpnState == 'CONNECTED' ? 'active' : 'inactive';

    // Only update the bubble colour if overlay is active
    if (showOverlayNotifier.value) {
      OverlayManager.updateProxyStatus(proxyStatus);
    }

    // Sync status to database
    _sendHeartbeat();
  }

  Future<void> _sendHeartbeat() async {
    try {
      final String vpnState = vpnStatusNotifier.value;
      final String proxyStatus = vpnState == 'CONNECTED' ? 'active' : 'inactive';
      
      await Supabase.instance.client
          .from('app_users')
          .update({
            'proxy_status': proxyStatus,
            'proxy_last_seen': DateTime.now().toUtc().toIso8601String(),
          })
          .eq('id', widget.userId);
    } catch (_) {}
  }

  Future<void> _syncRentAHuman() async {
    final authState = context.read<AuthCubit>().state;
    if (authState is AuthAuthenticated) {
      final hasApiKey = authState.user.rahApiKey != null && authState.user.rahApiKey!.isNotEmpty;
      final isProxyConnected = vpnStatusNotifier.value == 'CONNECTED';

      print('[RentAHumanSyncTrigger] ℹ️ Checking sync conditions: Has API Key: $hasApiKey, Proxy Connected: $isProxyConnected');

      if (hasApiKey && isProxyConnected) {
        try {
          await RentAHumanSyncService().syncRentAHumanData(
            userId: authState.user.id,
            apiKey: authState.user.rahApiKey!,
          );
        } catch (_) {}
      } else {
        print('[RentAHumanSyncTrigger] ⚠️ Sync skipped: API Key configured = $hasApiKey, Proxy connection status = ${vpnStatusNotifier.value}');
      }
    } else {
      print('[RentAHumanSyncTrigger] ⚠️ Sync skipped: User is not authenticated.');
    }
  }

  Future<void> _checkBlockStatus() async {
    try {
      final response = await Supabase.instance.client
          .from('app_users')
          .select('is_blocked')
          .eq('id', widget.userId)
          .maybeSingle();
      if (response != null && response['is_blocked'] == true && mounted) {
        context.read<AuthCubit>().logout();
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _timer?.cancel();
    _heartbeatTimer?.cancel();
    _rentahumanTimer?.cancel();
    _miscSubscription?.cancel();
    _remoteConfigSubscription?.cancel();
    try {
      vpnStatusNotifier.removeListener(_onVpnStatusChanged);
    } catch (_) {}
    try {
      showOverlayNotifier.removeListener(_onOverlayPreferenceChanged);
    } catch (_) {}
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
