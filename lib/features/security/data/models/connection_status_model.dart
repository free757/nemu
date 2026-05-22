import 'package:intl/intl.dart';
import '../../domain/entities/connection_status.dart';

class ConnectionStatusModel extends ConnectionStatus {
  const ConnectionStatusModel({
    required super.ip,
    required super.country,
    required super.countryCode,
    required super.timezone,
    required super.remoteTime,
    required super.offsetSeconds,
    required super.isUSA,
    required super.timezoneMismatch,
  });

  factory ConnectionStatusModel.fromJson(Map<String, dynamic> json) {
    final int offset = json['offset'] ?? 0;
    final DateTime nowUtc = DateTime.now().toUtc();
    final DateTime remoteDateTime = nowUtc.add(Duration(seconds: offset));
    final String formattedTime = DateFormat('hh:mm a').format(remoteDateTime);

    final int deviceOffsetSeconds = DateTime.now().timeZoneOffset.inSeconds;
    final String city = json['city'] ?? "";
    final String region = json['regionName'] ?? "";
    final String countryName = json['country'] ?? "Unknown";
    final String countryCode = json['countryCode'] ?? "";

    return ConnectionStatusModel(
      ip: json['query'] ?? "Unknown",
      country: city.isNotEmpty ? "$city, $region, $countryName" : countryName,
      countryCode: countryCode,
      timezone: json['timezone'] ?? "Unknown",
      remoteTime: formattedTime,
      offsetSeconds: offset,
      isUSA: countryCode == "US",
      timezoneMismatch: (offset != deviceOffsetSeconds),
    );
  }
}
