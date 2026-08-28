import 'package:flutter/services.dart';

abstract class NetworkMonitorDataSource {
  Future<Map<String, int>> getRawTrafficBytes();
}

class NetworkMonitorDataSourceImpl implements NetworkMonitorDataSource {
  static const MethodChannel _channel = MethodChannel('com.nemu.nemu/overlay');

  @override
  Future<Map<String, int>> getRawTrafficBytes() async {
    try {
      final result = await _channel.invokeMethod<Map<dynamic, dynamic>>('getNetworkTraffic');
      if (result != null) {
        final rx = (result['rxBytes'] as num?)?.toInt() ?? 0;
        final tx = (result['txBytes'] as num?)?.toInt() ?? 0;
        return {'rx': rx, 'tx': tx};
      }
    } catch (_) {}
    return {'rx': 0, 'tx': 0};
  }
}
