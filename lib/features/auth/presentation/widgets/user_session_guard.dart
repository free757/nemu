import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:nemu/core/utils/overlay_manager.dart';
import 'package:nemu/injection_container.dart';
import 'package:nemu/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:nemu/features/auth/data/models/user_model.dart';
import 'package:nemu/features/remote_config/presentation/cubit/remote_config_cubit.dart';

final ValueNotifier<bool> showOverlayNotifier = ValueNotifier<bool>(false);

class UserSessionGuard extends StatefulWidget {
  final String userId;
  final Widget child;

  const UserSessionGuard({
    super.key,
    required this.userId,
    required this.child,
  });

  @override
  State<UserSessionGuard> createState() => _UserSessionGuardState();
}

class _UserSessionGuardState extends State<UserSessionGuard> {
  Timer? _timer;
  Timer? _heartbeatTimer;
  StreamSubscription<List<Map<String, dynamic>>>? _miscSubscription;
  StreamSubscription<List<Map<String, dynamic>>>? _remoteConfigSubscription;

  @override
  void initState() {
    super.initState();
    _checkBlockStatus();
    _timer = Timer.periodic(const Duration(seconds: 4), (_) {
      _checkBlockStatus();
    });

    _sendHeartbeat();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _sendHeartbeat();
    });

    vpnStatusNotifier.addListener(_onVpnStatusChanged);
    showOverlayNotifier.addListener(_onOverlayPreferenceChanged);

    try {
      _miscSubscription = Supabase.instance.client
          .from('misc_items')
          .stream(primaryKey: ['id'])
          .listen(
            (_) => _initOverlay(),
            onError: (error) {
              debugPrint('[MiscItems] Stream error caught safely: $error');
            },
            cancelOnError: false,
          );
    } catch (_) {}

    try {
      _remoteConfigSubscription = Supabase.instance.client
          .from('remote_configs')
          .stream(primaryKey: ['id'])
          .listen(
            (_) {
              _initOverlay();
              if (mounted) {
                context.read<RemoteConfigCubit>().getProjects();
              }
            },
            onError: (error) {
              debugPrint('[RemoteConfig] Stream error caught safely: $error');
            },
            cancelOnError: false,
          );
    } catch (_) {}

    _initOverlay();
  }

  Future<void> _initOverlay() async {
    if (!showOverlayNotifier.value) {
      OverlayManager.hideOverlay();
      return;
    }

    final hasPermission = await OverlayManager.checkPermission();
    if (!hasPermission) {
      await OverlayManager.requestPermission();
      await Future.delayed(const Duration(seconds: 2));
      final granted = await OverlayManager.checkPermission();
      if (!granted) return;
    }

    if (!mounted) return;

    final authState = context.read<AuthCubit>().state;
    if (authState is! AuthAuthenticated) return;

    String emailVal = authState.user.email ?? '';
    String passwordVal = authState.user.password ?? '';
    String codeVal = authState.user.verificationCode ?? authState.user.pin;

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
    } catch (_) {}

    String miscJson = '[]';
    try {
      final miscResponse = await Supabase.instance.client
          .from('misc_items')
          .select('title, content')
          .order('display_order', ascending: true);
      miscJson = jsonEncode(miscResponse);
    } catch (_) {}

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

    final proxyStatus = vpnStatusNotifier.value == 'CONNECTED' ? 'active' : 'inactive';

    await OverlayManager.showOverlay(
      userId: authState.user.id,
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

    if (showOverlayNotifier.value) {
      OverlayManager.updateProxyStatus(proxyStatus);
    }

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

  Future<void> _checkBlockStatus() async {
    try {
      final response = await Supabase.instance.client
          .from('app_users')
          .select('is_blocked, ui_settings')
          .eq('id', widget.userId)
          .maybeSingle();
      if (response != null && mounted) {
        if (response['is_blocked'] == true) {
          context.read<AuthCubit>().logout();
          return;
        }

        final uiSettings = response['ui_settings'] as Map<String, dynamic>?;
        if (uiSettings != null && uiSettings['force_logout'] == true) {
          final updatedSettings = Map<String, dynamic>.from(uiSettings);
          updatedSettings['force_logout'] = false;

          try {
            await Supabase.instance.client
                .from('app_users')
                .update({'ui_settings': updatedSettings})
                .eq('id', widget.userId);
          } catch (e) {
            debugPrint('[BlockChecker] Failed to reset force_logout in Supabase: $e');
          }

          if (mounted) {
            context.read<AuthCubit>().logout();
          }
        }
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _timer?.cancel();
    _heartbeatTimer?.cancel();
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
