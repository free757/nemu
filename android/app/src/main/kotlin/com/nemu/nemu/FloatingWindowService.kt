package com.nemu.nemu

import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.util.TypedValue
import android.view.*
import android.widget.*

class FloatingWindowService : Service() {

    private lateinit var windowManager: WindowManager
    private var bubbleView: FrameLayout? = null
    private var panelView: FrameLayout? = null

    private var emailStr: String = ""
    private var passwordStr: String = ""
    private var codeStr: String = ""
    private var proxyStatus: String = "inactive"

    companion object {
        var instance: FloatingWindowService? = null
        
        fun updateStatus(status: String) {
            instance?.let { service ->
                service.proxyStatus = status
                service.updateBubbleIndicator()
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        intent?.let {
            emailStr = it.getStringExtra("email") ?: ""
            passwordStr = it.getStringExtra("password") ?: ""
            codeStr = it.getStringExtra("code") ?: ""
            proxyStatus = it.getStringExtra("proxy_status") ?: "inactive"
        }

        if (bubbleView == null) {
            createBubble()
            createPanel()
        } else {
            updateBubbleIndicator()
            updatePanelFields()
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

        // Main text "N" inside bubble
        val textView = TextView(this).apply {
            text = "N"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
        }
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
                        if (lastAction == MotionEvent.ACTION_DOWN) {
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
        panelView = FrameLayout(this).apply {
            visibility = View.GONE
        }

        // Dynamic glassmorphic background for drawer panel
        val panelBg = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dpToPx(24f).toFloat()
            setColor(Color.parseColor("#F218181C")) // Deep translucent dark theme
            setStroke(dpToPx(1f), Color.parseColor("#33FFFFFF")) // Elegant frosted border
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = panelBg
            setPadding(dpToPx(20f), dpToPx(20f), dpToPx(20f), dpToPx(20f))
        }

        // Title text header
        val headerText = TextView(this).apply {
            text = "Nemu Quick Cabinet"
            setTextColor(Color.parseColor("#9CA3AF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dpToPx(14f))
        }
        container.addView(headerText)

        // Email, Password, Code sections
        val emailSection = createFieldSection("Email", emailStr)
        val passSection = createFieldSection("Password", passwordStr)
        val codeSection = createFieldSection("Verification Code", codeStr)

        container.addView(emailSection)
        container.addView(passSection)
        container.addView(codeSection)

        // Red Close Button
        val closeBtn = Button(this).apply {
            text = "Dismiss Overlay"
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            
            val shapeDrawable = GradientDrawable().apply {
                setColor(Color.parseColor("#EF4444"))
                cornerRadius = dpToPx(12f).toFloat()
            }
            background = shapeDrawable
            
            setOnClickListener {
                stopSelf()
            }
        }
        val btnParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dpToPx(44f)
        ).apply {
            topMargin = dpToPx(12f)
        }
        container.addView(closeBtn, btnParams)

        panelView?.addView(container)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            dpToPx(290f),
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
        }

        windowManager.addView(panelView, params)
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
        panelView?.let {
            windowManager.removeView(it)
            createPanel()
        }
    }

    private fun togglePanelVisibility() {
        panelView?.let { panel ->
            if (panel.visibility == View.VISIBLE) {
                panel.visibility = View.GONE
            } else {
                panel.visibility = View.VISIBLE
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        bubbleView?.let { windowManager.removeView(it) }
        panelView?.let { windowManager.removeView(it) }
    }
}
