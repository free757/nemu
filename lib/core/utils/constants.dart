class AppConstants {
  // App Version
  static const String appVersion = '1.0.39+42';

  // Remote Config Keys
  static const String appUpdateConfigKey = 'app_update';
  static const String projectsConfigKey = 'projects';
  static const String appUsersTable = 'app_users';
  static const String remoteConfigsTable = 'remote_configs';

  // Cloudflare Proxy & VLESS Network Architecture
  static const String workerHost = 'nemu-proxy.free75711.workers.dev';
  static const String workerIP = '172.67.207.164';
  static const String vlessUUID = 'd342d11e-d424-4583-b36e-524ab1f0ade3';
  static const int localSocksPort = 10808;
  static const int localHttpPort = 10809;
  static const String defaultHotspotFallbackIp = '192.168.43.1';
  static const String proxyOnlyRemark = 'Nemu Proxy';

  // External Endpoints & Services
  static const String supabaseUrl = 'https://wliqqvdypzpnmwoegvam.supabase.co';
  static const String rentAHumanApiUrl = 'https://rentahuman.ai/api';
  static const String githubReleaseBaseUrl = 'https://github.com/free757/nemu/releases/download';

  // Security Endpoints
  static const String ipWhoIsUrl = 'https://ipwho.is/';
  static const String ipApiUrl = 'http://ip-api.com/json/?fields=status,country,countryCode,regionName,city,timezone,offset,query';
  static const String ipApiCoUrl = 'https://ipapi.co/json/';

  // DNS Resolvers
  static const String primaryDns = '1.1.1.1';
  static const String secondaryDns = '8.8.8.8';

  // Timeouts & Durations
  static const Duration networkTimeout = Duration(milliseconds: 2500);
  static const Duration vpnHandshakeDelay = Duration(seconds: 2);
  static const Duration vpnTeardownDelay = Duration(seconds: 1);
  static const Duration fastRetryDelay = Duration(milliseconds: 600);
}
