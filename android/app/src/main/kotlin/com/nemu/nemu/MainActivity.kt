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
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.nemu.nemu/overlay"

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
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
                else -> {
                    result.notImplemented()
                }
            }
        }
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
}
