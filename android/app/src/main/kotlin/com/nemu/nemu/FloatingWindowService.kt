package com.nemu.nemu

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.IBinder
import android.util.TypedValue
import android.view.*
import android.widget.*
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import java.util.Calendar
import java.util.TimeZone
import java.text.SimpleDateFormat
import java.util.Locale

class FloatingWindowService : Service() {

    companion object {
        private const val CHANNEL_ID = "nemu_overlay_channel"
        private const val NOTIFICATION_ID = 1001

        var instance: FloatingWindowService? = null

        fun updateStatus(status: String) {
            instance?.let { service ->
                service.proxyStatus = status
                service.updateBubbleIndicator()
            }
        }
    }

    private lateinit var windowManager: WindowManager
    private var bubbleView: FrameLayout? = null
    private var bubbleTextView: TextView? = null
    private var panelView: FrameLayout? = null
    private var containerHolder: FrameLayout? = null
 
    private val vpnCheckHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val vpnCheckRunnable = object : Runnable {
        override fun run() {
            checkNativeVpnStatus()
            vpnCheckHandler.postDelayed(this, 3000) // check every 3 seconds
        }
    }

    private val clockHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val clockRunnable = object : Runnable {
        override fun run() {
            updateClockTime()
            clockHandler.postDelayed(this, 5000) // update every 5 seconds for ultimate accuracy
        }
    }

    private var emailStr: String = ""
    private var passwordStr: String = ""
    private var codeStr: String = ""
    private var proxyStatus: String = "inactive"
    private var miscItemsJson: String = "[]"
    private var showOpenAppBtn: Boolean = true
    private var showMiscBtn: Boolean = true

    // 0 = credentials view, 1 = misc list view
    private var currentPanel: Int = 0

