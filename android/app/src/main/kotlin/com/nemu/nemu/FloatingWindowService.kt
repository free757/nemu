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

    private var isUnlocked: Boolean = false
    private var currentScreenState: Int = 0 // 0 = Action Menu, 1 = Cabinet (either PIN or Creds)
    private lateinit var panelParams: WindowManager.LayoutParams

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
        // Fullscreen container with translucent dark background dim effect
        panelView = FrameLayout(this).apply {
            visibility = View.GONE
            setBackgroundColor(Color.parseColor("#80000000")) // 50% opacity black backdrop
            
            // Tap outside: Dismiss/hide panel
            setOnClickListener {
                togglePanelVisibility()
            }
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
            
            // Consume clicks inside container so they do not close the cabinet
            setOnTouchListener { _, _ -> true }
            setOnClickListener { /* No-op, consume click */ }
        }

        // Header Title based on screen state
        val headerText = TextView(this).apply {
            text = when {
                currentScreenState == 0 -> "Nemu Quick Menu"
                isUnlocked -> "Credentials Cabinet"
                else -> "Secure Cabinet Locked"
            }
            setTextColor(Color.parseColor("#9CA3AF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, dpToPx(14f))
        }
        container.addView(headerText)

        if (currentScreenState == 0) {
            // RENDER QUICK SELECTION MENU
            
            // 1. Open Nemu App Button
            val openAppBtn = Button(this).apply {
                text = "Open Nemu App"
                setTextColor(Color.WHITE)
                typeface = Typeface.DEFAULT_BOLD
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                
                val bg = GradientDrawable().apply {
                    setColor(Color.parseColor("#1E3A8A")) // Royal Blue
                    cornerRadius = dpToPx(12f).toFloat()
                }
                background = bg
                
                setOnClickListener {
                    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
                    launchIntent?.let {
                        it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(it)
                    }
                    // Close drawer panel
                    panelView?.visibility = View.GONE
                    panelParams.flags = panelParams.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    windowManager.updateViewLayout(panelView, panelParams)
                    currentScreenState = 0
                }
            }
            val openAppParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dpToPx(44f)
            ).apply {
                bottomMargin = dpToPx(12f)
            }
            container.addView(openAppBtn, openAppParams)

            // 2. Open Credentials Cabinet Button
            val openCabinetBtn = Button(this).apply {
                text = "Credentials Cabinet"
                setTextColor(Color.WHITE)
                typeface = Typeface.DEFAULT_BOLD
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                
                val bg = GradientDrawable().apply {
                    setColor(Color.parseColor("#10B981")) // Neon Green
                    cornerRadius = dpToPx(12f).toFloat()
                }
                background = bg
                
                setOnClickListener {
                    currentScreenState = 1
                    updatePanelFields()
                }
            }
            val openCabinetParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dpToPx(44f)
            )
            container.addView(openCabinetBtn, openCabinetParams)

        } else {
            // RENDER CABINET SCREEN (either locked pin input or unlocked fields)
            
            // Back Button
            val backBtn = Button(this).apply {
                text = "← Back to Menu"
                setTextColor(Color.parseColor("#9CA3AF"))
                typeface = Typeface.DEFAULT
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                background = null // flat text button
                setPadding(0, 0, 0, 0)
                
                setOnClickListener {
                    currentScreenState = 0
                    updatePanelFields()
                }
            }
            val backParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.START
                bottomMargin = dpToPx(8f)
            }
            container.addView(backBtn, backParams)

            if (!isUnlocked) {
                // Padlock Icon
                val lockIcon = TextView(this).apply {
                    text = "🔒"
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 32f)
                    gravity = Gravity.CENTER
                    setPadding(0, 0, 0, dpToPx(6f))
                }
                container.addView(lockIcon)

                // Prompt Text
                val promptText = TextView(this).apply {
                    text = "Enter account PIN to unlock credentials"
                    setTextColor(Color.parseColor("#9CA3AF"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                    gravity = Gravity.CENTER
                    setPadding(0, 0, 0, dpToPx(12f))
                }
                container.addView(promptText)

                // Password Pin Input field
                val pinInput = EditText(this).apply {
                    inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
                    gravity = Gravity.CENTER
                    setTextColor(Color.WHITE)
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
                    setHintTextColor(Color.parseColor("#4B5563"))
                    hint = "••••"
                    filters = arrayOf(android.text.InputFilter.LengthFilter(8))
                    setPadding(0, dpToPx(10f), 0, dpToPx(10f))
                    
                    val editBg = GradientDrawable().apply {
                        setColor(Color.parseColor("#131316"))
                        cornerRadius = dpToPx(12f).toFloat()
                        setStroke(dpToPx(1f), Color.parseColor("#44FFFFFF"))
                    }
                    background = editBg
                }
                val inputParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dpToPx(12f)
                }
                container.addView(pinInput, inputParams)

                // Unlock Button
                val unlockBtn = Button(this).apply {
                    text = "Unlock Cabinet"
                    setTextColor(Color.WHITE)
                    typeface = Typeface.DEFAULT_BOLD
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                    
                    val shapeDrawable = GradientDrawable().apply {
                        setColor(Color.parseColor("#2563EB")) // Royal blue
                        cornerRadius = dpToPx(12f).toFloat()
                    }
                    background = shapeDrawable
                    
                    setOnClickListener {
                        val input = pinInput.text.toString().trim()
                        if (input == "1010") {
                            isUnlocked = true
                            Toast.makeText(context, "Access Granted!", Toast.LENGTH_SHORT).show()
                            updatePanelFields() // Rebuilds the fields with credentials displayed
                        } else {
                            Toast.makeText(context, "Incorrect PIN. Access Denied!", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                val unlockBtnParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dpToPx(44f)
                )
                container.addView(unlockBtn, unlockBtnParams)
            } else {
                // Render Cabinet Fields
                val emailSection = createFieldSection("Email", emailStr)
                val passSection = createFieldSection("Password", passwordStr)
                val codeSection = createFieldSection("Verification Code", codeStr)

                container.addView(emailSection)
                container.addView(passSection)
                container.addView(codeSection)
            }
        }

        // Red Dismiss Overlay Button (Simply closes panel/drawer, KEEPS bubble button visible)
        val closeBtn = Button(this).apply {
            text = "Dismiss Overlay"
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            
            val shapeDrawable = GradientDrawable().apply {
                setColor(Color.parseColor("#EF4444")) // Red warning close button color
                cornerRadius = dpToPx(12f).toFloat()
            }
            background = shapeDrawable
            
            setOnClickListener {
                togglePanelVisibility()
            }
        }
        val btnParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dpToPx(44f)
        ).apply {
            topMargin = dpToPx(12f)
        }
        container.addView(closeBtn, btnParams)

        // Center layout inside the full-screen backdrop panelView
        val containerParams = FrameLayout.LayoutParams(
            dpToPx(290f),
            FrameLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.CENTER
        }
        panelView?.addView(container, containerParams)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        // Fullscreen overlay matches screen bounds
        panelParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        )

        windowManager.addView(panelView, panelParams)
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
            try {
                windowManager.removeView(it)
            } catch (e: Exception) {}
            createPanel()
            // Make sure the newly replaced panel is visible
            panelView?.visibility = View.VISIBLE
            // If we are in PIN entry screen, make it focusable. If menu or unlocked, let it be not focusable
            if (currentScreenState == 1 && !isUnlocked) {
                panelParams.flags = panelParams.flags and WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE.inv()
            } else {
                panelParams.flags = panelParams.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
            }
            windowManager.updateViewLayout(panelView, panelParams)
        }
    }

    private fun togglePanelVisibility() {
        panelView?.let { panel ->
            if (panel.visibility == View.VISIBLE) {
                panel.visibility = View.GONE
                // Reset state to menu on close
                currentScreenState = 0
                updatePanelFields()
                
                // Make panel not focusable so keyboard disappears
                panelParams.flags = panelParams.flags or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                windowManager.updateViewLayout(panel, panelParams)
            } else {
                panel.visibility = View.VISIBLE
                // Reset to menu on open
                currentScreenState = 0
                updatePanelFields()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
        bubbleView?.let { try { windowManager.removeView(it) } catch (e: Exception) {} }
        panelView?.let { try { windowManager.removeView(it) } catch (e: Exception) {} }
    }
}
