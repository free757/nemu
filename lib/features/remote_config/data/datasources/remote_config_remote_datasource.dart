import 'dart:convert';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/project_config_model.dart';

abstract class RemoteConfigRemoteDataSource {
  Future<List<ProjectConfigModel>> getProjects();
}

class RemoteConfigRemoteDataSourceImpl implements RemoteConfigRemoteDataSource {
  final SupabaseClient supabaseClient;

  RemoteConfigRemoteDataSourceImpl({required this.supabaseClient});

  @override
  Future<List<ProjectConfigModel>> getProjects() async {
    final response = await supabaseClient
        .from('remote_configs')
        .select()
        .eq('config_key', 'projects')
        .single();
    
    final List<dynamic> data = jsonDecode(jsonEncode(response['config_value']));
    return data.map((json) => ProjectConfigModel.fromJson(json as Map<String, dynamic>)).toList();
  }
}
