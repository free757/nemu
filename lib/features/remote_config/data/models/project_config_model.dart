import '../../domain/entities/project_config.dart';

class ProjectConfigModel extends ProjectConfig {
  const ProjectConfigModel({
    required super.id,
    required super.name,
    required super.url,
    required super.color,
    required super.selectorsToHide,
    required super.customJs,
    super.androidPackageName,
    super.iosUrlScheme,
    super.appStoreLink,
    super.isVisible = true,
  });

  factory ProjectConfigModel.fromJson(Map<String, dynamic> json) {
    return ProjectConfigModel(
      id: json['id'] as String,
      name: json['name'] as String,
      url: json['url'] as String,
      color: json['color'] as String,
      selectorsToHide: List<String>.from(json['selectors_to_hide'] as List),
      customJs: json['custom_js'] as String? ?? '',
      androidPackageName: json['android_package_name'] as String?,
      iosUrlScheme: json['ios_url_scheme'] as String?,
      appStoreLink: json['app_store_link'] as String?,
      isVisible: json['is_visible'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'url': url,
      'color': color,
      'selectors_to_hide': selectorsToHide,
      'custom_js': customJs,
      'android_package_name': androidPackageName,
      'ios_url_scheme': iosUrlScheme,
      'app_store_link': appStoreLink,
      'is_visible': isVisible,
    };
  }
}
