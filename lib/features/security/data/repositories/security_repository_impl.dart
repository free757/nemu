import 'dart:async';
import 'dart:convert';
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
    // 1. Request VPN permission from Android OS
    bool permissionGranted = await v2ray.requestPermission();
    if (!permissionGranted) {
      debugPrint('[SecurityRepository] Permission not yet granted, retrying after delay...');
      await Future.delayed(AppConstants.vpnHandshakeDelay);
      permissionGranted = await v2ray.requestPermission();
      if (!permissionGranted) {
        debugPrint('[SecurityRepository] VPN permission denied by user.');
        return;
      }
    }
    debugPrint('[SecurityRepository] VPN permission granted!');

    // 2. Multi-Protocol Fallback Engine (HTTP + SOCKS5)
    // Tunnels native traffic directly through the user's residential proxy
    final v2rayConfigMap = {
      "log": {
        "loglevel": "warning"
      },
      "policy": {
        "levels": {
          "0": {
            "handshake": 4,
            "connIdle": 45,
            "uplinkOnly": 2,
            "downlinkOnly": 2
          }
        }
      },
      "inbounds": [
        {
          "tag": "socks-in",
          "listen": "0.0.0.0",
          "port": AppConstants.localSocksPort,
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
          "port": AppConstants.localHttpPort,
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
          "tag": "proxy-http",
          "protocol": "http",
          "settings": {
            "servers": [
              {
                "address": ip,
                "port": port,
                "users": [
                  {
                    "user": user,
                    "pass": pass,
                    "level": 0
                  }
                ]
              }
            ]
          },
          "streamSettings": {
            "sockopt": {
              "tcpNoDelay": true,
              "tcpKeepAliveInterval": 10
            }
          }
        },
        {
          "tag": "proxy-socks",
          "protocol": "socks",
          "settings": {
            "servers": [
              {
                "address": ip,
                "port": port,
                "users": [
                  {
                    "user": user,
                    "pass": pass,
                    "level": 0
                  }
                ]
              }
            ]
          },
          "streamSettings": {
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
        "servers": [
          AppConstants.primaryDns,
          AppConstants.secondaryDns
        ]
      },
      "routing": {
        "domainStrategy": "AsIs",
        "rules": [
          {
            "type": "field",
            "ip": [
              ip
            ],
            "outboundTag": "direct"
          },
          {
            "type": "field",
            "inboundTag": ["socks-in", "http-in"],
            "outboundTag": "proxy-http"
          },
          {
            "type": "field",
            "network": "tcp,udp",
            "outboundTag": "proxy-http"
          }
        ]
      }
    };

    final v2rayConfigJson = const JsonEncoder.withIndent('  ').convert(v2rayConfigMap);

    debugPrint('[SecurityRepository] Starting 100% Direct Native Multi-Protocol Engine...');
    await v2ray.startV2Ray(
      remark: AppConstants.proxyOnlyRemark,
      config: v2rayConfigJson,
      proxyOnly: false,
    );
  }

  @override
  Future<void> disconnectVpn() async {
    await v2ray.stopV2Ray();
  }
}
