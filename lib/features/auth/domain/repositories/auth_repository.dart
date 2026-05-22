import 'package:dartz/dartz.dart';
import 'package:nemu/core/error/failures.dart';
import 'package:nemu/features/auth/domain/entities/user_entity.dart';

abstract class AuthRepository {
  Future<Either<Failure, UserEntity>> loginWithPin(String pin, String deviceId);
  Future<Either<Failure, void>> logout();
  Future<Either<Failure, UserEntity?>> getSavedUser();
}
