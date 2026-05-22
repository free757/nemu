import 'package:equatable/equatable.dart';

class ConnectionStatus extends Equatable {
  final String ip;
  final String country;
  final String countryCode;
  final String timezone;
  final String remoteTime;
  final int offsetSeconds;
  final bool isUSA;
  final bool timezoneMismatch;

  const ConnectionStatus({
    required this.ip,
    required this.country,
    required this.countryCode,
    required this.timezone,
    required this.remoteTime,
    required this.offsetSeconds,
    required this.isUSA,
    required this.timezoneMismatch,
  });

  @override
  List<Object?> get props => [
        ip,
        country,
        countryCode,
        timezone,
        remoteTime,
        offsetSeconds,
        isUSA,
        timezoneMismatch,
      ];
}
