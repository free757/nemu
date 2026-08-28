part of 'network_monitor_cubit.dart';

abstract class NetworkMonitorState extends Equatable {
  const NetworkMonitorState();

  @override
  List<Object?> get props => [];
}

class NetworkMonitorInitial extends NetworkMonitorState {
  const NetworkMonitorInitial();
}

class NetworkMonitorActive extends NetworkMonitorState {
  final NetworkSpeedEntity speed;

  const NetworkMonitorActive({required this.speed});

  @override
  List<Object?> get props => [speed];
}
