import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

class _CheckConnectionViewState extends State<CheckConnectionView> {
  StreamSubscription<List<Map<String, dynamic>>>? _notificationsSubscription;
  List<Map<String, dynamic>> _notifications = [];
  int _lastSeenCount = 0;

  @override
  void initState() {
    super.initState();
    _subscribeToNotifications();
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
    _notificationsSubscription?.cancel();
    super.dispose();
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
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                        child: Column(
                          children: [
                            _buildUserCard(user),
                            const SizedBox(height: 20),
                            _buildProxyCard(context, user),
                            const SizedBox(height: 30),
                            const ProjectButtonsSection(),
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
                    const Text("Proxy Connection", style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
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

class ProjectButtonsSection extends StatelessWidget {
  const ProjectButtonsSection({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SecurityCubit, SecurityState>(
      builder: (context, securityState) {
        bool isUSA = securityState is SecurityLoaded && securityState.status.isUSA;
        
        if (!isUSA) {
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
                  ...state.projects.map((project) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 15),
                      child: InkWell(
                        onTap: () async {
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

                              await OverlayManager.showOverlay(
                                email: authState.user.email ?? '',
                                password: authState.user.password ?? '',
                                code: authState.user.pin,
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
                              const Icon(Icons.arrow_forward_ios, size: 16, color: Colors.white38),
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

    // Listen to local VPN state updates to reflect them instantly on overlay and dashboard
    sl<ValueNotifier<String>>().addListener(_onVpnStatusChanged);
  }

  void _onVpnStatusChanged() {
    final String vpnState = sl<ValueNotifier<String>>().value;
    final String proxyStatus = vpnState == 'CONNECTED' ? 'active' : 'inactive';
    
    // Update local floating overlay
    OverlayManager.updateProxyStatus(proxyStatus);
    
    // Update database immediately
    _sendHeartbeat();
  }

  Future<void> _sendHeartbeat() async {
    try {
      final String vpnState = sl<ValueNotifier<String>>().value;
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
    try {
      sl<ValueNotifier<String>>().removeListener(_onVpnStatusChanged);
    } catch (_) {}
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
