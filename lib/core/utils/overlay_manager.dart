import 'package:flutter/services.dart';

class OverlayManager {
  static const MethodChannel _channel = MethodChannel('com.nemu.nemu/overlay');

  static final List<Function(double progress, int bytesDownloaded, int bytesTotal, String status)> _progressListeners = [];

  static void addProgressListener(Function(double progress, int bytesDownloaded, int bytesTotal, String status) listener) {
    _progressListeners.add(listener);
  }

  static void removeProgressListener(Function(double progress, int bytesDownloaded, int bytesTotal, String status) listener) {
    _progressListeners.remove(listener);
  }

  static void initialize() {
    _channel.setMethodCallHandler((call) async {
      if (call.method == 'onDownloadProgress') {
        final map = call.arguments as Map;
        final int progressInt = map['progress'] ?? 0;
        final int bytesDownloaded = map['bytesDownloaded'] ?? 0;
        final int bytesTotal = map['bytesTotal'] ?? 0;
        final int statusInt = map['status'] ?? 0;
        
        String status = 'downloading';
        if (statusInt == 8) { // DownloadManager.STATUS_SUCCESSFUL
          status = 'successful';
        } else if (statusInt == 16) { // DownloadManager.STATUS_FAILED
          status = 'failed';
        } else if (statusInt == 1) { // DownloadManager.STATUS_PENDING
          status = 'pending';
        } else if (statusInt == 2) { // DownloadManager.STATUS_RUNNING
          status = 'running';
        } else if (statusInt == 4) { // DownloadManager.STATUS_PAUSED
          status = 'paused';
        }

        final double progress = progressInt / 100.0;
        
        for (final listener in List.from(_progressListeners)) {
          try {
            listener(progress, bytesDownloaded, bytesTotal, status);
          } catch (_) {}
        }
      }
    });
  }

  static Future<bool> checkPermission() async {
    try {
      final bool granted = await _channel.invokeMethod('checkOverlayPermission');
      return granted;
    } catch (e) {
      return false;
    }
  }

  static Future<void> requestPermission() async {
    try {
      await _channel.invokeMethod('requestOverlayPermission');
    } catch (e) {
      // Ignore
    }
  }

  static Future<bool> showOverlay({
    required String userId,
    required String email,
    required String password,
    required String code,
    required String proxyStatus,
    String miscItemsJson = '[]',
    bool showOpenAppBtn = true,
    bool showMiscBtn = true,
  }) async {
    try {
      final bool success = await _channel.invokeMethod('showOverlay', {
        'userId': userId,
        'email': email,
        'password': password,
        'code': code,
        'proxy_status': proxyStatus,
        'misc_items': miscItemsJson,
        'show_open_app': showOpenAppBtn,
        'show_misc': showMiscBtn,
      });
      return success;
    } catch (e) {
      return false;
    }
  }

  static Future<void> updateProxyStatus(String status) async {
    try {
      await _channel.invokeMethod('updateProxyStatus', {
        'proxy_status': status,
      });
    } catch (e) {
      // Ignore
    }
  }

  static Future<void> hideOverlay() async {
    try {
      await _channel.invokeMethod('hideOverlay');
    } catch (e) {
      // Ignore
    }
  }

  static Future<bool> downloadAndInstallApk(String url) async {
    try {
      final bool? success = await _channel.invokeMethod('downloadAndInstallApk', {
        'url': url,
      });
      return success ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> isExternalCameraConnected() async {
    try {
      final bool? connected = await _channel.invokeMethod('isExternalCameraConnected');
      return connected ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<void> openSettings() async {
    try {
      await _channel.invokeMethod('openSettings');
    } catch (e) {
      // Ignore
    }
  }

  static Future<void> acquireWakeLock() async {
    try {
      await _channel.invokeMethod('acquireWakeLock');
    } catch (_) {}
  }

  static Future<void> releaseWakeLock() async {
    try {
      await _channel.invokeMethod('releaseWakeLock');
    } catch (_) {}
  }

  static Future<Map<String, dynamic>?> startStrictHotspot() async {
    try {
      final res = await _channel.invokeMethod('startStrictHotspot');
      if (res is Map) {
        return Map<String, dynamic>.from(res);
      }
    } catch (_) {}
    return null;
  }

  static Future<bool> stopStrictHotspot() async {
    try {
      final bool? res = await _channel.invokeMethod('stopStrictHotspot');
      return res ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> isStrictHotspotRunning() async {
    try {
      final bool? res = await _channel.invokeMethod('isStrictHotspotRunning');
      return res ?? false;
    } catch (_) {
      return false;
    }
  }
}
