import 'package:equatable/equatable.dart';
import '../../domain/entities/app_update_info.dart';

abstract class AppUpdateState extends Equatable {
  const AppUpdateState();

  @override
  List<Object?> get props => [];
}

class AppUpdateInitial extends AppUpdateState {}

class AppUpdateChecking extends AppUpdateState {}

class AppUpdateLoaded extends AppUpdateState {
  final bool hasUpdate;
  final AppUpdateInfo updateInfo;
  final String currentVersion;

  const AppUpdateLoaded({
    required this.hasUpdate,
    required this.updateInfo,
    required this.currentVersion,
  });

  @override
  List<Object?> get props => [hasUpdate, updateInfo, currentVersion];
}

class AppUpdateError extends AppUpdateState {
  final String message;

  const AppUpdateError(this.message);

  @override
  List<Object?> get props => [message];
}
