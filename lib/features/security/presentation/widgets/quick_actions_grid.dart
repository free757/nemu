import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'credentials_bottom_sheet.dart';
import 'webcam_help_bottom_sheet.dart';
import 'app_share_bottom_sheet.dart';
import 'vpn_sharing_bottom_sheet.dart';

class QuickActionsGrid extends StatelessWidget {
  final dynamic user;
  final bool isWebcamConnected;
  final bool showOverlay;
  final ValueChanged<bool> onToggleOverlay;
  final VoidCallback onRefreshWebcam;

  const QuickActionsGrid({
    super.key,
    required this.user,
    required this.isWebcamConnected,
    required this.showOverlay,
    required this.onToggleOverlay,
    required this.onRefreshWebcam,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = isWebcamConnected ? Colors.greenAccent : Colors.orangeAccent;
    final statusIcon = isWebcamConnected ? Icons.videocam : Icons.videocam_off_outlined;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildGridItem(
                context: context,
                icon: Icons.layers,
                iconColor: Colors.blueAccent,
                title: "الزر العائم",
                onTap: () {
                  onToggleOverlay(!showOverlay);
                  HapticFeedback.lightImpact();
                },
                trailing: SizedBox(
                  height: 30,
                  child: FittedBox(
                    fit: BoxFit.contain,
                    child: Switch(
                      value: showOverlay,
                      onChanged: onToggleOverlay,
                      activeColor: Colors.blueAccent,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildGridItem(
                context: context,
                icon: Icons.security,
                iconColor: Colors.amberAccent,
                title: "بيانات الحساب",
                onTap: () => CredentialsBottomSheet.show(context, user),
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
                context: context,
                icon: statusIcon,
                iconColor: statusColor,
                title: "كاميرا الويب",
                onTap: () {
                  if (isWebcamConnected) {
                    HapticFeedback.lightImpact();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text("الكاميرا متصلة وتعمل بنجاح! جاهزة للعمل 🟢🎥"),
                        backgroundColor: Colors.green,
                      ),
                    );
                  } else {
                    WebcamHelpBottomSheet.show(context, onRefresh: onRefreshWebcam);
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
                    isWebcamConnected ? "متصلة" : "غير نشطة",
                    style: TextStyle(color: statusColor, fontSize: 9, fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildGridItem(
                context: context,
                icon: Icons.settings_input_antenna,
                iconColor: Colors.greenAccent,
                title: "مشاركة هوت سبوت",
                onTap: () {
                  HapticFeedback.lightImpact();
                  VpnSharingBottomSheet.show(context);
                },
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
    required BuildContext context,
    required IconData icon,
    required Color iconColor,
    required String title,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Card(
      margin: EdgeInsets.zero,
      color: isDark ? Colors.white.withOpacity(0.05) : Colors.white,
      elevation: isDark ? 0 : 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: isDark ? Colors.white.withOpacity(0.05) : const Color(0xFFE2E8F0),
        ),
      ),
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
                style: TextStyle(
                  color: isDark ? Colors.white : const Color(0xFF0F172A),
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
}
