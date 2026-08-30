import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:dartz/dartz.dart';
import 'package:flutter_v2ray/flutter_v2ray.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/utils/constants.dart';
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
  });

  @override
  Future<Either<Failure, ConnectionStatus>> checkConnection({bool forceRefresh = false}) async {
    try {
      final status = await remoteDataSource.checkIP(forceRefresh: forceRefresh);
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
    // Request permission from Android system
    // On first run, the dialog will show and requestPermission() returns false.
    // We retry once to catch the case where the user just granted permission.
    bool permissionGranted = await v2ray.requestPermission();
    if (!permissionGranted) {
      debugPrint('[SecurityRepository] Permission not yet granted, retrying after 2s...');
      await Future.delayed(const Duration(seconds: 2));
      permissionGranted = await v2ray.requestPermission();
      if (!permissionGranted) {
        debugPrint('[SecurityRepository] VPN permission denied by user.');
        return;
      }
    }
    debugPrint('[SecurityRepository] VPN permission granted!');

    // Build WebSocket path with per-user SOCKS5 credentials
    // Cloudflare Worker connects to user's SOCKS5 proxy on their behalf
    // This bypasses ISP DPI blocking since phone only speaks TLS to Cloudflare
    final encodedUser = Uri.encodeComponent(user);
    final encodedPass = Uri.encodeComponent(pass);
    final wsPath = '/?ph=${Uri.encodeComponent(ip)}&pp=$port&pu=$encodedUser&pw=$encodedPass';
  final cleanIpsJson = [AppConstants.workerIP, ...AppConstants.cleanWorkerIPs]
      .toSet()
      .map((ip) => '"$ip"')
      .join(',\n          ');

  final v2rayConfig = '''
{
  "log": { "loglevel": "debug" },
  "inbounds": [
    {
      "tag": "socks-in",
      "listen": "0.0.0.0",
      "port": ${AppConstants.localSocksPort},
      "protocol": "socks",
      "settings": {
        "auth": "noauth",
        "udp": true,
        "userLevel": 0
      },
      "streamSettings": {
        "sockopt": {
          "tcpNoDelay": true,
          "tcpKeepAliveInterval": 10
        }
      }
    },
    {
      "tag": "http-in",
      "listen": "0.0.0.0",
      "port": ${AppConstants.localHttpPort},
      "protocol": "http",
      "settings": {
        "allowTransparent": false,
        "timeout": 0,
        "userLevel": 0
      },
      "streamSettings": {
        "sockopt": {
          "tcpNoDelay": true,
          "tcpKeepAliveInterval": 10
        }
      }
    }
  ],
  "outbounds": [
    {
      "tag": "proxy",
      "protocol": "vless",
      "settings": {
        "vnext": [{
          "address": "${AppConstants.workerIP}",
          "port": 443,
          "users": [{
            "id": "${AppConstants.vlessUUID}",
            "encryption": "none",
            "level": 0
          }]
        }]
      },
      "streamSettings": {
        "network": "ws",
        "security": "tls",
        "tlsSettings": {
          "allowInsecure": false,
          "serverName": "${AppConstants.workerHost}"
        },
        "wsSettings": {
          "path": "$wsPath",
          "headers": {
            "Host": "${AppConstants.workerHost}"
          }
        },
        "sockopt": {
          "tcpNoDelay": true,
          "tcpKeepAliveInterval": 10
        }
      }
    },
    {
      "tag": "direct",
      "protocol": "freedom",
      "settings": {
        "domainStrategy": "UseIP",
        "userLevel": 0
      },
      "streamSettings": {
        "sockopt": {
          "tcpNoDelay": true,
          "tcpKeepAliveInterval": 10
        }
      }
    }
  ],
  "dns": {
    "hosts": {
      "${AppConstants.workerHost}": "${AppConstants.workerIP}"
    },
    "servers": [
      "${AppConstants.primaryDns}",
      "${AppConstants.secondaryDns}"
    ]
  },
  "routing": {
    "domainStrategy": "AsIs",
    "rules": [
      {
        "type": "field",
        "ip": [
          $cleanIpsJson
        ],
        "outboundTag": "direct"
      },
      {
        "type": "field",
        "inboundTag": ["socks-in", "http-in"],
        "outboundTag": "proxy"
      },
      {
        "type": "field",
        "network": "udp",
        "outboundTag": "direct"
      },
      {
        "type": "field",
        "network": "tcp",
        "outboundTag": "proxy"
      }
    ]
  }
}
''';
      await v2ray.startV2Ray(
        remark: AppConstants.proxyOnlyRemark,
        config: v2rayConfig,
        proxyOnly: false,
      );
  }

  @override
  Future<void> disconnectVpn() async {
    await v2ray.stopV2Ray();
  }
}
