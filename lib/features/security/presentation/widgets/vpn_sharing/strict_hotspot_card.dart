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
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isStrict ? Colors.amberAccent.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isStrict ? Colors.amberAccent.withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.08),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isStrict ? Icons.shield_outlined : Icons.lock_outline,
                color: isStrict ? Colors.amberAccent : Colors.white70,
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
                        color: isStrict ? Colors.amberAccent : Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isStrict
                          ? "النت المباشر محظور 100% — لا اتصال إلا عبر البروكسي 🛡️"
                          : "إنشاء شبكة هوت سبوت معزولة تمنع مرور أي نت مباشر",
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 11),
                    ),
                  ],
                ),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isStrict ? Colors.redAccent : Colors.amberAccent,
                  foregroundColor: AppTheme.darkInk,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
                color: Colors.amberAccent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amberAccent.withValues(alpha: 0.25)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.wifi_lock_outlined, color: Colors.amberAccent, size: 15),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      "الشبكة: ${ssidController.text}",
                      style: const TextStyle(color: Colors.amberAccent, fontSize: 11, fontWeight: FontWeight.bold),
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
                        color: Colors.amberAccent.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.copy_outlined, size: 11, color: Colors.white),
                          SizedBox(width: 4),
                          Text("نسخ الباسوورد", style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
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
