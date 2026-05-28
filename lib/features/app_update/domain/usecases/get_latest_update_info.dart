import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/app_update_info.dart';
import '../repositories/app_update_repository.dart';

class GetLatestUpdateInfo {
  final AppUpdateRepository repository;

  GetLatestUpdateInfo(this.repository);

  Future<Either<Failure, AppUpdateInfo>> call() async {
    return await repository.getLatestUpdateInfo();
  }
}
