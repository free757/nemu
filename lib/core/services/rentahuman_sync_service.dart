import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class RentAHumanSyncService {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'https://rentahuman.ai/api',
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
  ));

  /// Syncs balance and earnings history for a user if they have a valid RAH API key.
  Future<void> syncRentAHumanData({
    required String userId,
    required String apiKey,
  }) async {
    if (apiKey.isEmpty) return;

    try {
      // 1. Fetch wallet balance
      final balanceResponse = await _dio.get(
        '/wallet/balance',
        options: Options(
          headers: {
            'X-API-Key': apiKey,
            'Accept': 'application/json',
          },
        ),
      );

      double? balance;
      if (balanceResponse.statusCode == 200 && balanceResponse.data != null) {
        final data = balanceResponse.data;
        if (data is Map<String, dynamic>) {
          // The API returns balance, let's check for balance field
          balance = (data['balance'] as num?)?.toDouble() ?? 0.0;
        } else if (data is num) {
          balance = data.toDouble();
        }
      }

      // 2. Fetch transaction earnings history
      final transfersResponse = await _dio.get(
        '/transfers/mine',
        queryParameters: {
          'direction': 'all', // can be sent, received, all
        },
        options: Options(
          headers: {
            'X-API-Key': apiKey,
            'Accept': 'application/json',
          },
        ),
      );

      List<dynamic>? earningsList;
      if (transfersResponse.statusCode == 200 && transfersResponse.data != null) {
        final data = transfersResponse.data;
        if (data is List) {
          earningsList = data;
        } else if (data is Map<String, dynamic> && data['transfers'] is List) {
          earningsList = data['transfers'];
        }
      }

      // 3. If at least balance was fetched, update Supabase
      if (balance != null) {
        final Map<String, dynamic> updateData = {
          'rah_balance': balance,
        };
        if (earningsList != null) {
          updateData['rah_earnings'] = earningsList;
        }

        await Supabase.instance.client
            .from('app_users')
            .update(updateData)
            .eq('id', userId);
      }
    } on DioException catch (_) {
      // Fail silently to avoid interrupting the user's connection status
    } catch (_) {
      // Fail silently to avoid interrupting any other timers
    }
  }
}
