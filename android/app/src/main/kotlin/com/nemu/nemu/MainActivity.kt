package com.nemu.nemu

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.annotation.NonNull
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import android.os.PowerManager
import android.net.wifi.WifiManager
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.net.NetworkInterface as JavaNetworkInterface

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.nemu.nemu/overlay"
    private var channel: MethodChannel? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var hotspotReservation: WifiManager.LocalOnlyHotspotReservation? = null

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        val mChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
        this.channel = mChannel
        mChannel.setMethodCallHandler { call, result ->
            when (call.method) {
                "acquireWakeLock" -> {
                    try {
                        if (wakeLock == null) {
                            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
                            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Nemu::ProxyWakeLock")
                            wakeLock?.acquire()
                        }
                        if (wifiLock == null) {
                            val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                            wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "Nemu::ProxyWifiLock")
                            wifiLock?.acquire()
                        }
                        result.success(true)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }
                "releaseWakeLock" -> {
                    try {
                        if (wakeLock?.isHeld == true) {
                            wakeLock?.release()
                        }
                        wakeLock = null
                        if (wifiLock?.isHeld == true) {
                            wifiLock?.release()
                        }
                        wifiLock = null
                        result.success(true)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }
                "checkOverlayPermission" -> {
                    val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        Settings.canDrawOverlays(this)
                    } else {
                        true
                    }
                    result.success(granted)
                }
                "requestOverlayPermission" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        val intent = Intent(
                            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:$packageName")
                        )
                        startActivityForResult(intent, 1234)
                        result.success(true)
                    } else {
                        result.success(true)
                    }
                }
                "showOverlay" -> {
                    val userId = call.argument<String>("userId") ?: ""
                    val email = call.argument<String>("email") ?: ""
                    val password = call.argument<String>("password") ?: ""
                    val code = call.argument<String>("code") ?: ""
                    val proxyStatus = call.argument<String>("proxy_status") ?: "inactive"
                    val miscItems = call.argument<String>("misc_items") ?: "[]"
                    val showOpenAppBtn = call.argument<Boolean>("show_open_app") ?: true
                    val showMiscBtn = call.argument<Boolean>("show_misc") ?: true

                    val intent = Intent(this, FloatingWindowService::class.java).apply {
                        putExtra("userId", userId)
                        putExtra("email", email)
                        putExtra("password", password)
                        putExtra("code", code)
                        putExtra("proxy_status", proxyStatus)
                        putExtra("misc_items", miscItems)
                        putExtra("show_open_app", showOpenAppBtn)
                        putExtra("show_misc", showMiscBtn)
                    }
                    
                    val canDraw = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        Settings.canDrawOverlays(this)
                    } else {
                        true
                    }

                    if (canDraw) {
                        startService(intent)
                        result.success(true)
                    } else {
                        result.success(false)
                    }
                }
                "updateProxyStatus" -> {
                    val status = call.argument<String>("proxy_status") ?: "inactive"
                    FloatingWindowService.updateStatus(status)
                    result.success(true)
                }
                "hideOverlay" -> {
                    val intent = Intent(this, FloatingWindowService::class.java)
                    stopService(intent)
                    result.success(true)
                }
                "downloadAndInstallApk" -> {
                    val url = call.argument<String>("url") ?: ""
                    try {
                        downloadAndInstallApk(url)
                        result.success(true)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }
                "isExternalCameraConnected" -> {
                    val usbManager = getSystemService(Context.USB_SERVICE) as android.hardware.usb.UsbManager
                    val deviceList = usbManager.deviceList
                    var cameraFound = false
                    
                    for (device in deviceList.values) {
                        if (device.deviceClass == 14 || device.deviceClass == 239) {
                            cameraFound = true
                            break
                        }
                        for (i in 0 until device.interfaceCount) {
                            val usbInterface = device.getInterface(i)
                            if (usbInterface.interfaceClass == 14) {
                                cameraFound = true
                                break
                            }
                        }
                    }
                    result.success(cameraFound)
                }
                "openSettings" -> {
                    val intent = Intent(Settings.ACTION_SETTINGS).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    }
                    startActivity(intent)
                    result.success(true)
                }
                "requestIgnoreBatteryOptimizations" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                        val packageName = packageName
                        if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                data = Uri.parse("package:$packageName")
                            }
                            startActivity(intent)
                            result.success(true)
                        } else {
                            result.success(true)
                        }
                    } else {
                        result.success(true)
                    }
                }
                "getHotspotIP" -> {
                    result.success(getHotspotIP())
                }
                "getNetworkTraffic" -> {
                    val totalRx = android.net.TrafficStats.getTotalRxBytes()
                    val totalTx = android.net.TrafficStats.getTotalTxBytes()
                    val trafficMap = mapOf(
                        "rxBytes" to totalRx,
                        "txBytes" to totalTx
                    )
                    result.success(trafficMap)
                }
                "getConnectedHotspotDevicesCount" -> {
                    result.success(getConnectedHotspotDevicesCount())
                }
                "startStrictHotspot" -> {
                    startStrictHotspot(result)
                }
                "stopStrictHotspot" -> {
                    stopStrictHotspot(result)
                }
                "isStrictHotspotRunning" -> {
                    result.success(hotspotReservation != null)
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }

    /**
     * Uses Java's NetworkInterface (better Android visibility than Dart's)
     * to find the hotspot gateway IP — excludes loopback, VPN/tun, mobile data.
     */
    private fun getHotspotIP(): String {
        val excludeIfaceNames = listOf("tun", "vpn", "ppp", "dummy", "lo", "rmnet", "ccmni", "docker")
        val excludeSubnets = listOf("127.", "26.26.", "10.0.2.") // loopback + emulator + VPN

        fun isVpnRange(ip: String): Boolean {
            if (ip.startsWith("127.")) return true
            if (ip.startsWith("100.")) return true  // CGNAT / Tailscale
            val parts = ip.split(".")
            if (parts.size == 4 && parts[0] == "172") {
                val second = parts[1].toIntOrNull() ?: 0
                if (second in 16..31) return true  // Docker / V2Ray tun
            }
            return excludeSubnets.any { ip.startsWith(it) }
        }

        fun isHomeWifi(ip: String) =
            ip.startsWith("192.168.0.") || ip.startsWith("192.168.1.") || ip.startsWith("192.168.2.")

        fun isExcluded(name: String) = excludeIfaceNames.any { name.lowercase().contains(it) }

        try {
            val ifaces = JavaNetworkInterface.getNetworkInterfaces()?.toList() ?: emptyList()

            android.util.Log.d("HotspotIP/Kotlin", "All interfaces:")
            for (iface in ifaces) {
                for (addr in iface.inetAddresses.toList()) {
                    if (addr is java.net.Inet4Address && !addr.isLoopbackAddress) {
                        android.util.Log.d("HotspotIP/Kotlin", "  ${iface.name} → ${addr.hostAddress}")
                    }
                }
            }

            // Priority 1: Named hotspot interfaces (like ap0, swlan, softap)
            val hotspotNames = listOf("ap", "swlan", "softap", "wlan1", "hotspot", "p2p-wlan")
            for (iface in ifaces) {
                if (isExcluded(iface.name)) continue
                if (hotspotNames.none { iface.name.lowercase().contains(it) }) continue
                for (addr in iface.inetAddresses.toList()) {
                    if (addr is java.net.Inet4Address && !addr.isLoopbackAddress) {
                        val ip = addr.hostAddress ?: continue
                        return ip
                    }
                }
            }

            // Priority 2: Non-home, non-VPN subnet
            for (iface in ifaces) {
                if (isExcluded(iface.name)) continue
                for (addr in iface.inetAddresses.toList()) {
                    if (addr is java.net.Inet4Address && !addr.isLoopbackAddress) {
                        val ip = addr.hostAddress ?: continue
                        if (!isVpnRange(ip) && !isHomeWifi(ip)) return ip
                    }
                }
            }

            // Priority 3: Any non-VPN IPv4
            for (iface in ifaces) {
                if (isExcluded(iface.name)) continue
                for (addr in iface.inetAddresses.toList()) {
                    if (addr is java.net.Inet4Address && !addr.isLoopbackAddress) {
                        val ip = addr.hostAddress ?: continue
                        if (!isVpnRange(ip)) return ip
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("HotspotIP/Kotlin", "Error: $e")
        }
        return "192.168.43.1"
    }

    private fun getConnectedHotspotDevicesCount(): Int {
        var count = 0
        try {
            // First check if su binary is available before attempting read
            val suExists = java.io.File("/system/bin/su").exists() || java.io.File("/system/xbin/su").exists()
            if (suExists) {
                val process = Runtime.getRuntime().exec(arrayOf("su", "-c", "cat /proc/net/arp"))
                val reader = java.io.BufferedReader(java.io.InputStreamReader(process.inputStream))
                var line: String?
                while (reader.readLine().also { line = it } != null) {
                    val parts = line!!.trim().split("\\s+".toRegex())
                    if (parts.size >= 4 && !line!!.startsWith("IP")) {
                        val flags = parts[2]
                        val mac = parts[3]
                        if (flags != "0x0" && mac != "00:00:00:00:00:00") {
                            count++
                        }
                    }
                }
                process.waitFor()
            }
        } catch (_: Exception) {}
        return count
    }

    private fun downloadAndInstallApk(urlStr: String) {
        val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val uri = Uri.parse(urlStr)
        val request = DownloadManager.Request(uri).apply {
            setTitle("Nemu Update")
            setDescription("Downloading Nemu update...")
            setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "nemu-update.apk")
            setAllowedOverMetered(true)
            setAllowedOverRoaming(true)
        }

        // Delete existing file if present to avoid duplicate suffixes (e.g., nemu-update-1.apk)
        val downloadsFolder = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        val file = File(downloadsFolder, "nemu-update.apk")
        if (file.exists()) {
            file.delete()
        }

        val downloadId = downloadManager.enqueue(request)

        val handler = android.os.Handler(android.os.Looper.getMainLooper())
        val progressRunnable = object : Runnable {
            override fun run() {
                val query = DownloadManager.Query().setFilterById(downloadId)
                val cursor = downloadManager.query(query)
                if (cursor != null && cursor.moveToFirst()) {
                    val statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                    val bytesDownloadedIndex = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                    val bytesTotalIndex = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)

                    if (statusIndex != -1 && bytesDownloadedIndex != -1 && bytesTotalIndex != -1) {
                        val status = cursor.getInt(statusIndex)
                        val bytesDownloaded = cursor.getInt(bytesDownloadedIndex)
                        val bytesTotal = cursor.getInt(bytesTotalIndex)

                        val progress = if (bytesTotal > 0) {
                            (bytesDownloaded * 100L / bytesTotal).toInt()
                        } else {
                            0
                        }

                        runOnUiThread {
                            channel?.invokeMethod("onDownloadProgress", mapOf(
                                "progress" to progress,
                                "status" to status,
                                "bytesDownloaded" to bytesDownloaded,
                                "bytesTotal" to bytesTotal
                            ))
                        }

                        if (status == DownloadManager.STATUS_SUCCESSFUL || status == DownloadManager.STATUS_FAILED) {
                            cursor.close()
                            return
                        }
                    }
                }
                cursor?.close()
                handler.postDelayed(this, 500)
            }
        }
        handler.post(progressRunnable)

        // Register receiver to listen for download completion
        val onComplete = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
                if (id == downloadId) {
                    installApk(context, file)
                    context.unregisterReceiver(this)
                }
            }
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(onComplete, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(onComplete, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE))
        }
    }

    private fun installApk(context: Context, file: File) {
        if (!file.exists()) return

        val intent = Intent(Intent.ACTION_VIEW).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val apkUri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive")
        } else {
            @Suppress("DEPRECATION")
            intent.setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive")
        }

        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun startStrictHotspot(result: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (checkSelfPermission(android.Manifest.permission.NEARBY_WIFI_DEVICES) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(arrayOf(android.Manifest.permission.NEARBY_WIFI_DEVICES, android.Manifest.permission.ACCESS_FINE_LOCATION), 7788)
                        result.success(mapOf("success" to false, "error" to "يرجى الموافقة على إذن الأجهزة القريبة (Nearby Devices)"))
                        return
                    }
                } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(arrayOf(android.Manifest.permission.ACCESS_FINE_LOCATION), 7788)
                        result.success(mapOf("success" to false, "error" to "يرجى الموافقة على إذن الموقع"))
                        return
                    }
                }

                if (hotspotReservation != null) {
                    try {
                        hotspotReservation?.close()
                    } catch (e: Exception) {}
                    hotspotReservation = null
                }

                android.util.Log.d("StrictHotspot", "Starting local-only hotspot...")
                val wifiManager = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                wifiManager.startLocalOnlyHotspot(object : WifiManager.LocalOnlyHotspotCallback() {
                    override fun onStarted(reservation: WifiManager.LocalOnlyHotspotReservation) {
                        super.onStarted(reservation)
                        android.util.Log.d("StrictHotspot", "Hotspot onStarted called successfully!")
                        hotspotReservation = reservation
                        val config = reservation.wifiConfiguration
                        val ssid = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            reservation.softApConfiguration?.ssid ?: config?.SSID ?: "NemuStrictHotspot"
                        } else {
                            config?.SSID ?: "NemuStrictHotspot"
                        }
                        val password = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            reservation.softApConfiguration?.passphrase ?: config?.preSharedKey ?: ""
                        } else {
                            config?.preSharedKey ?: ""
                        }
                        android.util.Log.d("StrictHotspot", "SSID: $ssid, Pass: $password")
                        val responseMap = mapOf(
                            "success" to true,
                            "ssid" to ssid,
                            "password" to password,
                            "ip" to getHotspotIP()
                        )
                        result.success(responseMap)
                    }

                    override fun onFailed(reason: Int) {
                        super.onFailed(reason)
                        android.util.Log.e("StrictHotspot", "Failed with reason code: $reason")
                        result.success(mapOf("success" to false, "error" to "Failed reason code: $reason"))
                    }

                    override fun onStopped() {
                        super.onStopped()
                        android.util.Log.d("StrictHotspot", "Hotspot onStopped called")
                        hotspotReservation = null
                    }
                }, android.os.Handler(android.os.Looper.getMainLooper()))
            } catch (e: Exception) {
                android.util.Log.e("StrictHotspot", "Exception starting hotspot: $e")
                result.success(mapOf("success" to false, "error" to e.message))
            }
        } else {
            result.success(mapOf("success" to false, "error" to "Android 8.0+ required for Strict Hotspot"))
        }
    }

    private fun stopStrictHotspot(result: MethodChannel.Result) {
        try {
            hotspotReservation?.close()
            hotspotReservation = null
            result.success(true)
        } catch (e: Exception) {
            result.success(false)
        }
    }
}
