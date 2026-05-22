import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:nemu/features/auth/data/models/user_model.dart';

abstract class AuthRemoteDataSource {
  Future<UserModel> loginWithPin(String pin, String deviceId);
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final SupabaseClient supabaseClient;

  AuthRemoteDataSourceImpl({required this.supabaseClient});

  @override
  Future<UserModel> loginWithPin(String pin, String deviceId) async {
    final response = await supabaseClient
        .from('app_users')
        .update({'last_device_id': deviceId})
        .eq('pin', pin)
        .select()
        .single();
    
    return UserModel.fromJson(response);
  }
}
