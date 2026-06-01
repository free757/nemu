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

    // Egypt specific check: if IP timezone is Cairo, allow both +2 EET (7200s) and +3 EEST (10800s).
    // Otherwise, allow a 1-hour (3600s) margin of error to account for Daylight Saving Time (DST) differences.
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
}
