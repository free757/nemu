import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/connection_status.dart';
import '../repositories/security_repository.dart';

class CheckConnectionUseCase {
  final SecurityRepository repository;

  CheckConnectionUseCase(this.repository);

  Future<Either<Failure, ConnectionStatus>> call() async {
    return await repository.checkConnection();
  }
}
