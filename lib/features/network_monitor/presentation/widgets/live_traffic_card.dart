import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:nemu/core/theme/app_theme.dart';
import '../cubit/network_monitor_cubit.dart';

class LiveTrafficCard extends StatelessWidget {
  // Max scale benchmark: 10 MB/s (10 * 1024 * 1024 bytes/sec)
  static const double _maxBenchmarkBytes = 10 * 1024 * 1024;

  const LiveTrafficCard({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<NetworkMonitorCubit, NetworkMonitorState>(
      builder: (context, state) {
        final speed = (state is NetworkMonitorActive) ? state.speed : null;
        final uploadBytes = speed?.uploadSpeedBytesPerSec ?? 0;
        final downloadBytes = speed?.downloadSpeedBytesPerSec ?? 0;

        final uploadStr = speed?.formattedUploadSpeed ?? "0 B/s";
        final downloadStr = speed?.formattedDownloadSpeed ?? "0 B/s";
        final totalUploadStr = speed?.formattedTotalUpload ?? "0 B";

        final isUploading = uploadBytes > 1024; // > 1 KB/s

        // Calculate progress between 0.0 and 1.0 (logarithmic/scaled for smooth visual feedback)
        final double uploadProgress = uploadBytes <= 0
            ? 0.0
            : min(1.0, max(0.04, uploadBytes / _maxBenchmarkBytes));
        final double downloadProgress = downloadBytes <= 0
            ? 0.0
            : min(1.0, max(0.04, downloadBytes / _maxBenchmarkBytes));

        final isDark = Theme.of(context).brightness == Brightness.dark;

        return Container(
          margin: const EdgeInsets.symmetric(vertical: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withOpacity(0.05) : AppTheme.lightCard,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isDark ? Colors.white.withOpacity(0.08) : AppTheme.lightBorder,
              width: 1,
            ),
            boxShadow: isDark
                ? null
                : [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.03),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.05),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.speed,
                          color: Colors.white70,
                          size: 18,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        "مؤشر نقل البيانات اللحظي",
                        style: TextStyle(
                          color: isDark ? Colors.white : const Color(0xFF0F172A),
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ],
                  ),
                  if (speed != null && speed.connectedDevicesCount > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.greenAccent.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.greenAccent.withOpacity(0.3)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.devices_other, size: 13, color: Colors.greenAccent),
                          const SizedBox(width: 5),
                          Text(
                            "${speed.connectedDevicesCount} أجهزة متصلة",
                            style: const TextStyle(
                              color: Colors.greenAccent,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),

              // Upload Linear Indicator Bar
              _buildLinearSpeedRow(
                title: "الرفع (Upload)",
                icon: Icons.arrow_upward,
                speedText: uploadStr,
                progress: uploadProgress,
                activeColor: Colors.greenAccent,
                isActive: isUploading,
              ),

              const SizedBox(height: 12),

              // Download Linear Indicator Bar
              _buildLinearSpeedRow(
                title: "التنزيل (Download)",
                icon: Icons.arrow_downward,
                speedText: downloadStr,
                progress: downloadProgress,
                activeColor: Colors.blueAccent,
                isActive: downloadBytes > 1024,
              ),

              const SizedBox(height: 14),
              const Divider(color: Colors.white10, height: 1),
              const SizedBox(height: 10),

              // Footer: Session Stats & Reset
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.pie_chart_outline, size: 14, color: Colors.white.withOpacity(0.4)),
                      const SizedBox(width: 6),
                      Text(
                        "إجمالي الرفع للجلسة: $totalUploadStr",
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.6),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  InkWell(
                    onTap: () {
                      HapticFeedback.lightImpact();
                      context.read<NetworkMonitorCubit>().resetStats();
                    },
                    borderRadius: BorderRadius.circular(6),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      child: Text(
                        "تصفير العداد",
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.4),
                          fontSize: 11,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildLinearSpeedRow({
    required String title,
    required IconData icon,
    required String speedText,
    required double progress,
    required Color activeColor,
    required bool isActive,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Icon(icon, color: activeColor, size: 14),
                const SizedBox(width: 6),
                Text(
                  title,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.7),
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            Text(
              speedText,
              style: TextStyle(
                color: activeColor,
                fontWeight: FontWeight.bold,
                fontSize: 13,
                fontFamily: 'monospace',
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        // Smooth Animated Progress Track
        LayoutBuilder(
          builder: (context, constraints) {
            final double maxWidth = constraints.maxWidth;
            final double barWidth = maxWidth * progress;

            return Container(
              height: 6,
              width: maxWidth,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Stack(
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 500),
                    curve: Curves.easeOutCubic,
                    height: 6,
                    width: barWidth,
                    decoration: BoxDecoration(
                      color: activeColor,
                      borderRadius: BorderRadius.circular(4),
                      boxShadow: isActive
                          ? [
                              BoxShadow(
                                color: activeColor.withOpacity(0.5),
                                blurRadius: 6,
                                spreadRadius: 0.5,
                              )
                            ]
                          : null,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}
