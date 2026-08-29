import 'package:flutter/material.dart';
import 'package:nemu/core/theme/app_theme.dart';

class UserProfileCard extends StatelessWidget {
  final dynamic user;

  const UserProfileCard({super.key, required this.user});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Card(
      color: isDark ? Colors.white.withOpacity(0.05) : AppTheme.lightCard,
      elevation: isDark ? 0 : 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
          color: isDark ? Colors.white.withOpacity(0.05) : AppTheme.lightBorder,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            const CircleAvatar(
              backgroundColor: AppTheme.primaryBlue,
              child: Icon(Icons.person, color: Colors.white),
            ),
            const SizedBox(width: 15),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.phoneNumber ?? 'No Phone',
                  style: TextStyle(
                    color: isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  user.email ?? 'No Email',
                  style: TextStyle(
                    color: isDark ? Colors.white.withOpacity(0.6) : AppTheme.lightTextSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
