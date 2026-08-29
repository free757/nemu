import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'package:nemu/core/utils/constants.dart';
import 'package:nemu/features/auth/domain/entities/user_entity.dart';
import '../widgets/quick_actions_grid.dart';

class ToolsTabSection extends StatelessWidget {
  final UserEntity user;
  final bool isWebcamConnected;
  final bool showOverlay;
  final ValueChanged<bool> onToggleOverlay;
  final VoidCallback onRefreshWebcam;

  const ToolsTabSection({
    super.key,
    required this.user,
    required this.isWebcamConnected,
    required this.showOverlay,
    required this.onToggleOverlay,
    required this.onRefreshWebcam,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "الأدوات والمشاركة 🛠️",
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            "إدارة مشاركة الهوت سبوت، الكاميرا الخارجية، الزر العائم، وبيانات الحساب.",
            style: TextStyle(
              fontSize: 12,
              color: isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary,
            ),
          ),
          const SizedBox(height: 16),
          QuickActionsGrid(
            user: user,
            isWebcamConnected: isWebcamConnected,
            showOverlay: showOverlay,
            onToggleOverlay: onToggleOverlay,
            onRefreshWebcam: onRefreshWebcam,
          ),
          const SizedBox(height: 32),
          Center(
            child: Text(
              "Nemu System v${AppConstants.appVersion}",
              style: TextStyle(
                color: isDark ? Colors.white24 : Colors.black26,
                fontSize: 11,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
