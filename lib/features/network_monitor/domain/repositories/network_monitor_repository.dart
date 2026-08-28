import '../entities/network_speed_entity.dart';

abstract class NetworkMonitorRepository {
  Stream<NetworkSpeedEntity> getSpeedStream();
  void resetSessionStats();
}
