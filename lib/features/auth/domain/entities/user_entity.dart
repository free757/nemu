import 'package:equatable/equatable.dart';

class UserEntity extends Equatable {
  final String id;
  final String pin;
  final String? username;
  final String? phoneNumber;
  final String? email;
  final String? password;
  final String? proxyIp;
  final int? proxyPort;
  final String? proxyUser;
  final String? proxyPass;
  final String? lastDeviceId;
  final String? verificationCode;

  const UserEntity({
    required this.id,
    required this.pin,
    this.username,
    this.phoneNumber,
    this.email,
    this.password,
    this.proxyIp,
    this.proxyPort,
    this.proxyUser,
    this.proxyPass,
    this.lastDeviceId,
    this.verificationCode,
  });

  @override
  List<Object?> get props => [
        id,
        pin,
        username,
        phoneNumber,
        email,
        password,
        proxyIp,
        proxyPort,
        proxyUser,
        proxyPass,
        lastDeviceId,
        verificationCode,
      ];
}
