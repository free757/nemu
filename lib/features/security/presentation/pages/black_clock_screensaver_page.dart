import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:nemu/features/network_monitor/presentation/cubit/network_monitor_cubit.dart';

import 'package:nemu/injection_container.dart';

class BlackClockScreenSaverPage extends StatefulWidget {
  const BlackClockScreenSaverPage({super.key});

  static void open(BuildContext context) {
    Navigator.of(context).push(
      PageRouteBuilder(
        opaque: true,
        pageBuilder: (context, _, __) => BlocProvider.value(
          value: sl<NetworkMonitorCubit>(),
          child: const BlackClockScreenSaverPage(),
        ),
        transitionsBuilder: (context, animation, _, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  State<BlackClockScreenSaverPage> createState() => _BlackClockScreenSaverPageState();
}

class _BlackClockScreenSaverPageState extends State<BlackClockScreenSaverPage> {
  Timer? _clockTimer;
  DateTime _cairoTime = DateTime.now();

  @override
  void initState() {
    super.initState();
    _updateCairoTime();
    _clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _updateCairoTime();
    });
  }

  void _updateCairoTime() {
    // Cairo is UTC+2 / UTC+3 (Egypt Standard Time)
    // Using UTC + 3 hours (DST active in Egypt in Summer) or UTC + 2
    final nowUtc = DateTime.now().toUtc();
    final cairo = nowUtc.add(const Duration(hours: 3));
    if (mounted) {
      setState(() {
        _cairoTime = cairo;
      });
    }
  }

  @override
  void dispose() {
    _clockTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final timeStr = DateFormat('hh:mm:ss').format(_cairoTime);
    final periodStr = DateFormat('a').format(_cairoTime) == 'AM' ? 'صَبَاحاً' : 'مَسَاءً';
    
    // Completely crash-proof Arabic date representation
    final weekdays = ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];
    final months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    final dayName = weekdays[(_cairoTime.weekday - 1).clamp(0, 6)];
    final monthName = months[(_cairoTime.month - 1).clamp(0, 11)];
    final dateStr = "$dayName، ${_cairoTime.day} $monthName ${_cairoTime.year}";

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.of(context).pop();
        },
        child: Container(
          width: double.infinity,
          height: double.infinity,
          color: Colors.black, // Pure AMOLED black for battery saving
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 30),
          child: SafeArea(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Top Status: Cairo Time Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Colors.greenAccent,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          "توقيت القاهرة (EET/EEST)",
                          style: TextStyle(
                            color: Colors.white38,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                    const Row(
                      children: [
                        Icon(Icons.touch_app_outlined, size: 14, color: Colors.white24),
                        SizedBox(width: 4),
                        Text(
                          "المس الشاشة للإلغاء",
                          style: TextStyle(color: Colors.white24, fontSize: 11),
                        ),
                      ],
                    ),
                  ],
                ),

                // Center: Big Egyptian Clock
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      timeStr,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 54,
                        fontWeight: FontWeight.w300,
                        letterSpacing: 4,
                        fontFamily: 'monospace',
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      periodStr,
                      style: const TextStyle(
                        color: Colors.amberAccent,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      dateStr,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.4),
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),

                // Bottom: Live Mini Traffic
                BlocBuilder<NetworkMonitorCubit, NetworkMonitorState>(
                  builder: (context, state) {
                    final speed = (state is NetworkMonitorActive) ? state.speed : null;
                    final upload = speed?.formattedUploadSpeed ?? "0 B/s";
                    final download = speed?.formattedDownloadSpeed ?? "0 B/s";
                    final devices = speed?.connectedDevicesCount ?? 0;

                    return Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.03),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withOpacity(0.06)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.arrow_upward, color: Colors.greenAccent, size: 14),
                              const SizedBox(width: 4),
                              Text(upload, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          Row(
                            children: [
                              const Icon(Icons.arrow_downward, color: Colors.blueAccent, size: 14),
                              const SizedBox(width: 4),
                              Text(download, style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.bold)),
                            ],
                          ),
                          if (devices > 0)
                            Row(
                              children: [
                                const Icon(Icons.devices, color: Colors.amberAccent, size: 14),
                                const SizedBox(width: 4),
                                Text("$devices أجهزة", style: const TextStyle(color: Colors.amberAccent, fontSize: 12, fontWeight: FontWeight.bold)),
                              ],
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
