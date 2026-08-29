import 'package:flutter/material.dart';
import 'core/utils/overlay_manager.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;
import 'injection_container.dart' as di;
import 'package:flutter_bloc/flutter_bloc.dart';
import 'features/security/presentation/pages/check_connection_page.dart';
import 'features/auth/presentation/pages/pin_login_page.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/auth/presentation/widgets/user_session_guard.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'features/network_monitor/presentation/cubit/network_monitor_cubit.dart';
import 'features/app_update/presentation/cubit/app_update_cubit.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  OverlayManager.initialize();
  
  // Initialize Supabase
  await Supabase.initialize(
    url: 'https://wliqqvdypzpnmwoegvam.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaXFxdmR5cHpwbm13b2VndmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTg1MDAsImV4cCI6MjA5NDE5NDUwMH0.zAaOnvTsgkrt2_OKSxNYpdSMxHfTKMbUEtv7uePte_g',
  );

  // Initialize Dependency Injection
  await di.init();

  // Load overlay preference before launching App UI to avoid race condition state mismatch
  try {
    final prefs = await SharedPreferences.getInstance();
    showOverlayNotifier.value = prefs.getBool('show_floating_overlay') ?? false;
  } catch (_) {}

  runApp(const NemuApp());
}

class NemuApp extends StatelessWidget {
  const NemuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiBlocProvider(
      providers: [
        BlocProvider(
          create: (context) => di.sl<AuthCubit>()..checkAuth(),
        ),
        BlocProvider(
          create: (context) => di.sl<NetworkMonitorCubit>(),
        ),
        BlocProvider(
          create: (context) => di.sl<AppUpdateCubit>(),
        ),
      ],
      child: MaterialApp(
        title: 'Nemu',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          brightness: Brightness.dark,
          scaffoldBackgroundColor: Colors.black,
          canvasColor: Colors.black,
          dialogTheme: const DialogThemeData(backgroundColor: Colors.black),
          colorScheme: const ColorScheme.dark(
            surface: Colors.black,
            primary: Colors.blueAccent,
          ),
        ),
        home: BlocBuilder<AuthCubit, AuthState>(
          builder: (context, state) {
            if (state is AuthAuthenticated) {
              return const CheckConnectionPage();
            } else if (state is AuthUnauthenticated || state is AuthError) {
              return const PinLoginPage();
            }
            return const Scaffold(
              body: Center(child: CircularProgressIndicator()),
            );
          },
        ),
      ),
    );
  }
}
