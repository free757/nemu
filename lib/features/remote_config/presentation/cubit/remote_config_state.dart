part of 'remote_config_cubit.dart';

abstract class RemoteConfigState extends Equatable {
  const RemoteConfigState();

  @override
  List<Object> get props => [];
}

class RemoteConfigInitial extends RemoteConfigState {}

class RemoteConfigLoading extends RemoteConfigState {}

class RemoteConfigLoaded extends RemoteConfigState {
  final List<ProjectConfig> projects;
  const RemoteConfigLoaded(this.projects);

  @override
  List<Object> get props => [projects];
}

class RemoteConfigError extends RemoteConfigState {
  final String message;
  const RemoteConfigError(this.message);

  @override
  List<Object> get props => [message];
}
