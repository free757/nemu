import '../entities/network_speed_entity.dart';
import '../repositories/network_monitor_repository.dart';

class GetLiveNetworkSpeedUseCase {
  final NetworkMonitorRepository repository;

  GetLiveNetworkSpeedUseCase({required this.repository});

  Stream<NetworkSpeedEntity> call() {
    return repository.getSpeedStream();
  }
}

class ResetNetworkSessionUseCase {
  final NetworkMonitorRepository repository;

  ResetNetworkSessionUseCase({required this.repository});

  void call() {
    repository.resetSessionStats();
  }
}
