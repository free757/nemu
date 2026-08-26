import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import '../models/connection_status_model.dart';

abstract class SecurityRemoteDataSource {
  Future<ConnectionStatusModel> checkIP();
}

class SecurityRemoteDataSourceImpl implements SecurityRemoteDataSource {
  SecurityRemoteDataSourceImpl();

  Dio _getDio({bool useProxy = false}) {
    final dio = Dio(BaseOptions(
      connectTimeout: const Duration(seconds: 6),
      receiveTimeout: const Duration(seconds: 6),
      sendTimeout: const Duration(seconds: 6),
    ));

    if (useProxy) {
      (dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
        final client = HttpClient();
        client.findProxy = (uri) => 'PROXY 127.0.0.1:10809; DIRECT';
        client.badCertificateCallback = (cert, host, port) => true;
        return client;
      };
    }

    return dio;
  }

  Future<Map<String, dynamic>?> _tryFetch(String url, bool useProxy) async {
    final label = useProxy ? '[ViaProxy]' : '[Direct]';
    print('[Datasource]$label Trying: $url');
    try {
      final dio = _getDio(useProxy: useProxy);
      final response = await dio.get(
        url,
        options: Options(headers: {'Connection': 'close'}),
      );
      print('[Datasource]$label StatusCode: ${response.statusCode} for $url');
      if (response.statusCode == 200) {
        final Map<String, dynamic> data = response.data is String
            ? json.decode(response.data as String) as Map<String, dynamic>
            : response.data as Map<String, dynamic>;
        print('[Datasource]$label Raw data keys: ${data.keys.toList()}');
        return data;
      }
    } catch (e) {
      print('[Datasource]$label ERROR fetching $url: $e');
    }
    return null;
  }

  @override
  Future<ConnectionStatusModel> checkIP() async {
    print('[Datasource] ===== checkIP() START =====');

    for (final useProxy in [true, false]) {
      final label = useProxy ? '[ViaProxy]' : '[Direct]';

      // 0. ipwho.is
      try {
        final data = await _tryFetch('https://ipwho.is/', useProxy);
        if (data != null && data['success'] == true) {
          print('[Datasource]$label SUCCESS from ipwho.is: ip=${data['ip']}, country=${data['country']}');
          return ConnectionStatusModel.fromIpWhoIs(data);
        }
      } catch (e) {
        print('[Datasource]$label ipwho.is parse exception: $e');
      }

      // 1. ip-api.com
      try {
        final data = await _tryFetch(
          'http://ip-api.com/json/?fields=status,country,countryCode,regionName,city,timezone,offset,query',
          useProxy,
        );
        if (data != null && data['status'] == 'success') {
          print('[Datasource]$label SUCCESS from ip-api.com: ip=${data['query']}, country=${data['country']}');
          return ConnectionStatusModel.fromJson(data);
        }
      } catch (e) {
        print('[Datasource]$label ip-api.com parse exception: $e');
      }

      // 2. ipapi.co
      try {
        final data = await _tryFetch('https://ipapi.co/json/', useProxy);
        if (data != null && (data['error'] == null || data['error'] == false)) {
          print('[Datasource]$label SUCCESS from ipapi.co: ip=${data['ip']}, country=${data['country_name']}');
          return ConnectionStatusModel.fromIpApiCo(data);
        }
      } catch (e) {
        print('[Datasource]$label ipapi.co parse exception: $e');
      }

      print('[Datasource]$label All endpoints failed, trying ${!useProxy ? "direct" : "proxy"}...');
    }

    print('[Datasource] ===== checkIP() FAILED ALL =====');
    throw Exception('Connection timed out. Please check your internet.');
  }
}
