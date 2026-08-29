import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;

import 'package:nemu/injection_container.dart';
import 'package:nemu/core/utils/constants.dart';
import 'package:nemu/core/utils/overlay_manager.dart';
import 'package:nemu/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:nemu/features/security/presentation/cubit/security_cubit.dart';
import 'package:nemu/features/remote_config/presentation/cubit/remote_config_cubit.dart';
import 'package:nemu/features/app_update/presentation/cubit/app_update_cubit.dart';
import 'package:nemu/features/app_update/presentation/widgets/update_icon_button.dart';

import '../widgets/notifications_bottom_sheet.dart';
import '../widgets/security_card_widget.dart';
import '../widgets/user_profile_card.dart';
import '../widgets/quick_actions_grid.dart';

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
    _webcamCheckTimer = Timer.periodic(const Duration(seconds: 4), (_) {
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
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.notifications_active, color: Colors.blueAccent, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
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
                          await Future.wait([
                            context.read<SecurityCubit>().checkConnection(),
                            context.read<AppUpdateCubit>().checkForUpdate(AppConstants.appVersion),
                          ]);
                        },
                        child: SingleChildScrollView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          child: Column(
                            children: [
                              UserProfileCard(user: user),
                              const SizedBox(height: 12),
                              QuickActionsGrid(
                                user: user,
                                isWebcamConnected: _isWebcamConnected,
                                showOverlay: _showOverlay,
                                onToggleOverlay: _toggleOverlay,
                                onRefreshWebcam: _checkWebcamStatus,
                              ),
                              const SizedBox(height: 20),
                              SecurityCardWidget(user: user),
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
}
