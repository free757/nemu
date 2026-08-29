import 'package:equatable/equatable.dart';

class NetworkSpeedEntity extends Equatable {
  final double uploadSpeedBytesPerSec;
  final double downloadSpeedBytesPerSec;
  final int totalSessionUploadBytes;
  final int totalSessionDownloadBytes;
  final int connectedDevicesCount;

  const NetworkSpeedEntity({
    required this.uploadSpeedBytesPerSec,
    required this.downloadSpeedBytesPerSec,
    required this.totalSessionUploadBytes,
    required this.totalSessionDownloadBytes,
    this.connectedDevicesCount = 0,
  });

  String get formattedUploadSpeed => _formatSpeed(uploadSpeedBytesPerSec);
  String get formattedDownloadSpeed => _formatSpeed(downloadSpeedBytesPerSec);
  String get formattedTotalUpload => _formatBytes(totalSessionUploadBytes);
  String get formattedTotalDownload => _formatBytes(totalSessionDownloadBytes);

  static String _formatSpeed(double bytesPerSec) {
    if (bytesPerSec < 1024) {
      return "${bytesPerSec.toStringAsFixed(0)} B/s";
    } else if (bytesPerSec < 1024 * 1024) {
      return "${(bytesPerSec / 1024).toStringAsFixed(1)} KB/s";
    } else {
      return "${(bytesPerSec / (1024 * 1024)).toStringAsFixed(2)} MB/s";
    }
  }

  static String _formatBytes(int bytes) {
    if (bytes < 1024) {
      return "$bytes B";
    } else if (bytes < 1024 * 1024) {
      return "${(bytes / 1024).toStringAsFixed(1)} KB";
    } else if (bytes < 1024 * 1024 * 1024) {
      return "${(bytes / (1024 * 1024)).toStringAsFixed(2)} MB";
    } else {
      return "${(bytes / (1024 * 1024 * 1024)).toStringAsFixed(2)} GB";
    }
  }

  @override
  List<Object?> get props => [
        uploadSpeedBytesPerSec,
        downloadSpeedBytesPerSec,
        totalSessionUploadBytes,
        totalSessionDownloadBytes,
        connectedDevicesCount,
      ];
}
