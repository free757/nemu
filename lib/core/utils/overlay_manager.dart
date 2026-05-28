import 'package:flutter/services.dart';

class OverlayManager {
  static const MethodChannel _channel = MethodChannel('com.nemu.nemu/overlay');

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
}
