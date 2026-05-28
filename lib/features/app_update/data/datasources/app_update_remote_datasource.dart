import 'dart:convert';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/app_update_info_model.dart';

abstract class AppUpdateRemoteDataSource {
  Future<AppUpdateInfoModel> getLatestUpdateInfo();
}

class AppUpdateRemoteDataSourceImpl implements AppUpdateRemoteDataSource {
  final SupabaseClient supabaseClient;

  AppUpdateRemoteDataSourceImpl({required this.supabaseClient});

  @override
  Future<AppUpdateInfoModel> getLatestUpdateInfo() async {
    final response = await supabaseClient
        .from('remote_configs')
        .select()
        .eq('config_key', 'app_update')
        .single();
    
    final Map<String, dynamic> data = jsonDecode(jsonEncode(response['config_value']));
    return AppUpdateInfoModel.fromJson(data);
  }
}
