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
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) async {
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

      final entity = NetworkSpeedEntity(
        uploadSpeedBytesPerSec: diffTx.toDouble(),
        downloadSpeedBytesPerSec: diffRx.toDouble(),
        totalSessionUploadBytes: _totalSessionTx,
        totalSessionDownloadBytes: _totalSessionRx,
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
  }
}
