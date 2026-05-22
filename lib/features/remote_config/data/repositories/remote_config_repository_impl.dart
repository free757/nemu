import 'package:dartz/dartz.dart';
import 'package:nemu/core/error/failures.dart';
import 'package:nemu/features/remote_config/domain/entities/project_config.dart';
import 'package:nemu/features/remote_config/domain/repositories/remote_config_repository.dart';
import 'package:nemu/features/remote_config/data/datasources/remote_config_remote_datasource.dart';

class RemoteConfigRepositoryImpl implements RemoteConfigRepository {
  final RemoteConfigRemoteDataSource remoteDataSource;

  RemoteConfigRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Failure, List<ProjectConfig>>> getProjects() async {
    try {
      final projects = await remoteDataSource.getProjects();
      return Right(projects);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
