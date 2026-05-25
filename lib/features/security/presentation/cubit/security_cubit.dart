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
  }) : super(SecurityInitial()) {
    debugPrint('[SecurityCubit] Initialized. Current VPN status: ${vpnStatusNotifier.value}');
    // Register listener so changes in V2Ray background status update the UI instantly!
    vpnStatusNotifier.addListener(_onVpnStatusChanged);
  }

  /// Returns true only when V2Ray reports CONNECTED
  bool get _isVpnConnected {
    final isConnected = vpnStatusNotifier.value == 'CONNECTED';
    debugPrint('[SecurityCubit] _isVpnConnected check: ${vpnStatusNotifier.value} (isConnected = $isConnected)');
    return isConnected;
  }

  /// Automatically triggered whenever the V2Ray callback changes the connection status
  void _onVpnStatusChanged() {
    debugPrint('[SecurityCubit] VPN background status changed callback: "${vpnStatusNotifier.value}"');
    
    if (state is SecurityLoaded) {
      final currentLoaded = state as SecurityLoaded;
      final newIsConnected = _isVpnConnected;
      debugPrint('[SecurityCubit] Current state is SecurityLoaded. Updating isConnected from ${currentLoaded.isConnected} to $newIsConnected');
      emit(SecurityLoaded(
        currentLoaded.status,
        isConnected: newIsConnected,
      ));
      // Force connection verification whenever VPN status toggles to update IP/timezone instantly!
      checkConnection();
    } else {
      // If we are in another state but VPN becomes connected, load a placeholder and check connection
      if (_isVpnConnected) {
        debugPrint('[SecurityCubit] VPN is CONNECTED but state is $state. Emitting default loaded status and triggering connection verification.');
        emit(const SecurityLoaded(
          ConnectionStatus(
            ip: 'Fetching...',
            country: 'United States',
            countryCode: 'US',
            timezone: 'Unknown',
            remoteTime: 'Unknown',
            offsetSeconds: 0,
            isUSA: true,
            timezoneMismatch: false,
          ),
          isConnected: true,
        ));
        // Verify connection info silently to update the placeholder
        checkConnection();
      }
    }
  }

  Future<void> checkConnection() async {
    debugPrint('[SecurityCubit] checkConnection() triggered. Current state: $state');
    emit(SecurityLoading());
    final failureOrStatus = await checkConnectionUseCase();
    failureOrStatus.fold(
      (failure) {
        debugPrint('[SecurityCubit] checkConnection failed: ${failure.message}');
        emit(SecurityError(failure.message));
      },
      (status) {
        final isConn = _isVpnConnected;
        debugPrint('[SecurityCubit] checkConnection success. IP: ${status.ip}, Country: ${status.country}, isUSA: ${status.isUSA}, isVpnConnected: $isConn');
        emit(SecurityLoaded(status, isConnected: isConn));
      },
    );
  }

  Future<void> toggleVpn({
    required bool connect,
    String? ip,
    int? port,
    String? user,
    String? pass,
  }) async {
    debugPrint('[SecurityCubit] toggleVpn called: connect=$connect, ip=$ip, port=$port, user=$user');
    emit(SecurityLoading());
    
    if (connect) {
      if (ip == null || port == null || user == null || pass == null) {
        debugPrint('[SecurityCubit] Aborting VPN connection: missing credentials!');
        emit(SecurityError('Missing Proxy Credentials'));
        return;
      }
      
      try {
        debugPrint('[SecurityCubit] Initiating VPN connection command...');
        await securityRepository.connectVpn(ip: ip, port: port, user: user, pass: pass);
        
        // Wait for V2Ray to start connecting and establish status
        debugPrint('[SecurityCubit] Waiting 3 seconds for V2Ray handshake...');
        await Future.delayed(const Duration(seconds: 3));
        
        debugPrint('[SecurityCubit] Running connection verification check...');
        final failureOrStatus = await checkConnectionUseCase();
        
        failureOrStatus.fold(
          (failure) {
            debugPrint('[SecurityCubit] Silent connection verification failed: ${failure.message}');
            emit(SecurityLoaded(
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
              isConnected: _isVpnConnected,
            ));
          },
          (status) {
            final isConn = _isVpnConnected;
            debugPrint('[SecurityCubit] Silent connection verification succeeded. IP: ${status.ip}, isUSA: ${status.isUSA}, isVpnConnected: $isConn');
            emit(SecurityLoaded(status, isConnected: isConn));
          },
        );
      } catch (e) {
        debugPrint('[SecurityCubit] Exception caught during VPN connection: $e');
        emit(SecurityError(e.toString()));
      }
    } else {
      try {
        debugPrint('[SecurityCubit] Initiating VPN disconnect command...');
        await securityRepository.disconnectVpn();
        
        debugPrint('[SecurityCubit] Waiting 1 second for teardown...');
        await Future.delayed(const Duration(seconds: 1));
        
        debugPrint('[SecurityCubit] Verifying disconnection status...');
        final failureOrStatus = await checkConnectionUseCase();
        
        failureOrStatus.fold(
          (failure) {
            debugPrint('[SecurityCubit] Disconnection verification complete (Failed fetch expected): ${failure.message}');
            emit(const SecurityLoaded(
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
            ));
          },
          (status) {
            debugPrint('[SecurityCubit] Disconnection verification complete. Current network IP: ${status.ip}');
            emit(SecurityLoaded(status, isConnected: false));
          },
        );
      } catch (e) {
        debugPrint('[SecurityCubit] Exception caught during VPN disconnection: $e');
        emit(SecurityError(e.toString()));
      }
    }
  }

  @override
  Future<void> close() {
    debugPrint('[SecurityCubit] Closing Cubit. Removing listener...');
    vpnStatusNotifier.removeListener(_onVpnStatusChanged);
    return super.close();
  }
}
