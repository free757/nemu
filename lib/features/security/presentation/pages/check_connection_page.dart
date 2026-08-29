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

import '../widgets/tools_tab_section.dart';
import '../widgets/projects_tab_section.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'black_clock_screensaver_page.dart';

class CheckConnectionPage extends StatelessWidget {
  const CheckConnectionPage({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider.value(
          value: sl<SecurityCubit>()..checkConnection(),
        ),
        BlocProvider.value(
          value: sl<RemoteConfigCubit>()..fetchProjects(),
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
  int _currentTabIndex = 0;
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : AppTheme.lightBackground,
      bottomNavigationBar: _buildBottomNavigationBar(context, isDark),
      body: SafeArea(
        child: BlocBuilder<AuthCubit, AuthState>(
          builder: (context, authState) {
            if (authState is! AuthAuthenticated) return const SizedBox.shrink();
            final user = authState.user;

            return UserSessionGuard(
              userId: user.id,
              child: Column(
                children: [
                  _buildHeader(context, user.username ?? 'User', isDark),
                  Expanded(
                    child: RefreshIndicator(
                      color: Colors.greenAccent,
                      backgroundColor: isDark ? AppTheme.darkSurface : Colors.white,
                      onRefresh: () async {
                        HapticFeedback.mediumImpact();
                        await Future.wait([
                          context.read<SecurityCubit>().checkConnection(),
                          context.read<AppUpdateCubit>().checkForUpdate(AppConstants.appVersion),
                        ]);
                      },
                      child: IndexedStack(
                        index: _currentTabIndex,
                        children: [
                          // Tab 0: Dashboard
                          _buildDashboardTab(context, user, isDark),
                          // Tab 1: Projects
                          const ProjectsTabSection(),
                          // Tab 2: Tools & Sharing
                          ToolsTabSection(
                            user: user,
                            isWebcamConnected: _isWebcamConnected,
                            showOverlay: _showOverlay,
                            onToggleOverlay: _toggleOverlay,
                            onRefreshWebcam: _checkWebcamStatus,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildDashboardTab(BuildContext context, dynamic user, bool isDark) {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Column(
        children: [
          UserProfileCard(user: user),
          const SizedBox(height: 12),
          SecurityCardWidget(user: user),
          const SizedBox(height: 12),
          const LiveTrafficCard(),
          const SizedBox(height: 24),
          Text(
            "إصدار التطبيق: ${AppConstants.appVersion}",
            style: TextStyle(
              color: isDark ? Colors.white30 : Colors.black38,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildBottomNavigationBar(BuildContext context, bool isDark) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppTheme.darkSurface : Colors.white,
        border: Border(
          top: BorderSide(
            color: isDark ? Colors.white.withOpacity(0.06) : const Color(0xFFE2E8F0),
            width: 1,
          ),
        ),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -4),
                ),
              ],
      ),
      child: NavigationBar(
        selectedIndex: _currentTabIndex,
        onDestinationSelected: (index) {
          HapticFeedback.lightImpact();
          setState(() {
            _currentTabIndex = index;
          });
        },
        backgroundColor: Colors.transparent,
        indicatorColor: Colors.blueAccent.withOpacity(isDark ? 0.25 : 0.15),
        elevation: 0,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.shield_outlined),
            selectedIcon: Icon(Icons.shield, color: Colors.blueAccent),
            label: 'الرئيسية',
          ),
          NavigationDestination(
            icon: Icon(Icons.rocket_launch_outlined),
            selectedIcon: Icon(Icons.rocket_launch, color: Colors.blueAccent),
            label: 'المشاريع',
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view, color: Colors.blueAccent),
            label: 'الأدوات',
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context, String name, bool isDark) {
    final int unreadCount = _notifications.length - _lastSeenCount;
    final textPrimary = isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary;
    final textSecondary = isDark ? Colors.white.withOpacity(0.7) : AppTheme.lightTextSecondary;
    final iconColor = isDark ? Colors.white70 : AppTheme.lightTextSecondary;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 14.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("مرحباً بك 👋", style: TextStyle(color: textSecondary, fontSize: 13)),
              Text(name, style: TextStyle(color: textPrimary, fontSize: 22, fontWeight: FontWeight.bold)),
            ],
          ),
          Row(
            children: [
              IconButton(
                tooltip: "شاشة التوقف والساعة المصرية",
                icon: const Icon(Icons.bedtime_outlined, color: Colors.amberAccent, size: 24),
                onPressed: () {
                  HapticFeedback.mediumImpact();
                  BlackClockScreenSaverPage.open(context);
                },
              ),
              const SizedBox(width: 4),
              const AppUpdateIconButton(currentVersion: AppConstants.appVersion),
              const SizedBox(width: 4),
              Stack(
                clipBehavior: Clip.none,
                children: [
                  IconButton(
                    icon: Icon(Icons.notifications_none, color: iconColor, size: 26),
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
              const SizedBox(width: 4),
              IconButton(
                icon: Icon(Icons.logout, color: iconColor, size: 24),
                onPressed: () => context.read<AuthCubit>().logout(),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
