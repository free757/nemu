import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nemu/core/utils/constants.dart';

class ProxyDetailsCard extends StatelessWidget {
  final String ipAddress;

  const ProxyDetailsCard({
    super.key,
    required this.ipAddress,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Column(
        children: [
          _buildDetailRow(context, "عنوان IP للبروكسي (Host)", ipAddress, Icons.computer_outlined),
          const Divider(color: Colors.white10, height: 16),
          _buildDetailRow(context, "المنفذ اليدوي (HTTP Port)", "${AppConstants.localHttpPort}", Icons.alt_route_outlined),
          const Divider(color: Colors.white10, height: 16),
          _buildDetailRow(context, "منفذ التطبيقات (SOCKS5 Port)", "${AppConstants.localSocksPort}", Icons.cable_outlined),
          const Divider(color: Colors.white10, height: 16),
          _buildDetailRow(context, "الـ Private DNS (لمنع التسريب)", AppConstants.privateDnsOneDot, Icons.dns_outlined),
        ],
      ),
    );
  }

  Widget _buildDetailRow(BuildContext context, String label, String value, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: Colors.white54, size: 18),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 11)),
            const SizedBox(height: 2),
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
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
                backgroundColor: Colors.green,
                duration: const Duration(seconds: 1),
              ),
            );
          },
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.copy_outlined, color: Colors.white70, size: 16),
          ),
        ),
      ],
    );
  }
}
