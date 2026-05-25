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
    // Create a brand new Client instance for this check to completely avoid TCP socket caching/keep-alive reuse!
    final freshClient = http.Client();
    try {
      final response = await freshClient
          .get(
            Uri.parse('http://ip-api.com/json/?fields=status,country,countryCode,regionName,city,timezone,offset,query'),
            headers: {
              'Connection': 'close', // Force closing the socket to prevent TCP connection reuse
            },
          )
          .timeout(const Duration(seconds: 4));
      if (response.statusCode == 200) {
        return ConnectionStatusModel.fromJson(json.decode(response.body));
      } else {
        throw Exception('Failed to fetch IP data');
      }
    } on TimeoutException {
      throw Exception('Connection timed out. Please check your internet.');
    } finally {
      freshClient.close(); // Cleanly release the client and its sockets immediately
    }
  }
}
