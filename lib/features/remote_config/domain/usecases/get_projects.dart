import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/project_config.dart';
import '../repositories/remote_config_repository.dart';

class GetProjects {
  final RemoteConfigRepository repository;

  GetProjects(this.repository);

  Future<Either<Failure, List<ProjectConfig>>> call() async {
    return await repository.getProjects();
  }
}
