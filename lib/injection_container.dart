import 'package:flutter/foundation.dart';
import 'package:get_it/get_it.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_v2ray/flutter_v2ray.dart';

import 'package:nemu/features/remote_config/data/datasources/remote_config_remote_datasource.dart';
import 'package:nemu/features/remote_config/data/repositories/remote_config_repository_impl.dart';
import 'package:nemu/features/remote_config/domain/repositories/remote_config_repository.dart';
import 'package:nemu/features/remote_config/domain/usecases/get_projects.dart';
import 'package:nemu/features/remote_config/presentation/cubit/remote_config_cubit.dart';

import 'package:nemu/features/security/data/datasources/security_remote_datasource.dart';
import 'package:nemu/features/security/data/repositories/security_repository_impl.dart';
import 'package:nemu/features/security/domain/repositories/security_repository.dart';
import 'package:nemu/features/security/domain/usecases/check_connection_usecase.dart';
import 'package:nemu/features/security/presentation/cubit/security_cubit.dart';

import 'package:nemu/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:nemu/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:nemu/features/auth/domain/repositories/auth_repository.dart';
import 'package:nemu/features/auth/presentation/cubit/auth_cubit.dart';

final sl = GetIt.instance;

/// Global notifier for V2Ray connection state — updated by onStatusChanged callback
final vpnStatusNotifier = ValueNotifier<String>('DISCONNECTED');

Future<void> init() async {
  //! Features - Auth
  // Cubit
  sl.registerFactory(() => AuthCubit(authRepository: sl()));
  // Repository
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(remoteDataSource: sl(), sharedPreferences: sl()),
  );
  // Data sources
  sl.registerLazySingleton<AuthRemoteDataSource>(
    () => AuthRemoteDataSourceImpl(supabaseClient: sl()),
  );

  //! Features - Remote Config
  // Cubit
  sl.registerFactory(() => RemoteConfigCubit(getProjects: sl()));
  // Use cases
  sl.registerLazySingleton(() => GetProjects(sl()));
  // Repository
  sl.registerLazySingleton<RemoteConfigRepository>(
    () => RemoteConfigRepositoryImpl(remoteDataSource: sl()),
  );
  // Data sources
  sl.registerLazySingleton<RemoteConfigRemoteDataSource>(
    () => RemoteConfigRemoteDataSourceImpl(supabaseClient: sl()),
  );

  //! Features - Security
  // Cubit — passes vpnStatusNotifier so it reads real V2Ray state
  sl.registerFactory(() => SecurityCubit(
    checkConnectionUseCase: sl(),
    securityRepository: sl(),
    vpnStatusNotifier: vpnStatusNotifier,
  ));
  // Use cases
  sl.registerLazySingleton(() => CheckConnectionUseCase(sl()));
  // Repository
  sl.registerLazySingleton<SecurityRepository>(
    () => SecurityRepositoryImpl(remoteDataSource: sl(), v2ray: sl()),
  );
  // Data sources
  sl.registerLazySingleton<SecurityRemoteDataSource>(
    () => SecurityRemoteDataSourceImpl(client: sl()),
  );

  //! Core
  // No global core DI for now

  //! External
  final sharedPreferences = await SharedPreferences.getInstance();
  sl.registerLazySingleton(() => sharedPreferences);
  sl.registerLazySingleton(() => http.Client());
  sl.registerLazySingleton(() => Supabase.instance.client);
  sl.registerLazySingleton(() => FlutterV2ray(onStatusChanged: (status) {
    // Update global notifier — SecurityCubit reads this to reflect real state
    vpnStatusNotifier.value = status.state;
    debugPrint('V2Ray Status: ${status.state}');
  }));
}
