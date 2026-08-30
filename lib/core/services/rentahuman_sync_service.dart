import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:nemu/core/utils/constants.dart';

class RentAHumanSyncService {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: AppConstants.rentAHumanApiUrl,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
  ));

  /// Syncs balance and earnings history for a user if they have a valid RAH API key.
  Future<void> syncRentAHumanData({
    required String userId,
    required String apiKey,
  }) async {
    if (apiKey.isEmpty) {
      debugPrint('[RentAHumanSync] ⚠️ RAH API Key is empty for User ID: $userId. Skipping sync.');
      return;
    }

    debugPrint('[RentAHumanSync] 🚀 Starting RentAHuman sync for User ID: $userId');

    try {
      // 1. Fetch wallet balance
      debugPrint('[RentAHumanSync] 📥 Fetching wallet balance from RentAHuman API...');
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
      double? currentlyDue;
      if (balanceResponse.statusCode == 200 && balanceResponse.data != null) {
        final data = balanceResponse.data;
        if (data is Map<String, dynamic>) {
          balance = (data['balance'] as num?)?.toDouble() ?? 0.0;
          currentlyDue = (data['currentlyDue'] as num?)?.toDouble() ??
                         (data['currently_due'] as num?)?.toDouble() ??
                         (data['pending'] as num?)?.toDouble() ?? 0.0;
        } else if (data is num) {
          balance = data.toDouble();
          currentlyDue = 0.0;
        }
        debugPrint('[RentAHumanSync] ✅ Balance successfully fetched: \$$balance, currentlyDue: \$$currentlyDue');
      } else {
        debugPrint('[RentAHumanSync] ❌ Failed to fetch balance. Status code: ${balanceResponse.statusCode}');
      }

      // 2. Fetch transaction ledger / payment history
      debugPrint('[RentAHumanSync] 📥 Fetching wallet transactions from RentAHuman API...');
      final transfersResponse = await _dio.get(
        '/wallet/transactions',
        options: Options(
          headers: {
            'X-API-Key': apiKey,
            'Accept': 'application/json',
          },
        ),
      );

      List<dynamic>? earningsList;
      if (transfersResponse.statusCode == 200 && transfersResponse.data != null) {
        final rawData = transfersResponse.data;
        if (rawData is List) {
          earningsList = rawData;
        } else if (rawData is Map<String, dynamic>) {
          earningsList = rawData['transactions'] ?? rawData['earnings'] ?? rawData['data'] ?? [];
        }
        debugPrint('[RentAHumanSync] ✅ Wallet transactions successfully fetched. Total records: ${earningsList?.length ?? 0}');
      } else {
        debugPrint('[RentAHumanSync] ❌ Failed to fetch wallet transactions. Status code: ${transfersResponse.statusCode}');
      }

      // 3. Update Supabase app_users table
      if (balance != null) {
        debugPrint('[RentAHumanSync] 📤 Syncing metrics to Supabase (app_users table)...');
        await Supabase.instance.client
            .from('app_users')
            .update({
              'rah_balance': balance,
              'rah_currently_due': currentlyDue ?? 0.0,
              'rah_earnings': earningsList ?? [],
              'rah_last_synced_at': DateTime.now().toUtc().toIso8601String(),
            })
            .eq('user_id', userId);
        
        debugPrint('[RentAHumanSync] 🎉 SUCCESS! RentAHuman metrics successfully synced to Supabase for User: $userId.');
      } else {
        debugPrint('[RentAHumanSync] ⚠️ Sync cancelled: Balance data is null.');
      }
    } on DioException catch (e) {
      debugPrint('[RentAHumanSync] ❌ DioException during sync: [${e.response?.statusCode}] ${e.message}');
      debugPrint('[RentAHumanSync] Response details: ${e.response?.data}');
    } catch (e) {
      debugPrint('[RentAHumanSync] ❌ Unexpected exception during sync: $e');
    }
  }
}
