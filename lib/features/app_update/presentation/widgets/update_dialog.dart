import 'dart:io';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/utils/overlay_manager.dart';
import '../../domain/entities/app_update_info.dart';

class UpdateDialog extends StatefulWidget {
  final AppUpdateInfo updateInfo;
  final String currentVersion;

  const UpdateDialog({
    super.key,
    required this.updateInfo,
    required this.currentVersion,
  });

  @override
  State<UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<UpdateDialog> {
  bool _isDownloading = false;

  Future<void> _launchDownload() async {
    if (Platform.isAndroid) {
      final success = await OverlayManager.downloadAndInstallApk(widget.updateInfo.downloadUrl);
      if (!success) {
        // Fallback to launching in browser if direct background download failed
        final Uri url = Uri.parse(widget.updateInfo.downloadUrl);
        try {
          if (await canLaunchUrl(url)) {
            await launchUrl(url, mode: LaunchMode.externalApplication);
          }
        } catch (_) {}
      }
    } else {
      final Uri url = Uri.parse(widget.updateInfo.downloadUrl);
      try {
        if (await canLaunchUrl(url)) {
          await launchUrl(url, mode: LaunchMode.externalApplication);
        }
      } catch (_) {}
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF1E293B),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: Colors.blueAccent.withOpacity(0.3), width: 1.5),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(30),
          child: Stack(
            children: [
              // Decorative background glow
              Positioned(
                top: -50,
                right: -50,
                child: Container(
                  width: 150,
                  height: 150,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.blueAccent.withOpacity(0.08),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Icon
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: _isDownloading
                            ? Colors.greenAccent.withOpacity(0.1)
                            : Colors.blueAccent.withOpacity(0.1),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _isDownloading
                              ? Colors.greenAccent.withOpacity(0.3)
                              : Colors.blueAccent.withOpacity(0.3),
                        ),
                      ),
                      child: Icon(
                        _isDownloading ? Icons.cloud_download : Icons.system_update_alt,
                        color: _isDownloading ? Colors.greenAccent : Colors.blueAccent,
                        size: 40,
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Title
                    Text(
                      _isDownloading ? "جاري التحميل... 📥" : "تحديث جديد متاح! 🎉",
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'Inter',
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _isDownloading
                          ? "يتم الآن تحميل حزمة التثبيت الخاصة بالتطبيق."
                          : "نسخة جديدة من التطبيق متوفرة للتحميل الآن.",
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.6),
                        fontSize: 14,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 20),
                    // Versions Info Table
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.03),
                        borderRadius: BorderRadius.circular(15),
                        border: Border.all(color: Colors.white.withOpacity(0.05)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildVersionColumn("الإصدار الحالي", widget.currentVersion, Colors.white60),
                          Container(width: 1, height: 30, color: Colors.white12),
                          _buildVersionColumn("الإصدار الجديد", widget.updateInfo.latestVersion, Colors.greenAccent),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Changelog Section
                    if (!_isDownloading && widget.updateInfo.changelog.isNotEmpty) ...[
                      Align(
                        alignment: Alignment.centerRight,
                        child: Text(
                          "ما الجديد في هذا التحديث:",
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.9),
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        width: double.infinity,
                        constraints: const BoxConstraints(maxHeight: 120),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(15),
                        ),
                        child: SingleChildScrollView(
                          physics: const BouncingScrollPhysics(),
                          child: Text(
                            widget.updateInfo.changelog,
                            style: TextStyle(
                              color: Colors.white.withOpacity(0.8),
                              fontSize: 13,
                              height: 1.5,
                            ),
                            textDirection: TextDirection.rtl,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],
                    // Action / Downloading Area with Smooth Animation
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      child: _isDownloading
                          ? Column(
                              key: const ValueKey('loading_state'),
                              children: [
                                const SizedBox(height: 10),
                                const SizedBox(
                                  width: 45,
                                  height: 45,
                                  child: CircularProgressIndicator(
                                    valueColor: AlwaysStoppedAnimation<Color>(Colors.greenAccent),
                                    strokeWidth: 3.5,
                                  ),
                                ),
                                const SizedBox(height: 20),
                                const Text(
                                  "جاري بدء تنزيل التحديث...",
                                  style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  "يرجى سحب لوحة الإشعارات لمشاهدة تقدم التحميل.",
                                  style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 16),
                                if (!widget.updateInfo.forceUpdate)
                                  TextButton.icon(
                                    style: TextButton.styleFrom(
                                      foregroundColor: Colors.white60,
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                    ),
                                    onPressed: () => Navigator.pop(context),
                                    icon: const Icon(Icons.open_in_new, size: 14),
                                    label: const Text(
                                      "المتابعة في الخلفية",
                                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                              ],
                            )
                          : Row(
                              key: const ValueKey('buttons_state'),
                              children: [
                                if (!widget.updateInfo.forceUpdate)
                                  Expanded(
                                    child: OutlinedButton(
                                      style: OutlinedButton.styleFrom(
                                        side: BorderSide(color: Colors.white.withOpacity(0.2)),
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(15),
                                        ),
                                        padding: const EdgeInsets.symmetric(vertical: 14),
                                      ),
                                      onPressed: () => Navigator.pop(context),
                                      child: Text(
                                        "لاحقاً",
                                        style: TextStyle(color: Colors.white.withOpacity(0.8)),
                                      ),
                                    ),
                                  ),
                                if (!widget.updateInfo.forceUpdate) const SizedBox(width: 12),
                                Expanded(
                                  flex: 2,
                                  child: ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Colors.blueAccent,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(15),
                                      ),
                                      elevation: 2,
                                      padding: const EdgeInsets.symmetric(vertical: 14),
                                    ),
                                    onPressed: () async {
                                      setState(() {
                                        _isDownloading = true;
                                      });
                                      await _launchDownload();
                                      // If optional update, close after a delay to give them feedback
                                      if (!widget.updateInfo.forceUpdate) {
                                        Future.delayed(const Duration(milliseconds: 2500), () {
                                          if (mounted) {
                                            Navigator.pop(context);
                                          }
                                        });
                                      }
                                    },
                                    child: const Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.download, size: 18),
                                        SizedBox(width: 8),
                                        Text(
                                          "تحديث الآن",
                                          style: TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 15,
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
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVersionColumn(String title, String value, Color valueColor) {
    return Column(
      children: [
        Text(
          title,
          style: TextStyle(
            color: Colors.white.withOpacity(0.4),
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ],
    );
  }
}
