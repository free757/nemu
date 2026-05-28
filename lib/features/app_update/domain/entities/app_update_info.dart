import 'package:equatable/equatable.dart';

class AppUpdateInfo extends Equatable {
  final String latestVersion;
  final String downloadUrl;
  final String changelog;
  final bool forceUpdate;

  const AppUpdateInfo({
    required this.latestVersion,
    required this.downloadUrl,
    required this.changelog,
    required this.forceUpdate,
  });

  @override
  List<Object?> get props => [latestVersion, downloadUrl, changelog, forceUpdate];
}
