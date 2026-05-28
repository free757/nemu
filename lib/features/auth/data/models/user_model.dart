import 'package:nemu/features/auth/domain/entities/user_entity.dart';

class UserModel extends UserEntity {
  const UserModel({
    required super.id,
    required super.pin,
    super.username,
    super.phoneNumber,
    super.email,
    super.password,
    super.proxyIp,
    super.proxyPort,
    super.proxyUser,
    super.proxyPass,
    super.lastDeviceId,
    super.verificationCode,
    super.uiSettings,
    super.rahHumanId,
    super.rahApiKey,
    super.rahBalance,
    super.rahEarnings,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      pin: json['pin'],
      username: json['username'],
      phoneNumber: json['phone_number'],
      email: json['email'],
      password: json['password'],
      proxyIp: json['proxy_ip'],
      proxyPort: json['proxy_port'],
      proxyUser: json['proxy_user'],
      proxyPass: json['proxy_pass'],
      lastDeviceId: json['last_device_id'],
      verificationCode: json['verification_code'],
      uiSettings: json['ui_settings'] as Map<String, dynamic>?,
      rahHumanId: json['rah_human_id'],
      rahApiKey: json['rah_api_key'],
      rahBalance: json['rah_balance'] != null ? (json['rah_balance'] as num).toDouble() : null,
      rahEarnings: json['rah_earnings'] as List<dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'pin': pin,
      'username': username,
      'phone_number': phoneNumber,
      'email': email,
      'password': password,
      'proxy_ip': proxyIp,
      'proxy_port': proxyPort,
      'proxy_user': proxyUser,
      'proxy_pass': proxyPass,
      'last_device_id': lastDeviceId,
      'verification_code': verificationCode,
      'ui_settings': uiSettings,
      'rah_human_id': rahHumanId,
      'rah_api_key': rahApiKey,
      'rah_balance': rahBalance,
      'rah_earnings': rahEarnings,
    };
  }
}
