import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:external_app_launcher/external_app_launcher.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:android_intent_plus/android_intent.dart';
import 'package:nemu/core/utils/overlay_manager.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'package:nemu/core/utils/constants.dart';
import 'package:nemu/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:nemu/features/auth/data/models/user_model.dart';
import 'package:nemu/features/security/presentation/cubit/security_cubit.dart';
import 'package:nemu/features/remote_config/presentation/cubit/remote_config_cubit.dart';
import 'package:nemu/features/remote_config/domain/entities/project_config.dart';
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return BlocBuilder<SecurityCubit, SecurityState>(
      builder: (context, securityState) {
        if (securityState is SecurityLoaded) {
          final status = securityState.status;

          // 1. Timezone Mismatch Lock Card
          if (status.timezoneMismatch) {
            return _buildLockedStateCard(
              context: context,
              icon: Icons.access_time_filled_rounded,
              iconColor: Colors.amberAccent,
              title: "المنطقة الزمنية غير متطابقة ⏰",
              description: "يجب ضبط منطقة الهاتف الزمنية لتتطابق مع موقع البروكسي الأمريكي لفتح المشاريع بأمان.",
              actionLabel: "فتح إعدادات التاريخ والوقت",
              onAction: () async {
                HapticFeedback.selectionClick();
                try {
                  const intent = AndroidIntent(action: 'android.settings.DATE_SETTINGS');
                  await intent.launch();
                } catch (_) {}
              },
            );
          }

          // 2. Proxy Disconnected / Non-USA Lock Card
          if (!status.isUSA || !securityState.isConnected) {
            return _buildLockedStateCard(
              context: context,
              icon: Icons.shield_outlined,
              iconColor: Colors.cyanAccent,
              title: "البروكسي غير متصل 🛡️",
              description: "قم بتشغيل اتصال البروكسي الآمن لفك قفل المشاريع وبدء المهام بأمان.",
              actionLabel: "تشغيل البروكسي الآن ⚡",
              onAction: () async {
                HapticFeedback.mediumImpact();
                final authState = context.read<AuthCubit>().state;
                if (authState is AuthAuthenticated) {
                  await context.read<SecurityCubit>().toggleVpn(
                    connect: true,
                    ip: authState.user.proxyIp,
                    port: authState.user.proxyPort,
                    user: authState.user.proxyUser,
                    pass: authState.user.proxyPass,
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("يرجى تسجيل الدخول أولاً لتشغيل البروكسي")),
                  );
                }
              },
            );
          }
        } else {
          return _buildLockedStateCard(
            context: context,
            icon: Icons.lock_clock_outlined,
            iconColor: Colors.white54,
            title: "جاري التحقق من أمان الاتصال...",
            description: "يتم فحص سرعة وأمان البروكسي لفتح المشاريع المتاحة.",
          );
        }

        // Active Projects List
        return BlocBuilder<RemoteConfigCubit, RemoteConfigState>(
          builder: (context, state) {
            if (state is RemoteConfigLoading) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    children: [
                      const CircularProgressIndicator(strokeWidth: 2.5),
                      const SizedBox(height: 12),
                      Text("جاري تحميل المشاريع...", style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12)),
                    ],
                  ),
                ),
              );
            } else if (state is RemoteConfigLoaded) {
              final visibleProjects = state.projects.where((p) {
                final authState = context.read<AuthCubit>().state;
                final uiSettings = authState is AuthAuthenticated ? authState.user.uiSettings : null;
                if (uiSettings != null && uiSettings['projects'] != null && uiSettings['projects'][p.id] != null) {
                  return uiSettings['projects'][p.id] == true;
                }
                return p.isVisible;
              }).toList();

              if (visibleProjects.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: isDark ? AppTheme.darkCard : AppTheme.lightCard,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
                  ),
                  child: Center(
                    child: Text(
                      "لا توجد مشاريع متاحة حالياً لحسابك 📋",
                      style: TextStyle(color: isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary),
                    ),
                  ),
                );
              }

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.rocket_launch_outlined, size: 16, color: Colors.greenAccent),
                      const SizedBox(width: 6),
                      Text(
                        "المشاريع المتاحة (${visibleProjects.length})",
                        style: TextStyle(
                          color: isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      const Spacer(),
                      IconButton(
                        icon: const Icon(Icons.refresh_rounded, size: 18, color: Colors.white54),
                        onPressed: () {
                          HapticFeedback.lightImpact();
                          context.read<RemoteConfigCubit>().fetchProjects();
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ...visibleProjects.map((project) => _buildProjectCard(context, project)),
                ],
              );
            }
            return const SizedBox.shrink();
          },
        );
      },
    );
  }

  Widget _buildLockedStateCard({
    required BuildContext context,
    required IconData icon,
    required Color iconColor,
    required String title,
    required String description,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: iconColor.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: iconColor.withValues(alpha: 0.2), width: 1),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: iconColor, size: 30),
          ),
          const SizedBox(height: 12),
          Text(
            title,
            style: TextStyle(color: iconColor, fontWeight: FontWeight.bold, fontSize: 15),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            description,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12, height: 1.4),
            textAlign: TextAlign.center,
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onAction,
              style: ElevatedButton.styleFrom(
                backgroundColor: iconColor,
                foregroundColor: AppTheme.darkInk,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 11),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              icon: const Icon(Icons.bolt_rounded, size: 18),
              label: Text(
                actionLabel,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildProjectCard(BuildContext context, ProjectConfig project) {
    final bool isLoading = _loadingProjectId == project.id;
    final projectColor = _parseColor(project.color);
    final bool isApp = project.androidPackageName != null && project.androidPackageName!.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: (_loadingProjectId != null) ? null : () => _handleProjectLaunch(context, project),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: projectColor.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: projectColor.withValues(alpha: 0.3), width: 1),
            ),
            child: Row(
              children: [
                // Project Icon Container
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [projectColor, projectColor.withValues(alpha: 0.7)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: projectColor.withValues(alpha: 0.3),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Icon(
                    isApp ? Icons.phone_android_rounded : Icons.public_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 14),

                // Project Title & Type Badge
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        project.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: projectColor.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              isApp ? "تطبيق مثبت 📱" : "موقع ويب 🌐",
                              style: TextStyle(
                                color: projectColor,
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Launch Button / Loading Indicator
                isLoading
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation<Color>(projectColor),
                        ),
                      )
                    : Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.05),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.arrow_forward_ios_rounded, size: 13, color: Colors.white70),
                      ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handleProjectLaunch(BuildContext context, ProjectConfig project) async {
    HapticFeedback.lightImpact();
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
                .from(AppConstants.appUsersTable)
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
    return AppTheme.primaryBlue;
  }
}