    private lateinit var panelParams: WindowManager.LayoutParams


    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        startForegroundWithNotification()
        vpnCheckHandler.post(vpnCheckRunnable)
        clockHandler.post(clockRunnable)
    }

    private fun startForegroundWithNotification() {
        // Create notification channel (required for Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Nemu Floating Overlay",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Nemu overlay is active"
                setShowBadge(false)
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }

        // Launch intent to open the app when notification is tapped
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, pendingFlags)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nemu")
            .setContentText("Floating overlay is active")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.let {
            emailStr = it.getStringExtra("email") ?: ""
            passwordStr = it.getStringExtra("password") ?: ""
            codeStr = it.getStringExtra("code") ?: ""
            proxyStatus = it.getStringExtra("proxy_status") ?: "inactive"
            miscItemsJson = it.getStringExtra("misc_items") ?: "[]"
            showOpenAppBtn = it.getBooleanExtra("show_open_app", true)
            showMiscBtn = it.getBooleanExtra("show_misc", true)
        }

        if (bubbleView == null) {
            createBubble()
            createPanel()
        } else {
            updateBubbleIndicator()
            rebuildPanelLayout()
        }

        return 2 // Service.START_NOTSTICKY
    }

    private fun dpToPx(dp: Float): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp,
            resources.displayMetrics
        ).toInt()
    }

    private fun createBubble() {
        val bubbleSize = dpToPx(60f)
        bubbleView = FrameLayout(this)

        // Perfect circle background with border
        val shape = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor("#1A1A1E")) // Deep dark circle body
        }
        bubbleView?.background = shape

        // Main text clock instead of "N" inside bubble
        val textView = TextView(this).apply {
            text = "--:--"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
        bubbleTextView = textView
        updateClockTime() // set correct Cairo time immediately

        val textParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        bubbleView?.addView(textView, textParams)

        // Setup layouts params for WindowManager
        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            bubbleSize,
            bubbleSize,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 20
            y = 300
        }

        // Apply dynamic indicator color on initialization
        updateBubbleIndicator()

        // Handle touch & drag listeners
        bubbleView?.setOnTouchListener(object : View.OnTouchListener {
            private var lastAction: Int = 0
            private var initialX: Int = 0
            private var initialY: Int = 0
            private var initialTouchX: Float = 0f
            private var initialTouchY: Float = 0f

            override fun onTouch(v: View, event: MotionEvent): Boolean {
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        lastAction = MotionEvent.ACTION_DOWN
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = initialX + (event.rawX - initialTouchX).toInt()
                        params.y = initialY + (event.rawY - initialTouchY).toInt()
                        windowManager.updateViewLayout(bubbleView, params)
                        lastAction = MotionEvent.ACTION_MOVE
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        val diffX = event.rawX - initialTouchX
                        val diffY = event.rawY - initialTouchY
                        val distance = Math.sqrt((diffX * diffX + diffY * diffY).toDouble())
                        
                        if (distance < 10.0) {
                            // Single tap: toggle expanded credentials panel
                            togglePanelVisibility()
                        } else {
                            // Snap to nearest screen edge (left or right)
                            val screenWidth = resources.displayMetrics.widthPixels
                            val middle = screenWidth / 2
                            if (params.x + (bubbleSize / 2) < middle) {
                                params.x = 20
                            } else {
                                params.x = screenWidth - bubbleSize - 20
                            }
                            windowManager.updateViewLayout(bubbleView, params)
                        }
                        return true
                    }
                }
                return false
            }
        })

        windowManager.addView(bubbleView, params)
    }

    private fun updateBubbleIndicator() {
        bubbleView?.let { view ->
            val shape = view.background as? GradientDrawable ?: return
            
            // Border color: Green for connected, Red/Grey for disconnected
            val borderColor = if (proxyStatus == "active") {
                Color.parseColor("#10B981") // Neon green
            } else {
                Color.parseColor("#EF4444") // Vibrant warning red
            }
            
            shape.setStroke(dpToPx(3.5f), borderColor)
            view.background = shape
        }
    }

    private fun createPanel() {
        // Fullscreen container backdrop - Added ONCE to WindowManager
        panelView = FrameLayout(this).apply {
            visibility = View.GONE
            setBackgroundColor(Color.parseColor("#80000000")) // 50% opacity black backdrop
            
            // Tap outside: Dismiss/hide panel
            setOnClickListener {
                togglePanelVisibility()
            }
        }

        // Inner holder which hosts the interactive cabinet box
        containerHolder = FrameLayout(this)
        panelView?.addView(containerHolder, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        // Set layout params for WindowManager
        panelParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )

        windowManager.addView(panelView, panelParams)
        
        // Build initial layout contents
        rebuildPanelLayout()
    }

    private fun rebuildPanelLayout() {
        val holder = containerHolder ?: return
        holder.removeAllViews()

        // Glassmorphic card background
        val panelBg = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dpToPx(24f).toFloat()
            setColor(Color.parseColor("#F218181C"))
            setStroke(dpToPx(1f), Color.parseColor("#33FFFFFF"))
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = panelBg
            setPadding(dpToPx(20f), dpToPx(20f), dpToPx(20f), dpToPx(20f))
            setOnTouchListener { _, _ -> true }
            setOnClickListener { /* consume clicks */ }
        }

        // ── Header ───────────────────────────────────────────────
        val headerText = TextView(this).apply {
            text = "Nemu Credentials"
            setTextColor(Color.parseColor("#9CA3AF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dpToPx(16f))
        }
        container.addView(headerText)

        if (currentPanel == 0) {
            // ── Credentials view ──────────────────────────────────
            container.addView(createFieldSection("Email", emailStr))
            container.addView(createFieldSection("Password", passwordStr))
            container.addView(createFieldSection("Verification Code", codeStr))

            // ── Open Nemu App button ──────────────────────────────
            if (showOpenAppBtn) {
                val openAppBtn = Button(this).apply {
                    text = "Open Nemu App"
                    setTextColor(Color.WHITE)
                    typeface = Typeface.DEFAULT_BOLD
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#1E3A8A"))
                        cornerRadius = dpToPx(12f).toFloat()
                    }
                    setOnClickListener {
                        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
                        launchIntent?.let {
                            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                            startActivity(it)
                        }
                        togglePanelVisibility()
                    }
                }
                container.addView(openAppBtn, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, dpToPx(44f)
                ).apply { topMargin = dpToPx(14f) })
            }

            // ── Misc button ───────────────────────────────────────
            if (showMiscBtn) {
                val miscBtn = Button(this).apply {
                    text = "Misc"
                    setTextColor(Color.WHITE)
                    typeface = Typeface.DEFAULT_BOLD
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#6D28D9")) // Purple
                        cornerRadius = dpToPx(12f).toFloat()
                    }
                    setOnClickListener {
                        currentPanel = 1
                        rebuildPanelLayout()
                    }
                }
                container.addView(miscBtn, LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, dpToPx(44f)
                ).apply { topMargin = dpToPx(8f) })
            }

            // ── Close button ──────────────────────────────────────
            val closeBtn = Button(this).apply {
                text = "Close"
                setTextColor(Color.WHITE)
                typeface = Typeface.DEFAULT_BOLD
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#EF4444"))
                    cornerRadius = dpToPx(12f).toFloat()
                }
                setOnClickListener { togglePanelVisibility() }
            }
            container.addView(closeBtn, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dpToPx(44f)
            ).apply { topMargin = dpToPx(8f) })

        } else {
            // ── Misc list view ────────────────────────────────────

            // Back button
            val backBtn = Button(this).apply {
                text = "\u2190 Back"
                setTextColor(Color.parseColor("#9CA3AF"))
                typeface = Typeface.DEFAULT_BOLD
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                background = null
                setPadding(0, 0, 0, 0)
                setOnClickListener {
                    currentPanel = 0
                    rebuildPanelLayout()
                }
            }
            container.addView(backBtn, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dpToPx(8f) })

            // Parse and render misc items
            try {
                val arr = JSONArray(miscItemsJson)
                if (arr.length() == 0) {
                    val emptyText = TextView(this).apply {
                        text = "No items yet."
                        setTextColor(Color.parseColor("#6B7280"))
                        setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                        gravity = Gravity.CENTER
                        setPadding(0, dpToPx(12f), 0, dpToPx(12f))
                    }
                    container.addView(emptyText)
                } else {
                    for (i in 0 until arr.length()) {
                        val item = arr.getJSONObject(i)
                        val title = item.optString("title", "")
                        val content = item.optString("content", "")
                        container.addView(createMiscRow(title, content))
                    }
                }
            } catch (e: Exception) {
                val errText = TextView(this).apply {
                    text = "Failed to load items."
                    setTextColor(Color.parseColor("#EF4444"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                }
                container.addView(errText)
            }

            // Close button at bottom
            val closeBtn2 = Button(this).apply {
                text = "Close"
                setTextColor(Color.WHITE)
                typeface = Typeface.DEFAULT_BOLD
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#EF4444"))
                    cornerRadius = dpToPx(12f).toFloat()
                }
                setOnClickListener { togglePanelVisibility() }
            }
            container.addView(closeBtn2, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dpToPx(44f)
            ).apply { topMargin = dpToPx(14f) })
        }

        // Centre the card on screen
        holder.addView(
            container,
            FrameLayout.LayoutParams(dpToPx(290f), FrameLayout.LayoutParams.WRAP_CONTENT).apply {
                gravity = Gravity.CENTER
            }
        )
    }

    private fun createFieldSection(title: String, value: String): LinearLayout {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dpToPx(6f), 0, dpToPx(6f))
        }

        val label = TextView(this).apply {
            text = title
            setTextColor(Color.parseColor("#9CA3AF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
        }
        layout.addView(label)

        val horizontal = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        // Value text
        val valueText = TextView(this).apply {
            text = if (value.isEmpty()) "Not Provided" else value
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            typeface = Typeface.MONOSPACE
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        val textParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f)
        horizontal.addView(valueText, textParams)

        // Simple Copy Text overlay
        val copyBtnText = TextView(this).apply {
            text = "COPY"
            setTextColor(Color.parseColor("#3B82F6"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dpToPx(10f), dpToPx(6f), dpToPx(10f), dpToPx(6f))
            
            val bg = GradientDrawable().apply {
                setColor(Color.parseColor("#2563EB").and(0x22FFFFFF))
                cornerRadius = dpToPx(8f).toFloat()
                setStroke(dpToPx(1f), Color.parseColor("#3B82F6"))
            }
            background = bg
            
            setOnClickListener {
                if (value.isNotEmpty()) {
                    val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    val clip = ClipData.newPlainText("Nemu Copy", value)
                    clipboard.setPrimaryClip(clip)
                    Toast.makeText(context, "$title Copied!", Toast.LENGTH_SHORT).show()
                }
            }
        }
        
        horizontal.addView(copyBtnText)
        layout.addView(horizontal)

        return layout
    }

    private fun updatePanelFields() {
        rebuildPanelLayout()
    }

    /** Misc list row: title on the left, purple COPY button on the right (copies content) */
    private fun createMiscRow(title: String, content: String): LinearLayout {
        val wrapper = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dpToPx(8f), 0, dpToPx(8f))
            
            // Make the entire row clickable to copy
            setOnClickListener {
                if (content.isNotEmpty()) {
                    val cb = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cb.setPrimaryClip(ClipData.newPlainText("Nemu Misc", content))
                    Toast.makeText(context, "'$title' copied!", Toast.LENGTH_SHORT).show()
                }
            }
        }

        val titleView = TextView(this).apply {
            text = title
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = Typeface.DEFAULT_BOLD
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        row.addView(titleView, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f))

        val copyBtn = TextView(this).apply {
            text = "COPY"
            setTextColor(Color.parseColor("#A78BFA"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dpToPx(10f), dpToPx(5f), dpToPx(10f), dpToPx(5f))
            background = GradientDrawable().apply {
                setColor(0x336D28D9.toInt())
                cornerRadius = dpToPx(8f).toFloat()
                setStroke(dpToPx(1f), Color.parseColor("#7C3AED"))
            }
        }
        row.addView(copyBtn)
        wrapper.addView(row)

        // Thin divider
        val divider = View(this).apply { setBackgroundColor(Color.parseColor("#1F2937")) }
        wrapper.addView(divider, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 1))

        return wrapper
    }

    private fun togglePanelVisibility() {
        panelView?.let { panel ->
            if (panel.visibility == View.VISIBLE) {
                panel.visibility = View.GONE
                currentPanel = 0  // always reset to credentials on close
                panelParams.flags = panelParams.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                windowManager.updateViewLayout(panel, panelParams)
            } else {
                panel.visibility = View.VISIBLE
                rebuildPanelLayout()
                panelParams.flags = panelParams.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
                windowManager.updateViewLayout(panel, panelParams)
            }
        }
    }


    private fun checkNativeVpnStatus() {
        val active = isVpnActive()
        val newStatus = if (active) "active" else "inactive"
        if (proxyStatus != newStatus) {
            proxyStatus = newStatus
            updateBubbleIndicator()
        }
    }

    private fun isVpnActive(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val activeNetwork = cm.activeNetwork ?: return false
            val capabilities = cm.getNetworkCapabilities(activeNetwork) ?: return false
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
        } else {
            @Suppress("DEPRECATION")
            val networks = cm.allNetworks
            for (network in networks) {
                val capabilities = cm.getNetworkCapabilities(network)
                if (capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
                    return true
                }
            }
            false
        }
    }

    private fun updateClockTime() {
        try {
            val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
            calendar.add(Calendar.HOUR_OF_DAY, 3) // Egypt Time is UTC + 3
            
            val sdf = SimpleDateFormat("h:mm", Locale.US)
            val timeStr = sdf.format(calendar.time)
            
            bubbleTextView?.text = timeStr
        } catch (e: Exception) {
            bubbleTextView?.text = "N"
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        vpnCheckHandler.removeCallbacks(vpnCheckRunnable)
        clockHandler.removeCallbacks(clockRunnable)
        bubbleView?.let { try { windowManager.removeView(it) } catch (e: Exception) {} }
        panelView?.let { try { windowManager.removeView(it) } catch (e: Exception) {} }
    }
}
