import 'package:flutter/material.dart';
import 'package:nemu/core/theme/app_theme.dart';

class SharingHeaderWidget extends StatelessWidget {
  final int connectedDevices;

  const SharingHeaderWidget({
    super.key,
    required this.connectedDevices,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryTextColor = isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary;
    final secondaryTextColor = isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary;

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.settings_input_antenna_outlined, size: 26, color: AppTheme.accentGreen),
            const SizedBox(width: 8),
            Text(
              "مشاركة اتصال الـ VPN",
              style: TextStyle(color: primaryTextColor, fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: (connectedDevices > 0 ? AppTheme.accentGreen : (isDark ? Colors.white12 : Colors.black12)).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: connectedDevices > 0 ? AppTheme.accentGreen.withValues(alpha: 0.4) : (isDark ? Colors.white12 : Colors.black12),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.devices_outlined,
                    size: 13,
                    color: connectedDevices > 0 ? AppTheme.accentGreen : secondaryTextColor,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    "$connectedDevices جهاز متصل",
                    style: TextStyle(
                      color: connectedDevices > 0 ? AppTheme.accentGreen : secondaryTextColor,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          "شارك اتصال البروكسي المشفر مع الهواتف الأخرى بأمان تام وعزل للنت المباشر",
          textAlign: TextAlign.center,
          style: TextStyle(color: secondaryTextColor, fontSize: 12),
        ),
      ],
    );
  }
}
