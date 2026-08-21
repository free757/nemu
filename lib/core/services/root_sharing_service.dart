import 'dart:io';
import 'package:flutter/foundation.dart';

class RootSharingService {
  static final RootSharingService _instance = RootSharingService._internal();
  factory RootSharingService() => _instance;
  RootSharingService._internal();

  bool _isSharing = false;

  bool get isSharing => _isSharing;

  /// Checks if the device is rooted and su is available
  Future<bool> checkRoot() async {
    try {
      final result = await Process.run('which', ['su']);
      if (result.exitCode == 0) {
        return true;
      }
      
      // Fallback check
      final resultSu = await Process.run('su', ['-c', 'id']);
      return resultSu.exitCode == 0;
    } catch (_) {
      return false;
    }
  }

  /// Enables hotspot sharing by forwarding traffic from hotspot interfaces to the VPN interface (tun+)
  Future<bool> enableRootSharing() async {
    if (_isSharing) return true;

    final commands = [
      'sysctl -w net.ipv4.ip_forward=1',

      // ── Clear previous rules to prevent duplicates ──
      'iptables -t nat -D POSTROUTING -o tun+ -j MASQUERADE 2>/dev/null || true',
      'iptables -D FORWARD -i ap+ -o tun+ -j ACCEPT 2>/dev/null || true',
      'iptables -D FORWARD -i wlan+ -o tun+ -j ACCEPT 2>/dev/null || true',
      'iptables -D FORWARD -i rndis+ -o tun+ -j ACCEPT 2>/dev/null || true',
      'iptables -D FORWARD -i tun+ -o ap+ -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true',
      'iptables -D FORWARD -i tun+ -o wlan+ -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true',
      'iptables -D FORWARD -i tun+ -o rndis+ -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true',
      'iptables -t nat -D PREROUTING -i ap+ -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53 2>/dev/null || true',
      'iptables -t nat -D PREROUTING -i wlan+ -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53 2>/dev/null || true',
      'iptables -t nat -D PREROUTING -i rndis+ -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53 2>/dev/null || true',

      // ── Allow hotspot clients to directly reach port 10808 (SOCKS5) and 10809 (HTTP) ──
      'iptables -D INPUT -i ap+ -p tcp --dport 10808 -j ACCEPT 2>/dev/null || true',
      'iptables -D INPUT -i wlan+ -p tcp --dport 10808 -j ACCEPT 2>/dev/null || true',
      'iptables -D INPUT -i rndis+ -p tcp --dport 10808 -j ACCEPT 2>/dev/null || true',
      'iptables -D INPUT -i ap+ -p tcp --dport 10809 -j ACCEPT 2>/dev/null || true',
      'iptables -D INPUT -i wlan+ -p tcp --dport 10809 -j ACCEPT 2>/dev/null || true',
      'iptables -D INPUT -i rndis+ -p tcp --dport 10809 -j ACCEPT 2>/dev/null || true',

      'iptables -I INPUT -i ap+ -p tcp --dport 10808 -j ACCEPT',
      'iptables -I INPUT -i wlan+ -p tcp --dport 10808 -j ACCEPT',
      'iptables -I INPUT -i rndis+ -p tcp --dport 10808 -j ACCEPT',
      'iptables -I INPUT -i ap+ -p tcp --dport 10809 -j ACCEPT',
      'iptables -I INPUT -i wlan+ -p tcp --dport 10809 -j ACCEPT',
      'iptables -I INPUT -i rndis+ -p tcp --dport 10809 -j ACCEPT',

      // ── NAT forwarding: hotspot → tun+ (transparent VPN for non-proxy clients) ──
      'iptables -t nat -I POSTROUTING -o tun+ -j MASQUERADE',
      'iptables -I FORWARD -i ap+ -o tun+ -j ACCEPT',
      'iptables -I FORWARD -i wlan+ -o tun+ -j ACCEPT',
      'iptables -I FORWARD -i rndis+ -o tun+ -j ACCEPT',
      'iptables -I FORWARD -i tun+ -o ap+ -m state --state RELATED,ESTABLISHED -j ACCEPT',
      'iptables -I FORWARD -i tun+ -o wlan+ -m state --state RELATED,ESTABLISHED -j ACCEPT',
      'iptables -I FORWARD -i tun+ -o rndis+ -m state --state RELATED,ESTABLISHED -j ACCEPT',

      // ── Redirect DNS from hotspot clients → Google DNS via VPN ──
      'iptables -t nat -I PREROUTING -i ap+ -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53',
      'iptables -t nat -I PREROUTING -i wlan+ -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53',
      'iptables -t nat -I PREROUTING -i rndis+ -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53',
    ];

    try {
      final joinedCommands = commands.join(' && ');
      debugPrint('[RootSharingService] Executing root commands: $joinedCommands');
      final result = await Process.run('su', ['-c', joinedCommands]);
      
      if (result.exitCode == 0) {
        _isSharing = true;
        debugPrint('[RootSharingService] VPN Hotspot sharing enabled successfully.');
        return true;
      } else {
        debugPrint('[RootSharingService] Failed to enable sharing. stderr: ${result.stderr}');
        return false;
      }
    } catch (e) {
      debugPrint('[RootSharingService] Exception: $e');
      return false;
    }
  }

