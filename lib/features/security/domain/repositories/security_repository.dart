import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../domain/entities/connection_status.dart';

abstract class SecurityRepository {
  Future<Either<Failure, ConnectionStatus>> checkConnection({bool forceRefresh = false});
  Future<void> connectVpn({
    required String ip,
    required int port,
    required String user,
    required String pass,
  });
  Future<void> disconnectVpn();
  Stream<String> get vpnStatusStream;
}
