import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../cubit/auth_cubit.dart';

class PinLoginPage extends StatefulWidget {
  const PinLoginPage({super.key});

  @override
  State<PinLoginPage> createState() => _PinLoginPageState();
}

class _PinLoginPageState extends State<PinLoginPage> {
  String _pin = '';
  final ShakeController _shakeController = ShakeController();

  void _onKeyPress(String digit) {
    if (_pin.length < 4) {
      setState(() {
        _pin += digit;
      });
      if (_pin.length == 4) {
        context.read<AuthCubit>().login(_pin);
      }
    }
  }

  void _onBackspace() {
    if (_pin.isNotEmpty) {
      setState(() {
        _pin = _pin.substring(0, _pin.length - 1);
      });
    }
  }

  void _onClear() {
    if (_pin.isNotEmpty) {
      setState(() {
        _pin = '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF0F2027), Color(0xFF203A43), Color(0xFF2C5364)],
          ),
        ),
        child: SafeArea(
          child: BlocListener<AuthCubit, AuthState>(
            listener: (context, state) {
              if (state is AuthError) {
                _shakeController.shake();
                HapticFeedback.heavyImpact();
                // Clear PIN after shake completes
                Future.delayed(const Duration(milliseconds: 600), () {
                  setState(() {
                    _pin = '';
                  });
                });
              }
            },
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(flex: 2),
                // Premium macOS Avatar & Title
                Column(
                  children: [
                    Container(
                      width: 110,
                      height: 110,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.06),
                        border: Border.all(color: Colors.white.withOpacity(0.15), width: 1.5),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.2),
                            blurRadius: 20,
                            spreadRadius: 2,
                          )
                        ],
                      ),
                      child: const Center(
                        child: Icon(
                          Icons.lock_person_outlined,
                          size: 50,
                          color: Colors.white70,
                        ),
                      ),
                    ),
                    const SizedBox(height: 25),
                    const Text(
                      "Security Gateway",
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        letterSpacing: 0.8,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "Enter PIN to unlock dashboard",
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.white.withOpacity(0.5),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 40),
                
                // Shakeable Passcode Dots
                ShakeWidget(
                  controller: _shakeController,
                  child: BlocBuilder<AuthCubit, AuthState>(
                    builder: (context, state) {
                      if (state is AuthLoading) {
                        return const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white70),
                          ),
                        );
                      }
                      return _buildPasscodeDots();
                    },
                  ),
                ),
                
                const Spacer(flex: 2),
                
                // Frosted Glass Numeric Keypad
                _buildKeypad(),
                
                const Spacer(flex: 1),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPasscodeDots() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(4, (index) {
        bool isFilled = _pin.length > index;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          margin: const EdgeInsets.symmetric(horizontal: 12),
          width: 16,
          height: 16,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: isFilled ? Colors.white : Colors.transparent,
            border: Border.all(color: Colors.white.withOpacity(0.4), width: 1.5),
            boxShadow: isFilled
                ? [
                    BoxShadow(
                      color: Colors.white.withOpacity(0.6),
                      blurRadius: 10,
                      spreadRadius: 1,
                    )
                  ]
                : [],
          ),
        );
      }),
    );
  }

  Widget _buildKeypad() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildKeyButton('1'),
              _buildKeyButton('2'),
              _buildKeyButton('3'),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildKeyButton('4'),
              _buildKeyButton('5'),
              _buildKeyButton('6'),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildKeyButton('7'),
              _buildKeyButton('8'),
              _buildKeyButton('9'),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildKeyButton('C', action: _onClear, isUtility: true),
              _buildKeyButton('0'),
              _buildKeyButton('⌫', action: _onBackspace, isUtility: true, icon: Icons.backspace_outlined),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildKeyButton(String label, {VoidCallback? action, bool isUtility = false, IconData? icon}) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        if (action != null) {
          action();
        } else {
          _onKeyPress(label);
        }
      },
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isUtility ? Colors.white.withOpacity(0.03) : Colors.white.withOpacity(0.06),
          border: Border.all(
            color: isUtility ? Colors.white.withOpacity(0.05) : Colors.white.withOpacity(0.1),
            width: 1,
          ),
        ),
        child: Center(
          child: icon != null
              ? Icon(icon, color: Colors.white70, size: 22)
              : Text(
                  label,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: isUtility ? 18 : 26,
                    fontWeight: isUtility ? FontWeight.w500 : FontWeight.w300,
                  ),
                ),
        ),
      ),
    );
  }
}

// macOS Shake Transition Components
class ShakeWidget extends StatefulWidget {
  final Widget child;
  final double shakeOffset;
  final Duration shakeDuration;
  final ShakeController controller;

  const ShakeWidget({
    super.key,
    required this.child,
    required this.controller,
    this.shakeOffset = 24.0,
    this.shakeDuration = const Duration(milliseconds: 400),
  });

  @override
  State<ShakeWidget> createState() => _ShakeWidgetState();
}

class _ShakeWidgetState extends State<ShakeWidget> with SingleTickerProviderStateMixin {
  late final AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(vsync: this, duration: widget.shakeDuration);
    widget.controller.addListener(_shake);
  }

  void _shake() {
    _animationController.forward(from: 0.0);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_shake);
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animationController,
      child: widget.child,
      builder: (context, child) {
        // macOS elastic horizontal shake algorithm using sine curves
        final double offset = sin(_animationController.value * 4 * pi) * 
            widget.shakeOffset * 
            (1.0 - _animationController.value);
        return Transform.translate(
          offset: Offset(offset, 0),
          child: child,
        );
      },
    );
  }
}

class ShakeController extends ChangeNotifier {
  void shake() {
    notifyListeners();
  }
}
