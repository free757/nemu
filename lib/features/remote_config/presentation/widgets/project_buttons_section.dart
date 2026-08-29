import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:external_app_launcher/external_app_launcher.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:nemu/injection_container.dart';
import 'package:nemu/core/utils/overlay_manager.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'package:nemu/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:nemu/features/auth/data/models/user_model.dart';
import 'package:nemu/features/security/presentation/cubit/security_cubit.dart';
import 'package:nemu/features/remote_config/presentation/cubit/remote_config_cubit.dart';
import 'package:nemu/features/webview/presentation/pages/webview_page.dart';

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

                                await OverlayManager.showOverlay(
                                  userId: authState.user.id,
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
                            color: _parseColor(project.color).withOpacity(0.2),
                            borderRadius: BorderRadius.circular(15),
                            border: Border.all(color: _parseColor(project.color).withOpacity(0.5)),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(color: _parseColor(project.color), borderRadius: BorderRadius.circular(10)),
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

  Color _parseColor(String colorStr) {
    try {
      final parsed = int.tryParse(colorStr);
      if (parsed != null) return Color(parsed);
      
      final cleaned = colorStr.replaceAll('#', '');
      if (cleaned.length == 6) {
        return Color(int.parse('0xFF$cleaned'));
      } else if (cleaned.length == 8) {
        return Color(int.parse('0x$cleaned'));
      }
    } catch (_) {}
    return AppTheme.primaryBlue; // Fallback safe blue accent
  }
}
