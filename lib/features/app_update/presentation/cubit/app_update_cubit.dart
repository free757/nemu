import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_latest_update_info.dart';
import 'app_update_state.dart';

class AppUpdateCubit extends Cubit<AppUpdateState> {
  final GetLatestUpdateInfo getLatestUpdateInfo;

  AppUpdateCubit({required this.getLatestUpdateInfo}) : super(AppUpdateInitial());

  Future<void> checkForUpdate(String currentVersion) async {
    emit(AppUpdateChecking());
    
    final failureOrUpdateInfo = await getLatestUpdateInfo();
    
    failureOrUpdateInfo.fold(
      (failure) => emit(AppUpdateError(failure.message)),
      (updateInfo) {
        final hasUpdate = _isUpdateAvailable(currentVersion, updateInfo.latestVersion);
        emit(AppUpdateLoaded(
          hasUpdate: hasUpdate,
          updateInfo: updateInfo,
          currentVersion: currentVersion,
        ));
      },
    );
  }

  bool _isUpdateAvailable(String current, String latest) {
    try {
      // Split by + to separate the version name and build number
      final currentParts = current.split('+');
      final latestParts = latest.split('+');

      final currentSemVer = currentParts.first.split('.').map(int.parse).toList();
      final latestSemVer = latestParts.first.split('.').map(int.parse).toList();

      // Compare semantic version name (e.g., 1.0.0 vs 1.0.1)
      for (int i = 0; i < 3; i++) {
        final currentVal = i < currentSemVer.length ? currentSemVer[i] : 0;
        final latestVal = i < latestSemVer.length ? latestSemVer[i] : 0;

        if (latestVal > currentVal) return true;
        if (currentVal > latestVal) return false;
      }

      // If version names are identical, compare build numbers if available (e.g., +1 vs +2)
      if (currentParts.length > 1 && latestParts.length > 1) {
        final currentBuild = int.tryParse(currentParts[1]) ?? 0;
        final latestBuild = int.tryParse(latestParts[1]) ?? 0;
        return latestBuild > currentBuild;
      }
    } catch (_) {}
    return false;
  }
}
