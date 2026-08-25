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

  // Cloudflare Worker Vless proxy config
  static const String _vlessUUID = 'd342d11e-d424-4583-b36e-524ab1f0ade3';
  static const String _workerHost = 'nemu-proxy.free75711.workers.dev';

  @override
  Future<void> connectVpn({
    required String ip,
    required int port,
    required String user,
    required String pass,
  }) async {
    if (await v2ray.requestPermission()) {
      // Build WebSocket path with per-user SOCKS5 credentials
      // Cloudflare Worker connects to user's SOCKS5 proxy on their behalf
      // This bypasses ISP DPI blocking since phone only speaks TLS to Cloudflare
      final encodedUser = Uri.encodeComponent(user);
      final encodedPass = Uri.encodeComponent(pass);
      final wsPath = '/?ph=${Uri.encodeComponent(ip)}&pp=$port&pu=$encodedUser&pw=$encodedPass';

      final v2rayConfig = '''
{
  "log": { "loglevel": "warning" },
  "inbounds": [
    {
      "listen": "0.0.0.0",
      "port": 10808,
      "protocol": "socks",
      "settings": { "auth": "noauth", "udp": true },
      "sniffing": {
        "enabled": true,
        "destOverride": ["http", "tls"]
      }
    },
    {
      "listen": "0.0.0.0",
      "port": 10809,
      "protocol": "http",
      "settings": { "allowTransparent": false },
      "sniffing": {
        "enabled": true,
        "destOverride": ["http", "tls"]
      }
    }
  ],
  "outbounds": [{
    "tag": "proxy",
    "protocol": "vless",
    "settings": {
      "vnext": [{
        "address": "$_workerHost",
        "port": 443,
        "users": [{
          "id": "$_vlessUUID",
          "encryption": "none"
        }]
      }]
    },
    "streamSettings": {
      "network": "ws",
      "security": "tls",
      "tlsSettings": {
        "allowInsecure": false,
        "serverName": "$_workerHost"
      },
      "wsSettings": {
        "path": "$wsPath",
        "headers": {
          "Host": "$_workerHost"
        }
      }
    }
  },
  {
    "tag": "direct",
    "protocol": "freedom",
    "settings": {}
  }],
  "dns": {
    "servers": [
      "1.1.1.1",
      "8.8.8.8"
    ]
  },
  "routing": {
    "domainStrategy": "IPIfNonMatch",
    "rules": [
      {
        "type": "field",
        "port": "53",
        "outboundTag": "proxy"
      }
    ]
  }
}
''';
      await v2ray.startV2Ray(
        remark: 'Nemu Proxy',
        config: v2rayConfig,
        proxyOnly: false,
      );
    }
  }

  @override
  Future<void> disconnectVpn() async {
    await v2ray.stopV2Ray();
  }
}
