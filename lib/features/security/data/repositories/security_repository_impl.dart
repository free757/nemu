import 'dart:async';
import 'package:dartz/dartz.dart';
import 'package:flutter_v2ray/flutter_v2ray.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/connection_status.dart';
import '../../domain/repositories/security_repository.dart';
import '../datasources/security_remote_datasource.dart';

class SecurityRepositoryImpl implements SecurityRepository {
  final SecurityRemoteDataSource remoteDataSource;
  final FlutterV2ray v2ray;
  final StreamController<String> _statusController = StreamController<String>.broadcast();

  SecurityRepositoryImpl({
    required this.remoteDataSource,
    required this.v2ray,
  }) {
    // Note: The onStatusChanged is already set in injection_container.dart
    // In a more robust setup, we would pipe that to this stream.
    // For now, let's keep it simple.
  }

  @override
  Future<Either<Failure, ConnectionStatus>> checkConnection() async {
    try {
      final status = await remoteDataSource.checkIP();
      return Right(status);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Stream<String> get vpnStatusStream => _statusController.stream;

  @override
  Future<void> connectVpn({
    required String ip,
    required int port,
    required String user,
    required String pass,
  }) async {
    if (await v2ray.requestPermission()) {
       // Construct SOCKS5 config for V2Ray
       // This is a simplified version. Some V2Ray plugins might require a specific format.
       final v2rayConfig = '''
{
  "log": { "loglevel": "warning" },
  "inbounds": [{
    "port": 10808,
    "protocol": "socks",
    "settings": { "auth": "noauth", "udp": true }
  }],
  "outbounds": [{
    "protocol": "socks",
    "settings": {
      "servers": [{
        "address": "$ip",
        "port": $port,
        "users": [{ "user": "$user", "pass": "$pass" }]
      }]
    }
  }]
}
''';
      await v2ray.startV2Ray(
        remark: 'Nemu Proxy',
        config: v2rayConfig,
      );
    }
  }

  @override
  Future<void> disconnectVpn() async {
    await v2ray.stopV2Ray();
  }
}
