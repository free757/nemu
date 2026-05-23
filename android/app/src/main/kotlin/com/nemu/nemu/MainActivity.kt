package com.nemu.nemu

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.annotation.NonNull
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

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
                    val email = call.argument<String>("email") ?: ""
                    val password = call.argument<String>("password") ?: ""
                    val code = call.argument<String>("code") ?: ""
                    val proxyStatus = call.argument<String>("proxy_status") ?: "inactive"

                    val intent = Intent(this, FloatingWindowService::class.java).apply {
                        putExtra("email", email)
                        putExtra("password", password)
                        putExtra("code", code)
                        putExtra("proxy_status", proxyStatus)
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
                else -> {
                    result.notImplemented()
                }
            }
        }
    }
}
