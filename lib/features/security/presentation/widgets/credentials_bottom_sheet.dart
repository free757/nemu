import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'package:nemu/features/auth/presentation/cubit/auth_cubit.dart';

class CredentialsBottomSheet extends StatefulWidget {
  final dynamic user;

  const CredentialsBottomSheet({super.key, required this.user});

  static void show(BuildContext context, dynamic user) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: isDark ? AppTheme.darkSurface : AppTheme.lightSurface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      builder: (_) => CredentialsBottomSheet(user: user),
    );
  }

  @override
  State<CredentialsBottomSheet> createState() => _CredentialsBottomSheetState();
}

class _CredentialsBottomSheetState extends State<CredentialsBottomSheet> {
  late String _emailVal;
  late String _passwordVal;
  late String _codeVal;
  bool _isPasswordVisible = false;

  @override
  void initState() {
    super.initState();
    _emailVal = widget.user.email ?? '';
    _passwordVal = widget.user.password ?? '';
    _codeVal = widget.user.verificationCode ?? widget.user.pin;
  }

  void _copy(String value, String label) {
    Clipboard.setData(ClipboardData(text: value));
    HapticFeedback.lightImpact();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(label),
          backgroundColor: Colors.amber,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surfaceColor = isDark ? AppTheme.darkSurface : AppTheme.lightSurface;
    final primaryText = isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary;
    final secondaryText = isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary;
    final fieldBg = isDark ? Colors.white.withValues(alpha: 0.03) : Colors.black.withValues(alpha: 0.03);
    final fieldBorder = isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.08);
    final copyBtnBg = isDark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.06);
    final copyBtnIcon = isDark ? Colors.white : Colors.black87;

    return BlocListener<AuthCubit, dynamic>(
      listener: (context, state) {
        if (state is AuthAuthenticated) {
          setState(() {
            _emailVal = state.user.email ?? '';
            _passwordVal = state.user.password ?? '';
            _codeVal = state.user.verificationCode ?? state.user.pin;
          });
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        decoration: BoxDecoration(
          color: surfaceColor,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
          border: Border.all(
            color: isDark ? Colors.white.withValues(alpha: 0.05) : AppTheme.lightBorder,
            width: 1,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Handle Bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark
                      ? Colors.white.withValues(alpha: 0.2)
                      : Colors.black.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),

            const Center(
              child: Icon(Icons.vpn_key, size: 36, color: Colors.amberAccent),
            ),
            const SizedBox(height: 10),

            Center(
              child: Text(
                "بيانات الاعتماد ورمز التحقق",
                style: TextStyle(
                  color: primaryText,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
            const SizedBox(height: 6),

            Center(
              child: Text(
                "استخدم هذه البيانات لتسجيل الدخول في منصات العمل",
                textAlign: TextAlign.center,
                style: TextStyle(color: secondaryText, fontSize: 12),
              ),
            ),
            const SizedBox(height: 24),

            // Email Field
            Text(
              "البريد الإلكتروني",
              style: TextStyle(
                color: secondaryText,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            _buildField(
              value: _emailVal,
              icon: Icons.email_outlined,
              fieldBg: fieldBg,
              fieldBorder: fieldBorder,
              copyBtnBg: copyBtnBg,
              copyBtnIcon: copyBtnIcon,
              onCopy: () => _copy(_emailVal, "تم نسخ البريد الإلكتروني! 📋"),
              trailing: [],
            ),
            const SizedBox(height: 16),

            // Password Field
            Text(
              "كلمة المرور",
              style: TextStyle(
                color: secondaryText,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 6),
            _buildField(
              value: _isPasswordVisible ? _passwordVal : '••••••••••••',
              icon: Icons.lock_outline,
              fieldBg: fieldBg,
              fieldBorder: fieldBorder,
              copyBtnBg: copyBtnBg,
              copyBtnIcon: copyBtnIcon,
              onCopy: () => _copy(_passwordVal, "تم نسخ كلمة المرور! 🔑"),
              trailing: [
                GestureDetector(
                  onTap: () {
                    setState(() => _isPasswordVisible = !_isPasswordVisible);
                    HapticFeedback.lightImpact();
                  },
                  child: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: copyBtnBg,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      _isPasswordVisible
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      color: copyBtnIcon,
                      size: 16,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
            ),
            const SizedBox(height: 20),

            // Verification Code Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.amberAccent.withValues(alpha: 0.1),
                    Colors.orangeAccent.withValues(alpha: 0.05),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.amberAccent.withValues(alpha: 0.15)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.timer_outlined, color: Colors.amberAccent, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        "رمز التحقق النشط (LIVE PIN)",
                        style: TextStyle(
                          color: Colors.amberAccent.withValues(alpha: 0.8),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _codeVal,
                        style: const TextStyle(
                          color: Colors.amberAccent,
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 3,
                        ),
                      ),
                      const SizedBox(width: 15),
                      GestureDetector(
                        onTap: () => _copy(_codeVal, "تم نسخ رمز التحقق بنجاح! ⏱️"),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.amberAccent.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.copy, color: Colors.amberAccent, size: 18),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    "هذا الرمز يتطابق تلقائياً مع توقيت القاهرة لتأمين عملية تسجيل الدخول الخاصة بك.",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: secondaryText.withValues(alpha: 0.7),
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Close Button
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amberAccent,
                foregroundColor: AppTheme.darkInk,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              ),
              child: const Text("إغلاق النافذة", style: TextStyle(fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }

  Widget _buildField({
    required String value,
    required IconData icon,
    required Color fieldBg,
    required Color fieldBorder,
    required Color copyBtnBg,
    required Color copyBtnIcon,
    required VoidCallback onCopy,
    required List<Widget> trailing,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: fieldBg,
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: fieldBorder),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.amberAccent, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: SelectableText(
              value,
              style: const TextStyle(color: Colors.amberAccent, fontSize: 14),
            ),
          ),
          ...trailing,
          GestureDetector(
            onTap: onCopy,
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: copyBtnBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(Icons.copy, color: copyBtnIcon, size: 16),
            ),
          ),
        ],
      ),
    );
  }
}
