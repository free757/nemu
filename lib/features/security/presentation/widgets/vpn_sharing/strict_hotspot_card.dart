import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nemu/core/theme/app_theme.dart';

class StrictHotspotCard extends StatelessWidget {
  final bool isStrict;
  final TextEditingController ssidController;
  final TextEditingController passController;
  final Future<void> Function() onToggle;

  const StrictHotspotCard({
    super.key,
    required this.isStrict,
    required this.ssidController,
    required this.passController,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primaryTextColor = isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary;
    final secondaryTextColor = isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isStrict
            ? AppTheme.warningOrange.withValues(alpha: isDark ? 0.08 : 0.12)
            : (isDark ? Colors.white.withValues(alpha: 0.03) : AppTheme.lightCard),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isStrict
              ? AppTheme.warningOrange.withValues(alpha: 0.4)
              : (isDark ? Colors.white.withValues(alpha: 0.08) : AppTheme.lightBorder),
          width: 1,
        ),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isStrict ? Icons.shield_outlined : Icons.lock_outline,
                color: isStrict ? AppTheme.warningOrange : secondaryTextColor,
                size: 24,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "وضع الحظر التام (Strict Proxy Only)",
                      style: TextStyle(
                        color: isStrict ? AppTheme.warningOrange : primaryTextColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isStrict
                          ? "النت المباشر محظور 100% — لا اتصال إلا عبر البروكسي 🛡️"
                          : "إنشاء شبكة هوت سبوت معزولة تمنع مرور أي نت مباشر",
                      style: TextStyle(color: secondaryTextColor, fontSize: 11),
                    ),
                  ],
                ),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isStrict ? AppTheme.dangerRed : AppTheme.warningOrange,
                  foregroundColor: isStrict ? Colors.white : AppTheme.darkInk,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                onPressed: () => onToggle(),
                icon: Icon(isStrict ? Icons.power_settings_new_outlined : Icons.security_outlined, size: 14),
                label: Text(
                  isStrict ? "إيقاف" : "تشغيل الآمن",
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                ),
              ),
            ],
          ),
          if (isStrict) ...[
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              decoration: BoxDecoration(
                color: AppTheme.warningOrange.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.warningOrange.withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.wifi_lock_outlined, color: AppTheme.warningOrange, size: 15),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      "الشبكة: ${ssidController.text}",
                      style: const TextStyle(color: AppTheme.warningOrange, fontSize: 11, fontWeight: FontWeight.bold),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: passController.text));
                      HapticFeedback.lightImpact();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text("تم نسخ كلمة مرور الشبكة الآمنة 📋"), duration: Duration(seconds: 1)),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppTheme.warningOrange.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.copy_outlined, size: 11, color: isDark ? Colors.white : AppTheme.lightTextPrimary),
                          const SizedBox(width: 4),
                          Text(
                            "نسخ الباسوورد",
                            style: TextStyle(
                              color: isDark ? Colors.white : AppTheme.lightTextPrimary,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
