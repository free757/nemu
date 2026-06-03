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
    if (apiKey.isEmpty) {
      print('[RentAHumanSync] ⚠️ RAH API Key is empty for User ID: $userId. Skipping sync.');
      return;
    }

    print('[RentAHumanSync] 🚀 Starting RentAHuman sync for User ID: $userId');

    try {
      // 1. Fetch wallet balance
      print('[RentAHumanSync] 📥 Fetching wallet balance from RentAHuman API...');
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
        print('[RentAHumanSync] ✅ Balance successfully fetched: \$$balance, currentlyDue: \$$currentlyDue');
      } else {
        print('[RentAHumanSync] ❌ Failed to fetch balance. Status code: ${balanceResponse.statusCode}');
      }

      // 2. Fetch transaction ledger / payment history
      print('[RentAHumanSync] 📥 Fetching wallet transactions from RentAHuman API...');
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
        final data = transfersResponse.data;
        if (data is List) {
          earningsList = data;
        } else if (data is Map<String, dynamic>) {
          earningsList = data['transactions'] as List<dynamic>?;
        }
        print('[RentAHumanSync] ✅ Wallet transactions successfully fetched. Total records: ${earningsList?.length ?? 0}');
      } else {
        print('[RentAHumanSync] ❌ Failed to fetch wallet transactions. Status code: ${transfersResponse.statusCode}');
      }

      // 3. If at least balance was fetched, update Supabase
      if (balance != null) {
        print('[RentAHumanSync] 📤 Syncing metrics to Supabase (app_users table)...');
        final Map<String, dynamic> updateData = {
          'rah_balance': balance,
        };
        if (currentlyDue != null) {
          updateData['rah_currently_due'] = currentlyDue;
        }
        if (earningsList != null) {
          updateData['rah_earnings'] = earningsList;
        }

        await Supabase.instance.client
            .from('app_users')
            .update(updateData)
            .eq('id', userId);
        
        print('[RentAHumanSync] 🎉 SUCCESS! RentAHuman metrics successfully synced to Supabase for User: $userId.');
      } else {
        print('[RentAHumanSync] ⚠️ Sync cancelled: Balance data is null.');
      }
    } on DioException catch (e) {
      print('[RentAHumanSync] ❌ DioException during sync: [${e.response?.statusCode}] ${e.message}');
      print('[RentAHumanSync] Response details: ${e.response?.data}');
    } catch (e) {
      print('[RentAHumanSync] ❌ Unexpected exception during sync: $e');
    }
  }
}
