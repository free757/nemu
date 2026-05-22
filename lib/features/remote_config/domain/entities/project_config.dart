import 'package:equatable/equatable.dart';

class ProjectConfig extends Equatable {
  final String id;
  final String name;
  final String url;
  final String color;
  final List<String> selectorsToHide;
  final String customJs;
  final String? androidPackageName;
  final String? iosUrlScheme;
  final String? appStoreLink;

  const ProjectConfig({
    required this.id,
    required this.name,
    required this.url,
    required this.color,
    required this.selectorsToHide,
    required this.customJs,
    this.androidPackageName,
    this.iosUrlScheme,
    this.appStoreLink,
  });

  @override
  List<Object?> get props => [
        id,
        name,
        url,
        color,
        selectorsToHide,
        customJs,
        androidPackageName,
        iosUrlScheme,
        appStoreLink,
      ];
}
