import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'dart:convert';
import 'package:flutter/services.dart';
import '../../../remote_config/domain/entities/project_config.dart';

class WebViewPage extends StatefulWidget {
  final ProjectConfig config;
  final String? autoEmail;
  final String? autoPassword;

  const WebViewPage({
    super.key,
    required this.config,
    this.autoEmail,
    this.autoPassword,
  });

  @override
  State<WebViewPage> createState() => _WebViewPageState();
}

class _WebViewPageState extends State<WebViewPage> {
  late final WebViewController controller;
  bool _isLoading = true;
  String? _nemuBotBase64;

  Future<void> _loadBotImage() async {
    try {
      final byteData = await rootBundle.load('assets/nemu_bot.png');
      final bytes = byteData.buffer.asUint8List();
      if (mounted) {
        setState(() {
          _nemuBotBase64 = base64Encode(bytes);
        });
      }
    } catch (e) {
      debugPrint("Failed to load bot image: $e");
    }
  }

  @override
  void initState() {
    super.initState();
    _loadBotImage();
    
    // 1. Force clear all cookies BEFORE loading to guarantee absolute privacy
    WebViewCookieManager().clearCookies();

    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      // 2. Set a clean Chrome Mobile User-Agent that masks the WebView identity
      ..setUserAgent("Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36")
      // 3. Clear all browser cache and local storage
      ..clearCache()
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            setState(() {
              _isLoading = true;
            });
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
            _applyCustomizations(url);
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.config.url));
  }

  void _applyCustomizations(String url) {
    final selectors = widget.config.selectorsToHide.map((s) => "'$s'").join(',');
    final customJs = widget.config.customJs;
    final isTolokaAuth = url.contains('we.toloka.ai/auth') || url.contains('we.toloka.ai/login');

    final email = widget.autoEmail ?? '';
    final password = widget.autoPassword ?? '';

    controller.runJavaScript('''
      (function() {
        // --- 1. Automatic Toloka Auth Page Customization & Auto-Click ---
        if ($isTolokaAuth) {
          // Accept cookies automatically if banner exists
          const cookieButtons = Array.from(document.querySelectorAll('button'));
          const acceptBtn = cookieButtons.find(b => b.textContent && (b.textContent.includes('Accept all') || b.textContent.includes('قبول الكل')));
          if (acceptBtn) {
            try { acceptBtn.click(); } catch(e){}
          }

          // Find Microsoft button
          const buttons = Array.from(document.querySelectorAll('button'));
          const msBtn = buttons.find(b => b.textContent && b.textContent.includes('Microsoft'));
          if (msBtn) {
            // Mark ancestor chain
            let current = msBtn;
            while (current && current !== document.body) {
              current.classList.add('keep-me');
              current = current.parentElement;
            }
            document.body.classList.add('keep-me');

            // Hide everything that doesn't have .keep-me and is not a descendant of keep-me
            const allElements = document.querySelectorAll('body *');
            allElements.forEach(el => {
              if (!el.classList.contains('keep-me') && !el.closest('.keep-me')) {
                el.style.setProperty('display', 'none', 'important');
              }
            });

            // Hide other sibling buttons of the Microsoft button
            let sibling = msBtn.parentElement.firstElementChild;
            while (sibling) {
              if (sibling !== msBtn) {
                sibling.style.setProperty('display', 'none', 'important');
              }
              sibling = sibling.nextElementSibling;
            }

            // Make the page center the Microsoft button beautifully
            const body = document.body;
            body.style.setProperty('background', '#121212', 'important');
            body.style.setProperty('display', 'flex', 'important');
            body.style.setProperty('justify-content', 'center', 'important');
            body.style.setProperty('align-items', 'center', 'important');
            body.style.setProperty('height', '100vh', 'important');
            body.style.setProperty('margin', '0', 'important');
            body.style.setProperty('padding', '20px', 'important');

            // Make ancestors stretch and center
            let p = msBtn.parentElement;
            while (p && p !== body) {
              p.style.setProperty('display', 'flex', 'important');
              p.style.setProperty('flex-direction', 'column', 'important');
              p.style.setProperty('justify-content', 'center', 'important');
              p.style.setProperty('align-items', 'center', 'important');
              p.style.setProperty('background', 'transparent', 'important');
              p.style.setProperty('border', 'none', 'important');
              p.style.setProperty('box-shadow', 'none', 'important');
              p.style.setProperty('padding', '0', 'important');
              p.style.setProperty('margin', '0', 'important');
              p.style.setProperty('width', '100%', 'important');
              p.style.setProperty('height', 'auto', 'important');
              p = p.parentElement;
            }

            // Style the Microsoft button to look premium and centered
            msBtn.style.setProperty('display', 'flex', 'important');
            msBtn.style.setProperty('align-items', 'center', 'important');
            msBtn.style.setProperty('justify-content', 'center', 'important');
            msBtn.style.setProperty('gap', '12px', 'important');
            msBtn.style.setProperty('background', '#2f2f2f', 'important');
            msBtn.style.setProperty('color', '#ffffff', 'important');
            msBtn.style.setProperty('border', '1px solid rgba(255,255,255,0.15)', 'important');
            msBtn.style.setProperty('padding', '16px 28px', 'important');
            msBtn.style.setProperty('border-radius', '12px', 'important');
            msBtn.style.setProperty('font-size', '16px', 'important');
            msBtn.style.setProperty('font-weight', '600', 'important');
            msBtn.style.setProperty('width', '100%', 'important');
            msBtn.style.setProperty('max-width', '320px', 'important');
            msBtn.style.setProperty('box-shadow', '0 4px 12px rgba(0,0,0,0.3)', 'important');

            // Automatically trigger the click on the Microsoft login button!
            if ('$email' !== '' && '$password' !== '') {
              setTimeout(() => {
                try { msBtn.click(); } catch(e){}
              }, 1200);
            }
          }
        } else {
          // Hide selectors from remote config
          const selectors = [$selectors];
          selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => el.style.display = 'none');
          });
        }

        // --- 2. Automatic Microsoft Login Page Auto-Fill ---
        const pageUrl = window.location.href;
        if (pageUrl.includes('login.live.com') || pageUrl.includes('login.microsoftonline.com')) {
          const autoEmail = '$email';
          const autoPassword = '$password';

          if (autoEmail !== '' && autoPassword !== '') {
            // Helper function to dispatch input events to update framework states (e.g. React/Angular)
            const triggerInputEvents = (el, val) => {
              el.value = val;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
              el.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true }));
              el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
            };

            // Step A: Email Input Page
            const emailField = document.querySelector('input[type="email"], input[name="loginfmt"], #i0116');
            const nextBtn = document.querySelector('input[type="submit"], #idSIButton9');
            
            if (emailField && emailField.value !== autoEmail) {
              triggerInputEvents(emailField, autoEmail);
              if (nextBtn) {
                setTimeout(() => {
                  try { nextBtn.click(); } catch(e){}
                }, 800);
              }
            }

            // Step B: Password Input Page
            const passField = document.querySelector('input[type="password"], input[name="passwd"], #i0118');
            const signInBtn = document.querySelector('input[type="submit"], #idSIButton9');
            
            if (passField && passField.value !== autoPassword) {
              triggerInputEvents(passField, autoPassword);
              if (signInBtn) {
                setTimeout(() => {
                  try { signInBtn.click(); } catch(e){}
                }, 800);
              }
            }

            // Step C: KMSI (Stay signed in?) Page
            const kmsiBtn = document.querySelector('input[type="submit"], #idSIButton9');
            const pageText = document.body.innerText || '';
            if (pageText.includes('Stay signed in') || pageText.includes('الإبقاء على تسجيل الدخول') || document.querySelector('#KmsiDescription')) {
              if (kmsiBtn) {
                setTimeout(() => {
                  try { kmsiBtn.click(); } catch(e){}
                }, 600);
              }
            }
          }
        }

        // --- 3. ALWAYS run Custom JS from Remote Config at the end as an ultimate override!
        try {
          $customJs
        } catch(e) {
          console.error("Remote Config Custom JS Error:", e);
        }
      })();
    ''');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.config.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => controller.reload(),
          ),
        ],
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: controller),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(),
            ),
        ],
      ),
    );
  }
}
