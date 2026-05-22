import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'dart:convert';
import 'package:flutter/services.dart';
import '../../../remote_config/domain/entities/project_config.dart';

class WebViewPage extends StatefulWidget {
  final ProjectConfig config;
  const WebViewPage({super.key, required this.config});

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
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0x00000000))
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

    controller.runJavaScript('''
      (function() {
        if ($isTolokaAuth) {
          // 1. Accept cookies automatically if banner exists
          const cookieButtons = Array.from(document.querySelectorAll('button'));
          const acceptBtn = cookieButtons.find(b => b.textContent && (b.textContent.includes('Accept all') || b.textContent.includes('قبول الكل')));
          if (acceptBtn) {
            try { acceptBtn.click(); } catch(e){}
          }

          // 2. Find Microsoft button
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
          }
        } else {
          // Hide selectors from remote config
          const selectors = [$selectors];
          selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => el.style.display = 'none');
          });

          // Apply Custom JS from remote config
          $customJs
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
