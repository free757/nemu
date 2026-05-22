part of 'security_cubit.dart';

abstract class SecurityState extends Equatable {
  const SecurityState();

  @override
  List<Object?> get props => [];
}

class SecurityInitial extends SecurityState {}

class SecurityLoading extends SecurityState {}

class SecurityLoaded extends SecurityState {
  final ConnectionStatus status;
  final bool isConnected;

  const SecurityLoaded(this.status, {this.isConnected = false});

  @override
  List<Object?> get props => [status, isConnected];
}

class SecurityError extends SecurityState {
  final String message;

  const SecurityError(this.message);

  @override
  List<Object?> get props => [message];
}
