import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubit/app_update_cubit.dart';
import '../cubit/app_update_state.dart';
import 'update_dialog.dart';

class AppUpdateIconButton extends StatefulWidget {
  final String currentVersion;

  const AppUpdateIconButton({
    super.key,
    required this.currentVersion,
  });

  @override
  State<AppUpdateIconButton> createState() => _AppUpdateIconButtonState();
}

class _AppUpdateIconButtonState extends State<AppUpdateIconButton> with SingleTickerProviderStateMixin {
  late AnimationController _badgeAnimationController;

  @override
  void initState() {
    super.initState();
    _badgeAnimationController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )..repeat(reverse: true);

    // Trigger update check on startup
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppUpdateCubit>().checkForUpdate(widget.currentVersion);
    });
  }

  @override
  void dispose() {
    _badgeAnimationController.dispose();
    super.dispose();
  }

  void _showUpdateDialog(BuildContext context, dynamic state) {
    if (state is AppUpdateLoaded && state.hasUpdate) {
      showDialog(
        context: context,
        barrierDismissible: !state.updateInfo.forceUpdate,
        builder: (_) => UpdateDialog(
          updateInfo: state.updateInfo,
          currentVersion: widget.currentVersion,
        ),
      );
    } else {
      // Show elegant SnackBar if app is up to date
      ScaffoldMessenger.of(context).clearSnackBars();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.transparent,
          elevation: 0,
          content: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: Colors.greenAccent.withOpacity(0.3)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.3),
                  blurRadius: 10,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: const Row(
              children: [
                Icon(Icons.check_circle_outline, color: Colors.greenAccent),
                SizedBox(width: 12),
                Text(
                  "تطبيقك محدث إلى آخر إصدار بالفعل! ✅",
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
          duration: const Duration(seconds: 3),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<AppUpdateCubit, AppUpdateState>(
      listener: (context, state) {
        // Automatically pop up update dialog on startup if there is a forced/mandatory update
        if (state is AppUpdateLoaded && state.hasUpdate && state.updateInfo.forceUpdate) {
          _showUpdateDialog(context, state);
        }
      },
      builder: (context, state) {
        bool hasUpdate = false;
        bool isLoading = state is AppUpdateChecking;

        if (state is AppUpdateLoaded) {
          hasUpdate = state.hasUpdate;
        }

        if (isLoading) {
          return const SizedBox(
            width: 48,
            height: 48,
            child: Padding(
              padding: EdgeInsets.all(14.0),
              child: CircularProgressIndicator(
                strokeWidth: 2,
                valueColor: AlwaysStoppedAnimation<Color>(Colors.white70),
              ),
            ),
          );
        }

        return Stack(
          clipBehavior: Clip.none,
          children: [
            IconButton(
              icon: Icon(
                hasUpdate ? Icons.system_update_alt : Icons.system_update_alt_outlined,
                color: hasUpdate ? Colors.blueAccent : Colors.white70,
                size: 26,
              ),
              onPressed: () => _showUpdateDialog(context, state),
            ),
            if (hasUpdate)
              Positioned(
                top: 8,
                right: 8,
                child: AnimatedBuilder(
                  animation: _badgeAnimationController,
                  builder: (context, child) {
                    return Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.redAccent.withOpacity(_badgeAnimationController.value),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.redAccent.withOpacity(0.5),
                            blurRadius: 6 * _badgeAnimationController.value,
                            spreadRadius: 2 * _badgeAnimationController.value,
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
          ],
        );
      },
    );
  }
}
