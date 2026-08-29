import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'package:nemu/features/remote_config/presentation/widgets/project_buttons_section.dart';

class ProjectsTabSection extends StatelessWidget {
  const ProjectsTabSection({super.key});

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
            "المشاريع المتاحة 🚀",
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            "قم بتشغيل اتصال البروكسي وضبط المنطقة الزمنية لفتح المشاريع.",
            style: TextStyle(
              fontSize: 12,
              color: isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary,
            ),
          ),
          const SizedBox(height: 16),
          const ProjectButtonsSection(),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
