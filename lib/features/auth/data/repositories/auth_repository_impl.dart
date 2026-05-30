import 'dart:convert';
import 'package:dartz/dartz.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:nemu/core/error/failures.dart';
import 'package:nemu/features/auth/domain/entities/user_entity.dart';
import 'package:nemu/features/auth/domain/repositories/auth_repository.dart';
import 'package:nemu/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:nemu/features/auth/data/models/user_model.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;
  final SharedPreferences sharedPreferences;

  AuthRepositoryImpl({
    required this.remoteDataSource,
    required this.sharedPreferences,
  });

  @override
  Future<Either<Failure, UserEntity>> loginWithPin(String pin, String deviceId) async {
    try {
      final userModel = await remoteDataSource.loginWithPin(pin, deviceId);
      await sharedPreferences.setString('saved_user', jsonEncode(userModel.toJson()));
      return Right(userModel);
    } catch (e) {
      return Left(ServerFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, UserEntity?>> getSavedUser() async {
    try {
      final jsonString = sharedPreferences.getString('saved_user');
      if (jsonString != null) {
        return Right(UserModel.fromJson(jsonDecode(jsonString)));
      }
      return const Right(null);
    } catch (e) {
      return Left(CacheFailure(e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> logout() async {
    try {
      final jsonString = sharedPreferences.getString('saved_user');
      if (jsonString != null) {
        try {
          final user = UserModel.fromJson(jsonDecode(jsonString));
          await remoteDataSource.clearDeviceId(user.pin);
        } catch (_) {
          // If remote clear fails (e.g. offline), still proceed to log out locally
        }
      }
      await sharedPreferences.remove('saved_user');
      return const Right(null);
    } catch (e) {
      return Left(CacheFailure(e.toString()));
    }
  }
}
