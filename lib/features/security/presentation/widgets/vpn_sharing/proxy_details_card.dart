import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'package:nemu/core/utils/constants.dart';

class ProxyDetailsCard extends StatelessWidget {
  final String ipAddress;

  const ProxyDetailsCard({
    super.key,
    required this.ipAddress,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dividerColor = isDark ? Colors.white10 : AppTheme.lightBorder;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? Colors.white.withValues(alpha: 0.03) : AppTheme.lightCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.08) : AppTheme.lightBorder),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                )
              ],
      ),
      child: Column(
        children: [
          _buildDetailRow(context, "عنوان IP للبروكسي (Host)", ipAddress, Icons.computer_outlined, isDark),
          Divider(color: dividerColor, height: 16),
          _buildDetailRow(context, "المنفذ اليدوي (HTTP Port)", "${AppConstants.localHttpPort}", Icons.alt_route_outlined, isDark),
          Divider(color: dividerColor, height: 16),
          _buildDetailRow(context, "منفذ التطبيقات (SOCKS5 Port)", "${AppConstants.localSocksPort}", Icons.cable_outlined, isDark),
          Divider(color: dividerColor, height: 16),
          _buildDetailRow(context, "الـ Private DNS (لمنع التسريب)", AppConstants.privateDnsOneDot, Icons.dns_outlined, isDark),
        ],
      ),
    );
  }

  Widget _buildDetailRow(BuildContext context, String label, String value, IconData icon, bool isDark) {
    final primaryTextColor = isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary;
    final secondaryTextColor = isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary;

    return Row(
      children: [
        Icon(icon, color: secondaryTextColor, size: 18),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: secondaryTextColor, fontSize: 11)),
            const SizedBox(height: 2),
            Text(
              value,
              style: TextStyle(
                color: primaryTextColor,
                fontWeight: FontWeight.bold,
                fontSize: 14,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
        const Spacer(),
        GestureDetector(
          onTap: () {
            Clipboard.setData(ClipboardData(text: value));
            HapticFeedback.lightImpact();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text("تم نسخ $label بنجاح! 📋"),
                backgroundColor: AppTheme.accentGreen,
                duration: const Duration(seconds: 1),
              ),
            );
          },
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: isDark ? Colors.white.withValues(alpha: 0.06) : Colors.black.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(Icons.copy_outlined, color: secondaryTextColor, size: 16),
          ),
        ),
      ],
    );
  }
}
