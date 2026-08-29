import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:nemu/core/theme/app_theme.dart';
import 'package:nemu/features/auth/domain/entities/user_entity.dart';
import 'package:nemu/features/auth/presentation/cubit/auth_cubit.dart';
import 'package:nemu/features/auth/data/models/user_model.dart';

class CredentialsBottomSheet extends StatefulWidget {
  final dynamic user;

  const CredentialsBottomSheet({super.key, required this.user});

  static void show(BuildContext context, dynamic user) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.black,
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

  @override
  Widget build(BuildContext context) {
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
          color: Colors.black,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
          border: Border.all(color: Colors.white.withOpacity(0.05), width: 1),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Center(
              child: Icon(Icons.vpn_key, size: 36, color: Colors.amberAccent),
            ),
            const SizedBox(height: 10),
            const Center(
              child: Text(
                "بيانات الاعتماد ورمز التحقق",
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
              ),
            ),
            const SizedBox(height: 6),
            Center(
              child: Text(
                "استخدم هذه البيانات لتسجيل الدخول في منصات العمل",
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 12),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              "البريد الإلكتروني",
              style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.03),
                borderRadius: BorderRadius.circular(15),
                border: Border.all(color: Colors.white.withOpacity(0.08)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.email_outlined, color: Colors.amberAccent, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SelectableText(
                      _emailVal,
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: _emailVal));
                      HapticFeedback.lightImpact();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text("تم نسخ البريد الإلكتروني! 📋"),
                          backgroundColor: Colors.amber,
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.copy, color: Colors.white, size: 16),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              "كلمة المرور",
              style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.03),
                borderRadius: BorderRadius.circular(15),
                border: Border.all(color: Colors.white.withOpacity(0.08)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.lock_outline, color: Colors.amberAccent, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SelectableText(
                      _isPasswordVisible ? _passwordVal : '••••••••••••',
                      style: const TextStyle(color: Colors.white, fontSize: 14),
                    ),
                  ),
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _isPasswordVisible = !_isPasswordVisible;
                      });
                      HapticFeedback.lightImpact();
                    },
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        _isPasswordVisible ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                        color: Colors.white,
                        size: 16,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: _passwordVal));
                      HapticFeedback.lightImpact();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text("تم نسخ كلمة المرور! 🔑"),
                          backgroundColor: Colors.amber,
                        ),
                      );
                    },
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.copy, color: Colors.white, size: 16),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.amberAccent.withOpacity(0.1),
                    Colors.orangeAccent.withOpacity(0.05),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.amberAccent.withOpacity(0.15)),
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
                          color: Colors.amberAccent.withOpacity(0.8),
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
                        onTap: () {
                          Clipboard.setData(ClipboardData(text: _codeVal));
                          HapticFeedback.mediumImpact();
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text("تم نسخ رمز التحقق بنجاح! ⏱️"),
                              backgroundColor: Colors.amber,
                            ),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.amberAccent.withOpacity(0.2),
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
                      color: Colors.white.withOpacity(0.4),
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              child: const Text("إغلاق النافذة", style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amberAccent,
                foregroundColor: AppTheme.darkInk,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              ),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }
}
