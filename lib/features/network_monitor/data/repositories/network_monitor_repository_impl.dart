import 'dart:async';
import '../../domain/entities/network_speed_entity.dart';
import '../../domain/repositories/network_monitor_repository.dart';
import '../datasources/network_monitor_datasource.dart';

class NetworkMonitorRepositoryImpl implements NetworkMonitorRepository {
  final NetworkMonitorDataSource dataSource;

  StreamController<NetworkSpeedEntity>? _controller;
  Timer? _timer;

  int _prevRx = 0;
  int _prevTx = 0;
  int _totalSessionRx = 0;
  int _totalSessionTx = 0;
  bool _isFirstReading = true;

  int _tickCount = 0;
  int _cachedDevicesCount = 0;

  double _smoothedUploadSpeed = 0.0;
  double _smoothedDownloadSpeed = 0.0;

  NetworkMonitorRepositoryImpl({required this.dataSource});

  @override
  Stream<NetworkSpeedEntity> getSpeedStream() {
    _controller ??= StreamController<NetworkSpeedEntity>.broadcast(
      onListen: _startMonitoring,
      onCancel: _stopMonitoring,
    );
    return _controller!.stream;
  }

  void _startMonitoring() {
    _isFirstReading = true;
    _smoothedUploadSpeed = 0.0;
    _smoothedDownloadSpeed = 0.0;
    _timer?.cancel();

    // Sample every 500ms for responsiveness and apply Exponential Moving Average (EMA)
    _timer = Timer.periodic(const Duration(milliseconds: 500), (_) async {
      final traffic = await dataSource.getRawTrafficBytes();
      final currentRx = traffic['rx'] ?? 0;
      final currentTx = traffic['tx'] ?? 0;

      if (_isFirstReading) {
        _prevRx = currentRx;
        _prevTx = currentTx;
        _isFirstReading = false;
        _controller?.add(const NetworkSpeedEntity(
          uploadSpeedBytesPerSec: 0,
          downloadSpeedBytesPerSec: 0,
          totalSessionUploadBytes: 0,
          totalSessionDownloadBytes: 0,
        ));
        return;
      }

      final diffRx = (currentRx >= _prevRx) ? (currentRx - _prevRx) : 0;
      final diffTx = (currentTx >= _prevTx) ? (currentTx - _prevTx) : 0;

      _prevRx = currentRx;
      _prevTx = currentTx;

      _totalSessionRx += diffRx;
      _totalSessionTx += diffTx;

      // Convert 500ms diff to rate per second (* 2)
      final instantTxSpeed = (diffTx * 2).toDouble();
      final instantRxSpeed = (diffRx * 2).toDouble();

      // Exponential Moving Average (EMA): smooths out micro-burst gaps and prevents jumping to zero
      const alpha = 0.45; // Weight given to current reading
      _smoothedUploadSpeed = (_smoothedUploadSpeed * (1 - alpha)) + (instantTxSpeed * alpha);
      _smoothedDownloadSpeed = (_smoothedDownloadSpeed * (1 - alpha)) + (instantRxSpeed * alpha);

      // Snap to absolute zero if negligible
      if (_smoothedUploadSpeed < 100) _smoothedUploadSpeed = 0.0;
      if (_smoothedDownloadSpeed < 100) _smoothedDownloadSpeed = 0.0;

      // Throttle devices count checking to every 4 seconds (8 ticks of 500ms) to avoid spamming system
      if (_tickCount % 8 == 0) {
        _cachedDevicesCount = await dataSource.getConnectedDevicesCount();
      }
      _tickCount++;

      final entity = NetworkSpeedEntity(
        uploadSpeedBytesPerSec: _smoothedUploadSpeed,
        downloadSpeedBytesPerSec: _smoothedDownloadSpeed,
        totalSessionUploadBytes: _totalSessionTx,
        totalSessionDownloadBytes: _totalSessionRx,
        connectedDevicesCount: _cachedDevicesCount,
      );

      _controller?.add(entity);
    });
  }

  void _stopMonitoring() {
    _timer?.cancel();
    _timer = null;
  }

  @override
  void resetSessionStats() {
    _totalSessionRx = 0;
    _totalSessionTx = 0;
    _smoothedUploadSpeed = 0.0;
    _smoothedDownloadSpeed = 0.0;
  }
}
