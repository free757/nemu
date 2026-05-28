import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/app_update_info.dart';

abstract class AppUpdateRepository {
  Future<Either<Failure, AppUpdateInfo>> getLatestUpdateInfo();
}
