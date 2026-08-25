import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/connection_status_model.dart';

abstract class SecurityRemoteDataSource {
  Future<ConnectionStatusModel> checkIP();
}

class SecurityRemoteDataSourceImpl implements SecurityRemoteDataSource {
  final http.Client client;

  SecurityRemoteDataSourceImpl({required this.client});

  @override
  Future<ConnectionStatusModel> checkIP() async {
    // 0. Try ipwho.is (Free HTTPS + accurate country detection)
    try {
      final freshClient = http.Client();
      try {
        final response = await freshClient
            .get(
              Uri.parse('https://ipwho.is/'),
              headers: {'Connection': 'close'},
            )
            .timeout(const Duration(seconds: 5));
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          if (data['success'] == true) {
            return ConnectionStatusModel.fromIpWhoIs(data);
          }
        }
      } finally {
        freshClient.close();
      }
    } catch (_) {}

    // 1. Try ip-api.com (HTTP)
    try {
      final freshClient = http.Client();
      try {
        final response = await freshClient
            .get(
              Uri.parse('http://ip-api.com/json/?fields=status,country,countryCode,regionName,city,timezone,offset,query'),
              headers: {
                'Connection': 'close',
              },
            )
            .timeout(const Duration(seconds: 4));
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          if (data['status'] == 'success') {
            return ConnectionStatusModel.fromJson(data);
          }
        }
      } finally {
        freshClient.close();
      }
    } catch (e) {
      // Fail silently to try fallback 1
    }

    // 2. Try ipapi.co (HTTPS Fallback 2)
    try {
      final freshClient = http.Client();
      try {
        final response = await freshClient
            .get(
              Uri.parse('https://ipapi.co/json/'),
              headers: {
                'Connection': 'close',
              },
            )
            .timeout(const Duration(seconds: 4));
        if (response.statusCode == 200) {
          final data = json.decode(response.body);
          if (data['error'] == null || data['error'] == false) {
            return ConnectionStatusModel.fromIpApiCo(data);
          }
        }
      } finally {
        freshClient.close();
      }
    } catch (e) {
      // Fail silently
    }

    // Final fallback: throw timeout
    throw Exception('Connection timed out. Please check your internet.');
  }
}
