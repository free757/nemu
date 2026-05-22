import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/project_config.dart';

abstract class RemoteConfigRepository {
  Future<Either<Failure, List<ProjectConfig>>> getProjects();
}
