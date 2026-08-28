import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/network_speed_entity.dart';
import '../../domain/usecases/network_monitor_usecases.dart';

part 'network_monitor_state.dart';

class NetworkMonitorCubit extends Cubit<NetworkMonitorState> {
  final GetLiveNetworkSpeedUseCase getLiveNetworkSpeedUseCase;
  final ResetNetworkSessionUseCase resetNetworkSessionUseCase;

  StreamSubscription<NetworkSpeedEntity>? _speedSubscription;

  NetworkMonitorCubit({
    required this.getLiveNetworkSpeedUseCase,
    required this.resetNetworkSessionUseCase,
  }) : super(const NetworkMonitorInitial()) {
    _startListening();
  }

  void _startListening() {
    _speedSubscription?.cancel();
    _speedSubscription = getLiveNetworkSpeedUseCase().listen((speed) {
      emit(NetworkMonitorActive(speed: speed));
    });
  }

  void resetStats() {
    resetNetworkSessionUseCase();
    emit(const NetworkMonitorActive(
      speed: NetworkSpeedEntity(
        uploadSpeedBytesPerSec: 0,
        downloadSpeedBytesPerSec: 0,
        totalSessionUploadBytes: 0,
        totalSessionDownloadBytes: 0,
      ),
    ));
  }

  @override
  Future<void> close() {
    _speedSubscription?.cancel();
    return super.close();
  }
}
