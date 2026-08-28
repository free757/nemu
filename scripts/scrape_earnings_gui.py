#!/usr/bin/env python3
import json
import os
import re
import sys
import time
import threading
import urllib.request
import urllib.error
import tkinter as tk
from tkinter import scrolledtext

# =====================================================================
# SUPABASE CONFIGURATION
# =====================================================================
SUPABASE_URL = "https://wliqqvdypzpnmwoegvam.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaXFxdmR5cHpwbm13b2VndmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTg1MDAsImV4cCI6MjA5NDE5NDUwMH0.zAaOnvTsgkrt2_OKSxNYpdSMxHfTKMbUEtv7uePte_g"

# =====================================================================
# HELPER FUNCTIONS (API CALLS)
# =====================================================================
def make_request(url, data=None, headers=None, method="GET"):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 0, str(e)

def get_ixbrowser_profiles(api_url):
    """Fetches the list of all profiles from local ixBrowser API."""
    url = f"{api_url}/api/v1/profile/list"
    payload = json.dumps({"page": 1, "limit": 100}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    
    status, response = make_request(url, data=payload, headers=headers, method="POST")
    if status == 200:
        res_data = json.loads(response)
        if res_data.get("code") == 0:
            return res_data.get("data", [])
        else:
            return f"Error: {res_data.get('message')}"
    else:
        return f"HTTP {status} Connection Failed"

def open_ixbrowser_profile(api_url, profile_id):
    """Opens a profile and returns its debugging address."""
    url = f"{api_url}/api/v1/profile/open"
    payload = json.dumps({
        "profile_id": profile_id,
        "cookies_backup": False,
        "load_profile_info_page": False
    }).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    
    status, response = make_request(url, data=payload, headers=headers, method="POST")
    if status == 200:
        res_data = json.loads(response)
        if res_data.get("code") == 0:
            return res_data.get("data")
        else:
            return f"Error: {res_data.get('message')}"
    else:
        return f"HTTP Error {status}"

def close_ixbrowser_profile(api_url, profile_id):
    """Closes a profile."""
    url = f"{api_url}/api/v1/profile/close"
    payload = json.dumps({"profile_id": profile_id}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    make_request(url, data=payload, headers=headers, method="POST")

def get_supabase_users():
    """Fetches all users from Supabase app_users table."""
    url = f"{SUPABASE_URL}/rest/v1/app_users?select=id,username,email"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    status, response = make_request(url, headers=headers, method="GET")
    if status == 200:
        return json.loads(response)
    return None

def get_sync_trigger():
    """Fetches the rentahuman_sync_trigger config row from Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/remote_configs?config_key=eq.rentahuman_sync_trigger"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    status, response = make_request(url, headers=headers, method="GET")
    if status == 200:
        configs = json.loads(response)
        if configs:
            return configs[0]
    return None

def update_sync_trigger_status(status, last_synced=None):
    """Updates the status of rentahuman_sync_trigger in Supabase."""
    trigger = get_sync_trigger()
    if not trigger:
        return False
        
    config_id = trigger["id"]
    url_patch = f"{SUPABASE_URL}/rest/v1/remote_configs?id=eq.{config_id}"
    headers_patch = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    config_value = {"status": status}
    if last_synced:
        config_value["last_synced"] = last_synced
    elif "config_value" in trigger and "last_synced" in trigger["config_value"]:
        config_value["last_synced"] = trigger["config_value"]["last_synced"]
        
    payload = json.dumps({
        "config_value": config_value,
        "updated_at": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }).encode("utf-8")
    status_code, _ = make_request(url_patch, data=payload, headers=headers_patch, method="PATCH")
    return status_code in (200, 201, 204)

def update_supabase_user_earnings(user_id, earnings, currently_due):
    """Updates the user row in Supabase with scraped earnings metrics."""
    url = f"{SUPABASE_URL}/rest/v1/app_users?id=eq.{user_id}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    payload = json.dumps({
        "rah_earnings": earnings,
        "rah_balance": earnings.get("paid_to_you", 0.0),
        "rah_currently_due": currently_due,
        "rah_last_synced": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    }).encode("utf-8")
    
    status, response = make_request(url, data=payload, headers=headers, method="PATCH")
    return status in (200, 201, 204)


def extract_metrics(text):
    """Parses the text of rentahuman ongoing page using regex."""
    due_match = re.search(r'Due next payout\s*\n?\s*\$?\s*([\d\.,]+)', text, re.IGNORECASE)
    paid_match = re.search(r'Paid to you\s*\n?\s*\$?\s*(-?[\d\.,]+)', text, re.IGNORECASE)
    hours_match = re.search(r'Hours submitted\s*\n?\s*([\d\.,]+)\s*h', text, re.IGNORECASE)
    usable_match = re.search(r'Usable hours\s*\n?\s*([\d\.,]+)\s*h', text, re.IGNORECASE)
    rate_match = re.search(r'Usability rate\s*\n?\s*([\d\.,]+)\s*%', text, re.IGNORECASE)

    metrics = {}
    if due_match:
        metrics['due_next_payout'] = float(due_match.group(1).replace(',', ''))
    if paid_match:
        metrics['paid_to_you'] = float(paid_match.group(1).replace(',', ''))
    if hours_match:
        metrics['hours_submitted'] = float(hours_match.group(1).replace(',', ''))
    if usable_match:
        metrics['usable_hours'] = float(usable_match.group(1).replace(',', ''))
    if rate_match:
        metrics['usability_rate'] = float(rate_match.group(1).replace(',', ''))
        
    return metrics

# =====================================================================
# GUI APPLICATION
# =====================================================================
class ScraperGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("RentAHuman Sync Tool")
        self.root.geometry("640x500")
        self.root.configure(bg="#121212")
        self.root.resizable(False, False)
        
        # Header Label
        self.header_label = tk.Label(
            root, 
            text="RentAHuman Sync Tool", 
            font=("Arial", 20, "bold"), 
            bg="#121212", 
            fg="#8b5cf6"
        )
        self.header_label.pack(pady=15)
        
        # Settings Frame
        self.settings_frame = tk.Frame(root, bg="#121212")
        self.settings_frame.pack(pady=10)
        
        # Port Label and Entry
        self.port_label = tk.Label(self.settings_frame, text="ixBrowser Port:", font=("Arial", 11), bg="#121212", fg="#e2e8f0")
        self.port_label.grid(row=0, column=0, padx=5, pady=5, sticky="e")
        
        self.port_entry = tk.Entry(self.settings_frame, font=("Arial", 11), bg="#1e1e1e", fg="#ffffff", insertbackground="white", width=8, bd=1, relief="solid")
        self.port_entry.insert(0, "53200")
        self.port_entry.grid(row=0, column=1, padx=5, pady=5, sticky="w")
        
        # Close Profiles Checkbutton
        self.close_var = tk.BooleanVar(value=True)
        self.close_cb = tk.Checkbutton(
            self.settings_frame, 
            text="Auto-Close Browser Profiles", 
            variable=self.close_var, 
            font=("Arial", 10), 
            bg="#121212", 
            fg="#e2e8f0", 
            activebackground="#121212", 
            activeforeground="#ffffff", 
            selectcolor="#1e1e1e"
        )
        self.close_cb.grid(row=0, column=2, padx=15, pady=5)
        
        # Listener Mode Checkbutton
        self.listener_var = tk.BooleanVar(value=False)
        self.listener_thread_active = False
        self.listener_cb = tk.Checkbutton(
            self.settings_frame, 
            text="تفعيل الاستماع الخلفي / Enable Background Listener", 
            variable=self.listener_var, 
            font=("Arial", 10, "bold"), 
            bg="#121212", 
            fg="#8b5cf6", 
            activebackground="#121212", 
            activeforeground="#a78bfa", 
            selectcolor="#1e1e1e",
            command=self.toggle_listener
        )
        self.listener_cb.grid(row=1, column=0, columnspan=3, padx=15, pady=10)
        
        # Start Button
        self.start_btn = tk.Button(
            root, 
            text="بدء المزامنة / Start Syncing", 
            font=("Arial", 12, "bold"), 
            bg="#8b5cf6", 
            fg="#ffffff", 
            activebackground="#7c3aed", 
            activeforeground="#ffffff", 
            relief="flat", 
            bd=0, 
            width=25, 
            height=2,
            command=self.start_sync_thread
        )
        self.start_btn.pack(pady=10)
        
        # Log Area Label
        self.log_label = tk.Label(root, text="Logs / السجلات:", font=("Arial", 10, "bold"), bg="#121212", fg="#a78bfa")
        self.log_label.pack(anchor="w", padx=20, pady=2)
        
        # Scrolled Text Box for logs
        self.log_area = scrolledtext.ScrolledText(
            root, 
            width=72, 
            height=13, 
            font=("Courier New", 10), 
            bg="#181818", 
            fg="#e2e8f0", 
            bd=1, 
            relief="solid",
            insertbackground="white"
        )
        self.log_area.pack(padx=20, pady=5)
        
        # Status Bar
        self.status_bar = tk.Frame(root, bg="#1a1a1a", height=25)
        self.status_bar.pack(fill="x", side="bottom")
        
        self.status_label = tk.Label(
            self.status_bar, 
            text="Status: Ready / جاهز", 
            font=("Arial", 9), 
            bg="#1a1a1a", 
            fg="#10b981", 
            anchor="w"
        )
        self.status_label.pack(fill="x", padx=10, pady=3)

    def log(self, message):
        """Thread-safe logging to the text box."""
        self.root.after(0, self._log, message)
        
    def _log(self, message):
        self.log_area.insert(tk.END, message + "\n")
        self.log_area.see(tk.END)

    def set_status(self, text, color="#e2e8f0"):
        """Thread-safe status bar update."""
        self.root.after(0, self._set_status, text, color)
        
    def _set_status(self, text, color):
        self.status_label.configure(text=f"Status: {text}", fg=color)

    def enable_button(self):
        """Thread-safe button re-enabling."""
        self.root.after(0, lambda: self.start_btn.configure(state=tk.NORMAL))

    def toggle_listener(self):
        """Toggles the background Supabase trigger listener."""
        if self.listener_var.get():
            self.log("📡 Background Listener Mode enabled. Checking every 5 seconds...")
            self.set_status("Listening... / وضع الاستماع نشط", "#8b5cf6")
            self.listener_thread_active = True
            t = threading.Thread(target=self.poll_supabase_trigger)
            t.daemon = True
            t.start()
        else:
            self.log("🛑 Background Listener Mode disabled.")
            self.set_status("Ready / جاهز", "#10b981")
            self.listener_thread_active = False

    def poll_supabase_trigger(self):
        """Polls Supabase for the rentahuman_sync_trigger status."""
        while self.listener_thread_active:
            try:
                trigger = get_sync_trigger()
                if trigger:
                    config_id = trigger.get("id")
                    config_val = trigger.get("config_value", {})
                    status = config_val.get("status")
                    
                    if status == "requested":
                        self.log("\n🔔 Sync request received from Dashboard!")
                        self.set_status("Triggered remotely... / جاري التشغيل بطلب من لوحة التحكم", "#a78bfa")
                        
                        # Update status to 'running'
                        update_sync_trigger_status("running")
                        
                        # Set button state to disabled
                        self.root.after(0, lambda: self.start_btn.configure(state=tk.DISABLED))
                        
                        # Get configs
                        port_val = self.port_entry.get().strip()
                        api_url = f"http://127.0.0.1:{port_val}"
                        close_profiles = self.close_var.get()
                        
                        # Execute sync in this background thread
                        self.run_sync(api_url, close_profiles)
            except Exception as e:
                self.log(f"⚠️ Listener Error: {e}")
            
            # Sleep in small steps so we can stop the thread quickly
            for _ in range(5):
                if not self.listener_thread_active:
                    break
                time.sleep(1)

    def start_sync_thread(self):
        """Triggers the scraping process in a background thread."""
        self.start_btn.configure(state=tk.DISABLED)
        self.log_area.delete(1.0, tk.END)
        self.set_status("Running... / جاري التشغيل", "#a78bfa")
        
        # Get port value
        port_val = self.port_entry.get().strip()
        api_url = f"http://127.0.0.1:{port_val}"
        close_profiles = self.close_var.get()
        
        t = threading.Thread(target=self.run_sync, args=(api_url, close_profiles))
        t.daemon = True
        t.start()

    def run_sync(self, api_url, close_profiles):
        # 1. Imports inside thread
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.common.by import By
        except ImportError:
            self.log("❌ Selenium library not found. Please install it using: pip3 install selenium")
            self.set_status("Error / خطأ", "#ef4444")
            self.enable_button()
            update_sync_trigger_status("idle")
            return

        try:
            self.log("==========================================================")
            self.log("🔄 Starting RentAHuman Earnings Sync Scraper...")
            self.log("==========================================================")
            
            # 2. Fetch Supabase users
            self.log("Fetching active users from Supabase...")
            db_users = get_supabase_users()
            if db_users is None:
                self.log("❌ Failed to fetch users from Supabase rest API.")
                self.set_status("Supabase Error", "#ef4444")
                self.enable_button()
                update_sync_trigger_status("idle")
                return
                
            self.log(f"Loaded {len(db_users)} users from database.")
            email_map = {u['email'].strip().lower(): u for u in db_users if u.get('email')}
            
            # 3. Fetch ixBrowser profiles
            self.log("Fetching profiles from ixBrowser Local API...")
            profiles = get_ixbrowser_profiles(api_url)
            if isinstance(profiles, str):
                self.log(f"❌ Connection failed: {profiles}")
                self.log("Please ensure ixBrowser client is open and Local API service is running.")
                self.set_status("ixBrowser Offline", "#ef4444")
                self.enable_button()
                update_sync_trigger_status("idle")
                return
                
            if not profiles:
                self.log("❌ No profiles found in ixBrowser.")
                self.set_status("No Profiles Found", "#ef4444")
                self.enable_button()
                update_sync_trigger_status("idle")
                return
                
            self.log(f"Found {len(profiles)} profiles in ixBrowser.")
            
            # 4. Scrape loop
            for index, p in enumerate(profiles, 1):
                p_name = p.get("name", "").strip()
                p_id = p.get("profile_id")
                
                self.log(f"\n👤 [{index}/{len(profiles)}] Opening Profile: '{p_name}' (ID: {p_id})")
                self.set_status(f"Syncing Profile [{index}/{len(profiles)}]: {p_name}...", "#3b82f6")
                
                # Open profile
                open_data = open_ixbrowser_profile(api_url, p_id)
                if isinstance(open_data, str) or not open_data:
                    err_msg = open_data if isinstance(open_data, str) else "Could not open"
                    self.log(f"   ❌ Skipping: {err_msg}")
                    continue
                    
                debugger_address = open_data.get("debugging_address")
                self.log(f"   Attaching Selenium to {debugger_address}...")
                
                driver = None
                try:
                    chrome_options = Options()
                    chrome_options.add_experimental_option("debuggerAddress", debugger_address)
                    driver = webdriver.Chrome(options=chrome_options)
                    
                    # Navigate to Settings first to retrieve logged-in email
                    settings_url = "https://rentahuman.ai/account/settings"
                    self.log("   Identifying RentAHuman email from settings page...")
                    driver.get(settings_url)
                    
                    # Wait 5 seconds for page load
                    time.sleep(5)
                    
                    settings_text = driver.find_element(By.TAG_NAME, "body").text
                    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', settings_text)
                    
                    if not email_match:
                        self.log("   ❌ Error: Failed to find email address on the settings page.")
                        continue
                        
                    email_found = email_match.group(0).strip().lower()
                    self.log(f"   📧 Logged-in Email: {email_found}")
                    
                    if email_found not in email_map:
                        self.log(f"   ⚠️ Warning: Email '{email_found}' does not exist in Supabase database. Skipping.")
                        continue
                        
                    target_user = email_map[email_found]
                    self.log(f"   ✅ Matched Supabase User: {target_user['username']}")
                    
                    # Navigate to ongoing earnings
                    ongoing_url = "https://rentahuman.ai/account/ongoing"
                    self.log("   Reading ongoing statistics page...")
                    driver.get(ongoing_url)
                    
                    # Wait 5 seconds
                    time.sleep(5)
                    
                    ongoing_text = driver.find_element(By.TAG_NAME, "body").text
                    metrics = extract_metrics(ongoing_text)
                    
                    if metrics:
                        self.log("   📊 Scraped Metrics:")
                        self.log(f"      • Due Next Payout: ${metrics.get('due_next_payout', 0.0)}")
                        self.log(f"      • Paid to you:     ${metrics.get('paid_to_you', 0.0)}")
                        self.log(f"      • Hours Submitted: {metrics.get('hours_submitted', 0.0)}h")
                        self.log(f"      • Usable Hours:    {metrics.get('usable_hours', 0.0)}h")
                        self.log(f"      • Usability Rate:  {metrics.get('usability_rate', 0.0)}%")
                        
                        # Update database
                        self.log("   Syncing metrics to Supabase database...")
                        due_val = metrics.get('due_next_payout', 0.0)
                        success = update_supabase_user_earnings(target_user['id'], metrics, due_val)
                        if success:
                            self.log(f"   🎉 Success! Updated user: {target_user['username']}")
                        else:
                            self.log(f"   ❌ Database update failed for user: {target_user['username']}")
                    else:
                        self.log("   ❌ Error: Failed to parse metrics on the ongoing page.")
                        
                except Exception as e:
                    self.log(f"   ❌ Selenium/Scraper error: {e}")
                finally:
                    if driver:
                        try:
                            driver.close()
                        except Exception:
                            pass
                    
                    if close_profiles:
                        self.log("   Closing browser profile...")
                        close_ixbrowser_profile(api_url, p_id)

            self.log("\n==========================================================")
            self.log("🎉 Sync process completed successfully!")
            self.log("==========================================================")
            self.set_status("Finished / اكتملت المزامنة!", "#10b981")
            self.enable_button()
            
            # Reset trigger back to 'idle' with last_synced timestamp
            now_str = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            update_sync_trigger_status("idle", last_synced=now_str)

        except Exception as e:
            self.log(f"\n❌ Unexpected sync error: {e}")
            self.set_status("Error / خطأ", "#ef4444")
            self.enable_button()
            update_sync_trigger_status("idle")

# =====================================================================
# MAIN RUNNER
# =====================================================================
if __name__ == "__main__":
    root = tk.Tk()
    app = ScraperGUI(root)
    root.mainloop()
