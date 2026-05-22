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
      debugPrint("Failed to load bot image: \$e");
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
            _applyCustomizations();
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.config.url));
  }

  void _applyCustomizations() {
    final selectors = widget.config.selectorsToHide.map((s) => "'\$s'").join(',');
    final customJs = widget.config.customJs;
    final botImageBase64 = _nemuBotBase64 ?? '';

    controller.runJavaScript('''
      (function() {
        // Hide selectors from remote config
        const selectors = [\$selectors];
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => el.style.display = 'none');
        });

        // Apply Custom JS from remote config
        \$customJs

        // Original Dark Mode logic and other customizations can be added here
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
