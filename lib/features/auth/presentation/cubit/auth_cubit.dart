import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'dart:io';
import 'package:nemu/features/auth/domain/entities/user_entity.dart';
import 'package:nemu/features/auth/domain/repositories/auth_repository.dart';
import 'package:nemu/features/security/domain/repositories/security_repository.dart';

part 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  final AuthRepository authRepository;
  final SecurityRepository securityRepository;

  AuthCubit({
    required this.authRepository,
    required this.securityRepository,
  }) : super(AuthInitial());

  Future<void> checkAuth() async {
    final failureOrUser = await authRepository.getSavedUser();
    failureOrUser.fold(
      (failure) => emit(AuthUnauthenticated()),
      (user) {
        if (user != null) {
          emit(AuthAuthenticated(user));
        } else {
          emit(AuthUnauthenticated());
        }
      },
    );
  }

  Future<void> login(String pin) async {
    emit(AuthLoading());
    
    String? deviceId;
    final deviceInfo = DeviceInfoPlugin();
    if (Platform.isAndroid) {
      final androidInfo = await deviceInfo.androidInfo;
      deviceId = androidInfo.id;
    } else if (Platform.isIOS) {
      final iosInfo = await deviceInfo.iosInfo;
      deviceId = iosInfo.identifierForVendor;
    }

    final failureOrUser = await authRepository.loginWithPin(pin, deviceId ?? 'unknown');
    failureOrUser.fold(
      (failure) => emit(AuthError(failure.message)),
      (user) => emit(AuthAuthenticated(user)),
    );
  }

  Future<void> logout() async {
    try {
      await securityRepository.disconnectVpn();
    } catch (_) {
      // Ignore errors if disconnection fails to guarantee logout completes
    }
    await authRepository.logout();
    emit(AuthUnauthenticated());
  }

  void updateUserInfo(UserEntity updatedUser) {
    if (state is AuthAuthenticated) {
      emit(AuthAuthenticated(updatedUser));
    }
  }
}
