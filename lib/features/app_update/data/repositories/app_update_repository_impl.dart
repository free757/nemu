import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/app_update_info.dart';
import '../../domain/repositories/app_update_repository.dart';
import '../datasources/app_update_remote_datasource.dart';

class AppUpdateRepositoryImpl implements AppUpdateRepository {
  final AppUpdateRemoteDataSource remoteDataSource;

  AppUpdateRepositoryImpl({required this.remoteDataSource});

  @override
  Future<Either<Failure, AppUpdateInfo>> getLatestUpdateInfo() async {
    try {
      final updateInfo = await remoteDataSource.getLatestUpdateInfo();
      return Right(updateInfo);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }
}
