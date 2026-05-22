import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../domain/entities/project_config.dart';
import '../../domain/usecases/get_projects.dart';

part 'remote_config_state.dart';

class RemoteConfigCubit extends Cubit<RemoteConfigState> {
  final GetProjects getProjects;

  RemoteConfigCubit({required this.getProjects}) : super(RemoteConfigInitial());

  Future<void> fetchProjects() async {
    emit(RemoteConfigLoading());
    final failureOrProjects = await getProjects();
    failureOrProjects.fold(
      (failure) => emit(RemoteConfigError(failure.message)),
      (projects) => emit(RemoteConfigLoaded(projects)),
    );
  }
}
