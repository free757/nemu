import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nemu/core/utils/overlay_manager.dart';

class WebcamHelpBottomSheet extends StatelessWidget {
  final VoidCallback onRefresh;

  const WebcamHelpBottomSheet({super.key, required this.onRefresh});

  static void show(BuildContext context, {required VoidCallback onRefresh}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.black,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (_) => WebcamHelpBottomSheet(onRefresh: onRefresh),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      decoration: BoxDecoration(
        color: Colors.black,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        border: Border.all(color: Colors.white.withOpacity(0.05), width: 1),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Center(
            child: Icon(Icons.usb_rounded, size: 40, color: Colors.amberAccent),
          ),
          const SizedBox(height: 10),
          const Center(
            child: Text(
              "مساعد تشغيل الكاميرا والـ OTG",
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              "حل مشكلة عدم تعرّف الهاتف على كاميرا الويب الخارجية",
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.03),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.white.withOpacity(0.08)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "💡 خطوات التفعيل السريعة:",
                  style: TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const SizedBox(height: 12),
                _buildStepRow("1", "اضغط على زر (فتح إعدادات الهاتف) بالأسفل."),
                const SizedBox(height: 10),
                _buildStepRow("2", "اكتب في شريط البحث العلوي بالإعدادات كلمة (OTG) أو (اتصال OTG)."),
                const SizedBox(height: 10),
                _buildStepRow("3", "قم بتفعيل الخيار (تغذية منفذ الـ USB / OTG)."),
                const SizedBox(height: 10),
                _buildStepRow("4", "ستجد أن ضوء الكاميرا قد اشتغل وحالة الاتصال أصبحت نشطة فوراً!"),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.redAccent.withOpacity(0.1),
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: Colors.redAccent.withOpacity(0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, color: Colors.redAccent, size: 18),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    "ملاحظة لهواتف (Oppo, Realme, Vivo, OnePlus): يقوم النظام بإيقاف منفذ الـ OTG تلقائياً بعد 10 دقائق إذا لم تكن الكاميرا قيد الاستخدام لتوفير البطارية.",
                    style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 10, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () {
                    OverlayManager.openSettings();
                    Navigator.pop(context);
                  },
                  icon: const Icon(Icons.settings, size: 18),
                  label: const Text("فتح إعدادات الهاتف", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.amberAccent,
                    foregroundColor: const Color(0xFF16161A),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: () {
                  onRefresh();
                  HapticFeedback.mediumImpact();
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text("تمت إعادة فحص حالة الكاميرا والـ OTG! 🔄"),
                      backgroundColor: Colors.blueAccent,
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white.withOpacity(0.08),
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                    side: BorderSide(color: Colors.white.withOpacity(0.1)),
                  ),
                ),
                child: const Icon(Icons.refresh, color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }

  Widget _buildStepRow(String number, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 20,
          height: 20,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: Colors.amberAccent,
            shape: BoxShape.circle,
          ),
          child: Text(
            number,
            style: const TextStyle(color: Color(0xFF16161A), fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 12, height: 1.3),
          ),
        ),
      ],
    );
  }
}
