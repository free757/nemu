import '../../domain/entities/app_update_info.dart';

class AppUpdateInfoModel extends AppUpdateInfo {
  const AppUpdateInfoModel({
    required super.latestVersion,
    required super.downloadUrl,
    required super.changelog,
    required super.forceUpdate,
  });

  factory AppUpdateInfoModel.fromJson(Map<String, dynamic> json) {
    return AppUpdateInfoModel(
      latestVersion: json['version'] as String? ?? '1.0.0',
      downloadUrl: json['url'] as String? ?? '',
      changelog: json['changelog'] as String? ?? '',
      forceUpdate: json['force'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'version': latestVersion,
      'url': downloadUrl,
      'changelog': changelog,
      'force': forceUpdate,
    };
  }
}
