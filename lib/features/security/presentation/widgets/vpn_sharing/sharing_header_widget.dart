import 'package:flutter/material.dart';

class SharingHeaderWidget extends StatelessWidget {
  final int connectedDevices;

  const SharingHeaderWidget({
    super.key,
    required this.connectedDevices,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.settings_input_antenna_outlined, size: 26, color: Colors.greenAccent),
            const SizedBox(width: 8),
            const Text(
              "مشاركة اتصال الـ VPN",
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(width: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: (connectedDevices > 0 ? Colors.greenAccent : Colors.white12).withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: connectedDevices > 0 ? Colors.greenAccent.withValues(alpha: 0.4) : Colors.white12,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.devices_outlined,
                    size: 13,
                    color: connectedDevices > 0 ? Colors.greenAccent : Colors.white54,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    "$connectedDevices جهاز متصل",
                    style: TextStyle(
                      color: connectedDevices > 0 ? Colors.greenAccent : Colors.white54,
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
          style: TextStyle(color: Colors.white.withValues(alpha: 0.5), fontSize: 12),
        ),
      ],
    );
  }
}
