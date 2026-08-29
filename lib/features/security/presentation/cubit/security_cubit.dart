import 'package:flutter/foundation.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../../../core/utils/constants.dart';
import '../../../../core/utils/overlay_manager.dart';
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
    print('[SecurityCubit] Initialized. Current VPN status: ${vpnStatusNotifier.value}');
    // Register listener so changes in V2Ray background status update the UI instantly!
    vpnStatusNotifier.addListener(_onVpnStatusChanged);
  }

  /// Returns true only when V2Ray reports CONNECTED
  bool get _isVpnConnected {
    final isConnected = vpnStatusNotifier.value == 'CONNECTED';
    print('[SecurityCubit] _isVpnConnected check: ${vpnStatusNotifier.value} (isConnected = $isConnected)');
    return isConnected;
  }

  /// Automatically triggered whenever the V2Ray callback changes the connection status
  void _onVpnStatusChanged() {
    print('[SecurityCubit] VPN background status changed callback: "${vpnStatusNotifier.value}"');
    
    if (state is SecurityLoaded) {
      final currentLoaded = state as SecurityLoaded;
      final newIsConnected = _isVpnConnected;
      print('[SecurityCubit] Current state is SecurityLoaded. Updating isConnected from ${currentLoaded.isConnected} to $newIsConnected');
      emit(SecurityLoaded(
        currentLoaded.status,
        isConnected: newIsConnected,
      ));
      // Force connection verification whenever VPN status toggles to update IP/timezone instantly!
      checkConnection();
    } else {
      // If we are in another state but VPN becomes connected, load a placeholder and check connection
      if (_isVpnConnected) {
        print('[SecurityCubit] VPN is CONNECTED but state is $state. Emitting default loaded status and triggering connection verification.');
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

  Future<void> checkConnection({int retryCount = 0, bool forceRefresh = false}) async {
    // Only emit SecurityLoading if we don't have any loaded status yet
    if (state is! SecurityLoaded && retryCount == 0) {
      emit(SecurityLoading());
    }
    
    final failureOrStatus = await checkConnectionUseCase(forceRefresh: forceRefresh);
    
    await failureOrStatus.fold(
      (failure) async {
        // If VPN is reported connected, retry after a very brief delay
        if (_isVpnConnected && retryCount < 3) {
          await Future.delayed(const Duration(milliseconds: 600));
          return checkConnection(retryCount: retryCount + 1);
        }
        
        if (state is! SecurityLoaded) {
          emit(SecurityError(failure.message));
        }
      },
      (status) async {
        final isConn = _isVpnConnected;
        
        // If VPN is reported connected, but we fetched a non-USA IP, retry very quickly
        if (isConn && !status.isUSA && retryCount < 3) {
          await Future.delayed(const Duration(milliseconds: 600));
          return checkConnection(retryCount: retryCount + 1);
        }
        
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
    print('[SecurityCubit] toggleVpn called: connect=$connect, ip=$ip, port=$port, user=$user');
    emit(SecurityLoading());
    
    if (connect) {
      if (ip == null || port == null || user == null || pass == null) {
        print('[SecurityCubit] Aborting VPN connection: missing credentials!');
        emit(SecurityError('Missing Proxy Credentials'));
        return;
      }
      
      try {
        print('[SecurityCubit] Initiating VPN connection command...');
        // Acquire wake lock & wifi lock to keep CPU and networking alive during long hotspot sharing/uploads
        await OverlayManager.acquireWakeLock();
        await securityRepository.connectVpn(ip: ip, port: port, user: user, pass: pass);
        
        // Wait for V2Ray handshake
        print('[SecurityCubit] Waiting for V2Ray handshake...');
        await Future.delayed(AppConstants.vpnHandshakeDelay);
        
        // Clear cache and verify actual connection IP via Worker proxy
        await checkConnection(forceRefresh: true);
      } catch (e) {
        print('[SecurityCubit] Exception caught during VPN connection: $e');
        emit(SecurityError(e.toString()));
      }
    } else {
      try {
        print('[SecurityCubit] Initiating VPN disconnect command...');
        await securityRepository.disconnectVpn();
        await OverlayManager.releaseWakeLock();
        
        print('[SecurityCubit] Waiting for teardown...');
        await Future.delayed(AppConstants.vpnTeardownDelay);
        
        print('[SecurityCubit] Verifying disconnection status...');
        final failureOrStatus = await checkConnectionUseCase();
        
        failureOrStatus.fold(
          (failure) {
            print('[SecurityCubit] Disconnection verification complete (Failed fetch expected): ${failure.message}');
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
            print('[SecurityCubit] Disconnection verification complete. Current network IP: ${status.ip}');
            emit(SecurityLoaded(status, isConnected: false));
          },
        );
      } catch (e) {
        print('[SecurityCubit] Exception caught during VPN disconnection: $e');
        emit(SecurityError(e.toString()));
      }
    }
  }

  @override
  Future<void> close() {
    print('[SecurityCubit] Closing Cubit. Removing listener...');
    vpnStatusNotifier.removeListener(_onVpnStatusChanged);
    return super.close();
  }
}
