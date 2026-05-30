import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:nemu/features/auth/data/models/user_model.dart';

abstract class AuthRemoteDataSource {
  Future<UserModel> loginWithPin(String pin, String deviceId);
  Future<void> clearDeviceId(String pin);
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final SupabaseClient supabaseClient;

  AuthRemoteDataSourceImpl({required this.supabaseClient});

  @override
  Future<UserModel> loginWithPin(String pin, String deviceId) async {
    // 1. Fetch current user state
    final userResponse = await supabaseClient
        .from('app_users')
        .select()
        .eq('pin', pin)
        .single();
    
    final existingUser = UserModel.fromJson(userResponse);
    
    // 2. Check if a different device is already active
    if (existingUser.lastDeviceId != null && 
        existingUser.lastDeviceId!.isNotEmpty && 
        existingUser.lastDeviceId != deviceId) {
      throw Exception('عذراً، هذا الحساب نشط حالياً على جهاز آخر. يرجى تسجيل الخروج من الجهاز الأول أولاً.');
    }

    // 3. Otherwise, update last_device_id and log in
    final response = await supabaseClient
        .from('app_users')
        .update({'last_device_id': deviceId})
        .eq('pin', pin)
        .select()
        .single();
    
    return UserModel.fromJson(response);
  }

  @override
  Future<void> clearDeviceId(String pin) async {
    await supabaseClient
        .from('app_users')
        .update({'last_device_id': null})
        .eq('pin', pin);
  }
}