  /// Disables hotspot sharing and removes the iptables rules
  Future<bool> disableRootSharing() async {
    if (!_isSharing) return true;

    final commands = [
      // ── Remove INPUT rules for port 10808 ──
      'iptables -D INPUT -i ap+ -p tcp --dport 10808 -j ACCEPT 2>/dev/null || true',
      'iptables -D INPUT -i wlan+ -p tcp --dport 10808 -j ACCEPT 2>/dev/null || true',
      'iptables -D INPUT -i rndis+ -p tcp --dport 10808 -j ACCEPT 2>/dev/null || true',
      'iptables -D INPUT -i ap+ -p tcp --dport 10809 -j ACCEPT 2>/dev/null || true',
      'iptables -D INPUT -i wlan+ -p tcp --dport 10809 -j ACCEPT 2>/dev/null || true',
      'iptables -D INPUT -i rndis+ -p tcp --dport 10809 -j ACCEPT 2>/dev/null || true',
      // ── Remove NAT & FORWARD rules ──
      'iptables -t nat -D POSTROUTING -o tun+ -j MASQUERADE 2>/dev/null || true',
      'iptables -D FORWARD -i ap+ -o tun+ -j ACCEPT 2>/dev/null || true',
      'iptables -D FORWARD -i wlan+ -o tun+ -j ACCEPT 2>/dev/null || true',
      'iptables -D FORWARD -i rndis+ -o tun+ -j ACCEPT 2>/dev/null || true',
      'iptables -D FORWARD -i tun+ -o ap+ -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true',
      'iptables -D FORWARD -i tun+ -o wlan+ -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true',
      'iptables -D FORWARD -i tun+ -o rndis+ -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true',
      'iptables -t nat -D PREROUTING -i ap+ -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53 2>/dev/null || true',
      'iptables -t nat -D PREROUTING -i wlan+ -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53 2>/dev/null || true',
      'iptables -t nat -D PREROUTING -i rndis+ -p udp --dport 53 -j DNAT --to-destination 8.8.8.8:53 2>/dev/null || true',
    ];

    try {
      final joinedCommands = commands.join(' && ');
      debugPrint('[RootSharingService] Disabling root commands: $joinedCommands');
      final result = await Process.run('su', ['-c', joinedCommands]);
      
      if (result.exitCode == 0) {
        _isSharing = false;
        debugPrint('[RootSharingService] VPN Hotspot sharing disabled successfully.');
        return true;
      } else {
        debugPrint('[RootSharingService] Failed to disable sharing. stderr: ${result.stderr}');
        return false;
      }
    } catch (e) {
      debugPrint('[RootSharingService] Exception: $e');
      return false;
    }
  }
}
