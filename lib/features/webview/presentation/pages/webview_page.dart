import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
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
  bool _customizationApplied = false;
  @override
  void initState() {
    super.initState();
    
    // 1. Force clear all cookies BEFORE loading to guarantee absolute privacy
    WebViewCookieManager().clearCookies();

    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
      // 2. Set a clean Chrome Mobile User-Agent that masks the WebView identity
      ..setUserAgent("Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36")
      // 3. Clear all browser cache and local storage
      ..clearCache()
      ..addJavaScriptChannel(
        'NemuChannel',
        onMessageReceived: (JavaScriptMessage message) {
          if (message.message == 'customization_applied') {
            setState(() {
              _customizationApplied = true;
            });
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (String url) {
            final isTolokaAuth = url.contains('we.toloka.ai/auth') || url.contains('we.toloka.ai/login') || url.contains('we.toloka.ai');
            setState(() {
              _isLoading = true;
              if (isTolokaAuth) {
                _customizationApplied = false;
              } else {
                _customizationApplied = true;
              }
            });
            _applyCustomizations(url);
          },
          onPageFinished: (String url) {
            setState(() {
              _isLoading = false;
            });
            _applyCustomizations(url);
          },
          onUrlChange: (UrlChange change) {
            if (change.url != null) {
              final isTolokaAuth = change.url!.contains('we.toloka.ai/auth') || change.url!.contains('we.toloka.ai/login') || change.url!.contains('we.toloka.ai');
              if (!isTolokaAuth) {
                setState(() {
                  _customizationApplied = true;
                });
              }
              _applyCustomizations(change.url!);
            }
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.config.url));
  }

  void _applyCustomizations(String url) {
    final selectors = widget.config.selectorsToHide.map((s) => "'$s'").join(',');
    final customJs = widget.config.customJs;
    final isTolokaAuth = url.contains('we.toloka.ai/auth') || url.contains('we.toloka.ai/login') || url.contains('we.toloka.ai');

    final email = widget.autoEmail ?? '';
    final password = widget.autoPassword ?? '';

    controller.runJavaScript('''
      (function() {
        // --- 1. Automatic Toloka Auth Page Customization & Auto-Click ---
        if ($isTolokaAuth) {
          let attempts = 0;
          const intervalId = setInterval(() => {
            attempts++;
            if (attempts > 50) {
              clearInterval(intervalId);
              try { NemuChannel.postMessage('customization_applied'); } catch(e){}
              return;
            }

            // Target Microsoft button directly using data-testid, fallback to text search
            let msBtn = document.querySelector('[data-testid="auth-button-ms"]');
            if (!msBtn) {
              const buttons = Array.from(document.querySelectorAll('button'));
              msBtn = buttons.find(b => b.textContent && b.textContent.includes('Microsoft'));
            }

            if (msBtn && msBtn.classList.contains('styled-done')) {
              clearInterval(intervalId);
              try { NemuChannel.postMessage('customization_applied'); } catch(e){}
              return;
            }

            if (msBtn && !msBtn.classList.contains('styled-done')) {
              msBtn.classList.add('styled-done');
              clearInterval(intervalId); // Stop polling

              // Accept cookies automatically if banner exists
              const cookieButtons = Array.from(document.querySelectorAll('button'));
              const acceptBtn = cookieButtons.find(b => b.textContent && (b.textContent.includes('Accept all') || b.textContent.includes('قبول الكل')));
              if (acceptBtn) {
                try { acceptBtn.click(); } catch(e){}
              }

              // Inject styling rules to completely sanitize the body and layout
              const style = document.createElement('style');
              style.innerHTML = `
                body {
                  background: #121212 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  display: flex !important;
                  justify-content: center !important;
                  align-items: center !important;
                  height: 100vh !important;
                  width: 100vw !important;
                  overflow: hidden !important;
                }
                /* Hide all elements on the page except the Microsoft button container */
                body > *:not(.keep-container) {
                  display: none !important;
                }
                #app {
                  display: flex !important;
                  justify-content: center !important;
                  align-items: center !important;
                  width: 100% !important;
                  height: 100% !important;
                }
              `;
              document.head.appendChild(style);

              // Add container class to msBtn parents up to body to keep them visible
              let current = msBtn;
              while (current && current !== document.body) {
                current.classList.add('keep-container');
                current.style.setProperty('background', 'transparent', 'important');
                current.style.setProperty('border', 'none', 'important');
                current.style.setProperty('box-shadow', 'none', 'important');
                current.style.setProperty('padding', '0', 'important');
                current.style.setProperty('margin', '0', 'important');
                current.style.setProperty('display', 'flex', 'important');
                current.style.setProperty('justify-content', 'center', 'important');
                current.style.setProperty('align-items', 'center', 'important');
                current.style.setProperty('width', '100%', 'important');
                current = current.parentElement;
              }

              // Hide other sibling providers inside the ul list
              const listItems = document.querySelectorAll('ul li');
              listItems.forEach(li => {
                if (!li.contains(msBtn)) {
                  li.style.setProperty('display', 'none', 'important');
                }
              });

              // Hide logo, titles, subtitle, footer, and side image
              const selectorsToHide = [
                '[data-cookiebannerviewer="true"]',
                '.header--fac119104e',
                '.title--f11eab5617',
                '.text--cffb4ba77c',
                '.footer--e1767bf037',
                '.image-wrap--e39dcfb3a0'
              ];
              selectorsToHide.forEach(sel => {
                const el = document.querySelector(sel);
                if (el) el.style.setProperty('display', 'none', 'important');
              });

              // Style the Microsoft button to look premium and native
              msBtn.style.setProperty('display', 'flex', 'important');
              msBtn.style.setProperty('align-items', 'center', 'important');
              msBtn.style.setProperty('justify-content', 'center', 'important');
              msBtn.style.setProperty('gap', '12px', 'important');
              msBtn.style.setProperty('background', '#2F2F2F', 'important');
              msBtn.style.setProperty('color', '#FFFFFF', 'important');
              msBtn.style.setProperty('border', '1px solid rgba(255,255,255,0.15)', 'important');
              msBtn.style.setProperty('padding', '16px 32px', 'important');
              msBtn.style.setProperty('border-radius', '16px', 'important');
              msBtn.style.setProperty('font-size', '16px', 'important');
              msBtn.style.setProperty('font-weight', '600', 'important');
              msBtn.style.setProperty('width', '90vw', 'important');
              msBtn.style.setProperty('max-width', '340px', 'important');
              msBtn.style.setProperty('height', '58px', 'important');
              msBtn.style.setProperty('box-shadow', '0 8px 24px rgba(0,0,0,0.4)', 'important');

              // Inform Flutter that customization is complete
              try { NemuChannel.postMessage('customization_applied'); } catch(e){}

              // Automatically trigger the click on the Microsoft login button!
              if ('$email' !== '' && '$password' !== '') {
                setTimeout(() => {
                  try { msBtn.click(); } catch(e){}
                }, 1200);
              }
            }
          }, 300);
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
          if (_isLoading && _customizationApplied)
            const Center(
              child: CircularProgressIndicator(),
            ),
          AnimatedOpacity(
            opacity: _customizationApplied ? 0.0 : 1.0,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            child: IgnorePointer(
              ignoring: _customizationApplied,
              child: Container(
                color: const Color(0xFF121212),
                child: const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      CircularProgressIndicator(
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.blueAccent),
                      ),
                      SizedBox(height: 16),
                      Text(
                        'Securing connection...',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
