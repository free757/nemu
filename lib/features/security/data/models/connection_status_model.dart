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
    final String ipTimezone = json['timezone'] ?? "Unknown";

    final bool isCairo = ipTimezone == "Africa/Cairo";
    final bool isMismatch = isCairo
        ? (deviceOffsetSeconds != 7200 && deviceOffsetSeconds != 10800)
        : (offset - deviceOffsetSeconds).abs() > 3600;

    return ConnectionStatusModel(
      ip: json['query'] ?? "Unknown",
      country: city.isNotEmpty ? "$city, $region, $countryName" : countryName,
      countryCode: countryCode,
      timezone: ipTimezone,
      remoteTime: formattedTime,
      offsetSeconds: offset,
      isUSA: countryCode == "US",
      timezoneMismatch: isMismatch,
    );
  }

  factory ConnectionStatusModel.fromIpWhoIs(Map<String, dynamic> json) {
    final Map<String, dynamic> timezoneJson = json['timezone'] ?? {};
    final int offset = timezoneJson['offset'] ?? 0;
    final DateTime nowUtc = DateTime.now().toUtc();
    final DateTime remoteDateTime = nowUtc.add(Duration(seconds: offset));
    final String formattedTime = DateFormat('hh:mm a').format(remoteDateTime);

    final int deviceOffsetSeconds = DateTime.now().timeZoneOffset.inSeconds;
    final String city = json['city'] ?? "";
    final String region = json['region'] ?? "";
    final String countryName = json['country'] ?? "Unknown";
    final String countryCode = json['country_code'] ?? "";
    final String ipTimezone = timezoneJson['id'] ?? "Unknown";

    final bool isCairo = ipTimezone == "Africa/Cairo";
    final bool isMismatch = isCairo
        ? (deviceOffsetSeconds != 7200 && deviceOffsetSeconds != 10800)
        : (offset - deviceOffsetSeconds).abs() > 3600;

    return ConnectionStatusModel(
      ip: json['ip'] ?? "Unknown",
      country: city.isNotEmpty ? "$city, $region, $countryName" : countryName,
      countryCode: countryCode,
      timezone: ipTimezone,
      remoteTime: formattedTime,
      offsetSeconds: offset,
      isUSA: countryCode == "US",
      timezoneMismatch: isMismatch,
    );
  }

  factory ConnectionStatusModel.fromIpInfo(Map<String, dynamic> json) {
    final String city = json['city'] ?? "";
    final String region = json['region'] ?? "";
    final String countryCode = json['country'] ?? "";
    final String ipTimezone = json['timezone'] ?? "Unknown";

    return ConnectionStatusModel(
      ip: json['ip'] ?? "Unknown",
      country: city.isNotEmpty ? "$city, $region, $countryCode" : countryCode,
      countryCode: countryCode,
      timezone: ipTimezone,
      remoteTime: DateFormat('hh:mm a').format(DateTime.now()),
      offsetSeconds: 0,
      isUSA: countryCode == "US",
      timezoneMismatch: false,
    );
  }
}
