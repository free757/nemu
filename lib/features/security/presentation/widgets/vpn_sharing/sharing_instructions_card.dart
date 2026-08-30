import 'package:flutter/material.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'package:nemu/core/utils/constants.dart';

class SharingInstructionsCard extends StatefulWidget {
  const SharingInstructionsCard({super.key});

  @override
  State<SharingInstructionsCard> createState() => _SharingInstructionsCardState();
}

class _SharingInstructionsCardState extends State<SharingInstructionsCard> {
  bool _isExpanded = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            onTap: () {
              setState(() {
                _isExpanded = !_isExpanded;
              });
            },
            child: Row(
              children: [
                const Icon(Icons.help_outline, color: Colors.greenAccent, size: 18),
                const SizedBox(width: 8),
                const Text(
                  "خطوات الإعداد على الهاتف الآخر (Minute Data)",
                  style: TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const Spacer(),
                Icon(
                  _isExpanded ? Icons.expand_less_outlined : Icons.expand_more_outlined,
                  color: Colors.white54,
                  size: 18,
                ),
              ],
            ),
          ),
          if (_isExpanded) ...[
            const SizedBox(height: 12),
            _buildStepRow("1", "اتصل بشبكة الهوت سبوت (أو امسح كود الـ QR بالكاميرا)."),
            const SizedBox(height: 6),
            _buildStepRow("2", "في الهاتف الآخر، ادخل إعدادات شبكة الواي فاي -> خيارات متقدمة -> البروكسي (Proxy) -> يدوي (Manual)."),
            const SizedBox(height: 6),
            _buildStepRow("3", "اكتب عنوان الـ Host والمنفذ ${AppConstants.localHttpPort} (أو ضعهما داخل Minute Data مباشرة)."),
            const SizedBox(height: 6),
            _buildStepRow("4", "🛡️ لمنع تسريب الـ DNS: في إعدادات الهاتف الثاني اذهب إلى Private DNS -> واكتب: ${AppConstants.privateDnsOneDot}."),
          ],
        ],
      ),
    );
  }

  Widget _buildStepRow(String number, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 16,
          height: 16,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Colors.greenAccent,
            shape: BoxShape.circle,
          ),
          child: Text(
            number,
            style: const TextStyle(color: AppTheme.darkInk, fontSize: 10, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 11, height: 1.3),
          ),
        ),
      ],
    );
  }
}
