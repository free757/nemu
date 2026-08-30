import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart';
import '../../../../core/utils/constants.dart';
import '../models/connection_status_model.dart';

abstract class SecurityRemoteDataSource {
  Future<ConnectionStatusModel> checkIP({bool forceRefresh = false});
}

class SecurityRemoteDataSourceImpl implements SecurityRemoteDataSource {
  SecurityRemoteDataSourceImpl();

  // In-memory cache for ultra-fast instant UI loading
  static ConnectionStatusModel? _cachedStatus;
  static DateTime? _lastFetchTime;

  Dio _getDio({bool useProxy = false}) {
    final dio = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 4),
      receiveTimeout: const Duration(seconds: 4),
      sendTimeout: const Duration(seconds: 4),
    ));

    if (useProxy) {
      (dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
        final client = HttpClient();
        client.findProxy = (uri) => 'PROXY 127.0.0.1:${AppConstants.localHttpPort}; DIRECT';
        client.badCertificateCallback = (cert, host, port) => true;
        return client;
      };
    }

    return dio;
  }

  Future<ConnectionStatusModel?> _fetchIpWhoIs(bool useProxy) async {
    try {
      final dio = _getDio(useProxy: useProxy);
      final response = await dio.get(
        AppConstants.ipWhoIsUrl,
        options: Options(headers: {'Connection': 'close'}),
      );
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = response.data is String
            ? json.decode(response.data as String) as Map<String, dynamic>
            : response.data as Map<String, dynamic>;
        if (data['success'] == true) {
          return ConnectionStatusModel.fromIpWhoIs(data);
        }
      }
    } catch (e) {
      debugPrint('[_fetchIpWhoIs] error: $e');
    }
    return null;
  }

  Future<ConnectionStatusModel?> _fetchIpApi(bool useProxy) async {
    try {
      final dio = _getDio(useProxy: useProxy);
      final response = await dio.get(
        AppConstants.ipApiUrl,
        options: Options(headers: {'Connection': 'close'}),
      );
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = response.data is String
            ? json.decode(response.data as String) as Map<String, dynamic>
            : response.data as Map<String, dynamic>;
        if (data['status'] == 'success') {
          return ConnectionStatusModel.fromJson(data);
        }
      }
    } catch (e) {
      debugPrint('[_fetchIpApi] error: $e');
    }
    return null;
  }

  Future<ConnectionStatusModel?> _fetchIpApiCo(bool useProxy) async {
    try {
      final dio = _getDio(useProxy: useProxy);
      final response = await dio.get(
        AppConstants.ipApiCoUrl,
        options: Options(headers: {'Connection': 'close'}),
      );
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = response.data is String
            ? json.decode(response.data as String) as Map<String, dynamic>
            : response.data as Map<String, dynamic>;
        if (data['error'] == null || data['error'] == false) {
          return ConnectionStatusModel.fromIpApiCo(data);
        }
      }
    } catch (e) {
      debugPrint('[_fetchIpApiCo] error: $e');
    }
    return null;
  }

  Future<ConnectionStatusModel?> _fastParallelRace(bool useProxy) async {
    final completer = Completer<ConnectionStatusModel?>();
    int completedCount = 0;
    const totalRequests = 3;

    void handleResult(ConnectionStatusModel? result) {
      completedCount++;
      if (result != null && !completer.isCompleted) {
        completer.complete(result);
      } else if (completedCount == totalRequests && !completer.isCompleted) {
        completer.complete(null);
      }
    }

    _fetchIpWhoIs(useProxy).then(handleResult).catchError((_) => handleResult(null));
    _fetchIpApi(useProxy).then(handleResult).catchError((_) => handleResult(null));
    _fetchIpApiCo(useProxy).then(handleResult).catchError((_) => handleResult(null));

    return completer.future;
  }

  @override
  Future<ConnectionStatusModel> checkIP({bool forceRefresh = false}) async {
    if (forceRefresh) {
      _cachedStatus = null;
      _lastFetchTime = null;
    }

    // 1. Try parallel race via local HTTP proxy first
    try {
      final status = await _fastParallelRace(true);
      if (status != null) {
        _cachedStatus = status;
        _lastFetchTime = DateTime.now();
        return status;
      }
    } catch (_) {}

    // 2. Try direct parallel race via VPN tun
    try {
      final status = await _fastParallelRace(false);
      if (status != null) {
        _cachedStatus = status;
        _lastFetchTime = DateTime.now();
        return status;
      }
    } catch (_) {}

    // 3. Fallback to cache if available
    if (_cachedStatus != null &&
        _lastFetchTime != null &&
        DateTime.now().difference(_lastFetchTime!).inMinutes < 3) {
      return _cachedStatus!;
    }

    throw Exception('Connection timed out. Please check your internet.');
  }
}
