import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/connection_status.dart';
import '../../domain/repositories/security_repository.dart';
import '../../domain/usecases/check_connection_usecase.dart';

part 'security_state.dart';

class SecurityCubit extends Cubit<SecurityState> {
  final CheckConnectionUseCase checkConnectionUseCase;
  final SecurityRepository securityRepository;

  SecurityCubit({
    required this.checkConnectionUseCase,
    required this.securityRepository,
  }) : super(SecurityInitial());

  Future<void> checkConnection() async {
    emit(SecurityLoading());
    final failureOrStatus = await checkConnectionUseCase();
    failureOrStatus.fold(
      (failure) => emit(SecurityError(failure.message)),
      (status) => emit(SecurityLoaded(status, isConnected: status.isUSA)),
    );
  }

  Future<void> toggleVpn({
    required bool connect,
    String? ip,
    int? port,
    String? user,
    String? pass,
  }) async {
    emit(SecurityLoading());
    if (connect) {
      if (ip == null || port == null || user == null || pass == null) return;
      await securityRepository.connectVpn(ip: ip, port: port, user: user, pass: pass);
      // Wait a bit for connection and then refresh status
      await Future.delayed(const Duration(seconds: 3));
      final failureOrStatus = await checkConnectionUseCase();
      failureOrStatus.fold(
        (failure) => emit(const SecurityLoaded(
          ConnectionStatus(
            ip: 'Connection Failed',
            country: 'Unknown',
            countryCode: 'XX',
            timezone: 'Unknown',
            remoteTime: 'Unknown',
            offsetSeconds: 0,
            isUSA: false,
            timezoneMismatch: false,
          ),
          isConnected: false,
        )),
        (status) => emit(SecurityLoaded(status, isConnected: status.isUSA)),
      );
    } else {
      await securityRepository.disconnectVpn();
      await Future.delayed(const Duration(seconds: 1));
      final failureOrStatus = await checkConnectionUseCase();
      failureOrStatus.fold(
        (failure) => emit(const SecurityLoaded(
          ConnectionStatus(
            ip: 'Disconnected',
            country: 'Unknown',
            countryCode: 'XX',
            timezone: 'Unknown',
            remoteTime: 'Unknown',
            offsetSeconds: 0,
            isUSA: false,
            timezoneMismatch: false,
          ),
          isConnected: false,
        )),
        (status) => emit(SecurityLoaded(status, isConnected: false)),
      );
    }
  }
}
