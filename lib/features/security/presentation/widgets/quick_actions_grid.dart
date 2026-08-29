import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'credentials_bottom_sheet.dart';
import 'webcam_help_bottom_sheet.dart';
import 'app_share_bottom_sheet.dart';

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
                icon: Icons.qr_code_2,
                iconColor: Colors.greenAccent,
                title: "تثبيت ومشاركة",
                onTap: () => AppShareBottomSheet.show(context),
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
    required IconData icon,
    required Color iconColor,
    required String title,
    required VoidCallback onTap,
    Widget? trailing,
  }) {
    return Card(
      margin: EdgeInsets.zero,
      color: Colors.white.withOpacity(0.05),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
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
                style: const TextStyle(
                  color: Colors.white,
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
