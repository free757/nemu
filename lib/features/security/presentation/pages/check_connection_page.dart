import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:nemu/injection_container.dart';
import 'package:nemu/features/remote_config/presentation/cubit/remote_config_cubit.dart';
import 'package:nemu/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:nemu/features/security/presentation/cubit/security_cubit.dart';
import 'package:nemu/features/webview/presentation/pages/webview_page.dart';
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

class CheckConnectionView extends StatelessWidget {
  const CheckConnectionView({super.key});

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
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.white70),
            onPressed: () => context.read<AuthCubit>().logout(),
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
                            await LaunchApp.openApp(
                              androidPackageName: project.androidPackageName,
                              iosUrlScheme: project.iosUrlScheme,
                              appStoreLink: project.appStoreLink,
                              openStore: true,
                            );
                          } else {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => WebViewPage(config: project),
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

  @override
  void initState() {
    super.initState();
    _checkBlockStatus();
    _timer = Timer.periodic(const Duration(seconds: 4), (timer) {
      _checkBlockStatus();
    });
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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return widget.child;
  }
}
