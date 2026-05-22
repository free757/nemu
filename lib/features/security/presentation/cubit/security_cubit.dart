import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/connection_status.dart';
import '../../domain/repositories/security_repository.dart';
import '../../domain/usecases/check_connection_usecase.dart';

part 'security_state.dart';

class SecurityCubit extends Cubit<SecurityState> {
  final CheckConnectionUseCase checkConnectionUseCase;
  final SecurityRepository securityRepository;

  /// Reads the global V2Ray connection state notifier
  final ValueNotifier<String> vpnStatusNotifier;

  SecurityCubit({
    required this.checkConnectionUseCase,
    required this.securityRepository,
    required this.vpnStatusNotifier,
  }) : super(SecurityInitial());

  /// Returns true only when V2Ray reports CONNECTED
  bool get _isVpnConnected => vpnStatusNotifier.value == 'CONNECTED';

  Future<void> checkConnection() async {
    emit(SecurityLoading());
    final failureOrStatus = await checkConnectionUseCase();
    failureOrStatus.fold(
      (failure) => emit(SecurityError(failure.message)),
      (status) => emit(SecurityLoaded(status, isConnected: _isVpnConnected)),
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
      // Wait for V2Ray to report CONNECTED via onStatusChanged
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
        // Use actual V2Ray state — not isUSA
        (status) => emit(SecurityLoaded(status, isConnected: _isVpnConnected)),
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
