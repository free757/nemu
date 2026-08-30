import 'package:flutter/material.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'package:nemu/core/services/root_sharing_service.dart';

class RootSharingCard extends StatelessWidget {
  final VoidCallback onToggled;

  const RootSharingCard({
    super.key,
    required this.onToggled,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryTextColor = isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary;
    final secondaryTextColor = isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.accentGreen.withValues(alpha: isDark ? 0.05 : 0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppTheme.accentGreen.withValues(alpha: 0.2), width: 1),
      ),
      child: Row(
        children: [
          const Icon(Icons.admin_panel_settings_outlined, color: AppTheme.accentGreen, size: 26),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "مشاركة الروت التلقائية (Root Auto Share)",
                  style: TextStyle(color: primaryTextColor, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 2),
                Text(
                  "مشاركة اتصال البروكسي تلقائياً دون أي إعداد يدوي على الهواتف المتصلة.",
                  style: TextStyle(color: secondaryTextColor, fontSize: 11),
                ),
              ],
            ),
          ),
          Switch(
            value: RootSharingService().isSharing,
            onChanged: (val) async {
              if (val) {
                final success = await RootSharingService().enableRootSharing();
                onToggled();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                        success
                            ? "تم تفعيل مشاركة الاتصال التلقائية بنجاح! 👑"
                            : "فشل تفعيل مشاركة الاتصال. يرجى التحقق من صلاحيات الروت.",
                      ),
                    ),
                  );
                }
              } else {
                await RootSharingService().disableRootSharing();
                onToggled();
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text("تم إيقاف مشاركة الاتصال التلقائية.")),
                  );
                }
              }
            },
            activeThumbColor: AppTheme.accentGreen,
          ),
        ],
      ),
    );
  }
}
