import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:android_intent_plus/android_intent.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:nemu/features/auth/domain/entities/user_entity.dart';
import 'package:nemu/features/security/presentation/cubit/security_cubit.dart';
import 'vpn_sharing_bottom_sheet.dart';

class SecurityCardWidget extends StatelessWidget {
  final UserEntity user;

  const SecurityCardWidget({
    super.key,
    required this.user,
  });

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<SecurityCubit, SecurityState>(
      builder: (context, state) {
        final bool isLoaded = state is SecurityLoaded;
        final bool isUSA = isLoaded && (state as SecurityLoaded).status.isUSA;
        final bool isConnected = isLoaded && (state as SecurityLoaded).isConnected;
        final String ip = isLoaded ? (state as SecurityLoaded).status.ip : 'Checking...';

        return Card(
          color: Colors.white.withOpacity(0.08),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(25),
            side: BorderSide(
              color: isUSA ? Colors.greenAccent.withOpacity(0.3) : Colors.white10,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Text(
                          "Proxy Connection",
                          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                        ),
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
                            activeThumbColor: Colors.greenAccent,
                          ),
                  ],
                ),
                const Divider(color: Colors.white10, height: 30),
                _buildInfoRow(Icons.language, "Current IP", ip),
                _buildInfoRow(Icons.security, "Protocol", "SOCKS5"),
                _buildInfoRow(Icons.location_on, "Target", "United States"),
                if (isConnected && isUSA) ...[
                  const Padding(
                    padding: EdgeInsets.only(top: 10),
                    child: Text(
                      "Connected Successfully ✅",
                      style: TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                if (isConnected) ...[
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        VpnSharingBottomSheet.show(context);
                      },
                      icon: const Icon(Icons.settings_input_antenna, size: 16),
                      label: const Text(
                        "مشاركة الاتصال (هوت سبوت)",
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white.withOpacity(0.08),
                        foregroundColor: Colors.greenAccent,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(15),
                          side: BorderSide(color: Colors.greenAccent.withOpacity(0.2)),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
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
                                        style: const TextStyle(
                                          color: Colors.blueAccent,
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          fontFamily: 'monospace',
                                        ),
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
                    child: Text(
                      "Updating connection status...",
                      style: TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold),
                    ),
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
