#!/usr/bin/env python3
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error

# =====================================================================
# CONFIGURATION
# =====================================================================
SUPABASE_URL = "https://wliqqvdypzpnmwoegvam.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaXFxdmR5cHpwbm13b2VndmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTg1MDAsImV4cCI6MjA5NDE5NDUwMH0.zAaOnvTsgkrt2_OKSxNYpdSMxHfTKMbUEtv7uePte_g"

# ixBrowser Local API Address (usually port 53200 or 58151)
IXBROWSER_API_URL = "http://127.0.0.1:53200"

# Set to True to automatically close the browser profile after scraping
CLOSE_PROFILES_AFTER_SCRAPING = True

# =====================================================================
# HELPER FUNCTIONS
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

def get_ixbrowser_profiles():
    """Fetches the list of all profiles from local ixBrowser API."""
    url = f"{IXBROWSER_API_URL}/api/v1/profile/list"
    payload = json.dumps({"page": 1, "limit": 100}).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    
    print(f"Connecting to ixBrowser Local API at: {IXBROWSER_API_URL}...")
    status, response = make_request(url, data=payload, headers=headers, method="POST")
    if status == 200:
        res_data = json.loads(response)
        if res_data.get("code") == 0:
            return res_data.get("data", [])
        else:
            print(f"❌ ixBrowser API Error: {res_data.get('message')}")
    else:
        print(f"❌ Failed to connect to ixBrowser Local API (Status: {status}). Please make sure ixBrowser is running and Local API is enabled.")
    return []

def open_ixbrowser_profile(profile_id):
    """Opens a profile and returns its debugging address."""
    url = f"{IXBROWSER_API_URL}/api/v1/profile/open"
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
            print(f"❌ ixBrowser Failed to open profile {profile_id}: {res_data.get('message')}")
    else:
        print(f"❌ HTTP Error opening profile {profile_id}: {status}")
    return None

def close_ixbrowser_profile(profile_id):
    """Closes a profile."""
    url = f"{IXBROWSER_API_URL}/api/v1/profile/close"
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
    else:
        print(f"❌ Failed to fetch users from Supabase: {status} - {response}")
        return []

def update_supabase_user_earnings(user_id, earnings, currently_due):
    """Updates the user row in Supabase with scraped earnings metrics."""
    url = f"{SUPABASE_URL}/rest/v1/app_users?id=eq.{user_id}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # Payload format
    payload = json.dumps({
        "rah_earnings": earnings,
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
# MAIN RUNNER
# =====================================================================
def main():
    print("=" * 70)
    print("🚀 RentAHuman Earnings Sync Script - ixBrowser + Selenium 🚀")
    print("=" * 70)
    
    # 1. Import selenium components
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
    except ImportError:
        print("❌ Selenium library not found. Please install it using: pip install selenium")
        return

    # 2. Get Supabase Users to map profiles
    print("Fetching active users from Supabase...")
    db_users = get_supabase_users()
    if not db_users:
        print("❌ No users found in database. Exiting.")
        return
    print(f"Loaded {len(db_users)} users from database.")
    
    # Create mapping dictionary for email matching
    email_map = {u['email'].strip().lower(): u for u in db_users if u.get('email')}
    
    # 3. Get ixBrowser Profiles
    profiles = get_ixbrowser_profiles()
    if not profiles:
        print("❌ No ixBrowser profiles found or local API service is down.")
        return
    print(f"Found {len(profiles)} profiles in ixBrowser.")
    
    # 4. Scrape loop
    for index, p in enumerate(profiles, 1):
        p_name = p.get("name", "").strip()
        p_id = p.get("profile_id")
        
        print("\n" + "-" * 50)
        print(f"👤 [{index}/{len(profiles)}] Opening Profile: '{p_name}' (ID: {p_id})")
        print("-" * 50)
            
        # Open profile
        open_data = open_ixbrowser_profile(p_id)
        if not open_data:
            print(f"❌ Skipping profile '{p_name}': Could not open via ixBrowser API.")
            continue
            
        debugger_address = open_data.get("debugging_address")
        print(f"Attaching Selenium to debugging address: {debugger_address}...")
        
        driver = None
        try:
            chrome_options = Options()
            chrome_options.add_experimental_option("debuggerAddress", debugger_address)
            driver = webdriver.Chrome(options=chrome_options)
            
            # Step A: Identify the Account by navigating to settings page
            settings_url = "https://rentahuman.ai/account/settings"
            print(f"Navigating to settings to identify account: {settings_url} ...")
            driver.get(settings_url)
            
            # Wait for page load
            time.sleep(5)
            
            # Read settings text
            settings_text = driver.find_element(By.TAG_NAME, "body").text
            
            # Extract email using regex
            email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', settings_text)
            if not email_match:
                print("❌ Failed to find email address on the settings page. Skipping profile.")
                continue
                
            email_found = email_match.group(0).strip().lower()
            print(f"📧 Logged-in RentAHuman Email: {email_found}")
            
            # Match email to database user
            if email_found not in email_map:
                print(f"⚠️ Warning: Email '{email_found}' does not match any user in Supabase. Skipping.")
                continue
                
            target_user = email_map[email_found]
            print(f"✅ Matched to Supabase User: {target_user['username']} (ID: {target_user['id']})")
            
            # Step B: Scrape ongoing metrics
            ongoing_url = "https://rentahuman.ai/account/ongoing"
            print(f"Navigating to ongoing metrics: {ongoing_url} ...")
            driver.get(ongoing_url)
            
            # Wait for page load
            time.sleep(5)
            
            # Read ongoing page text
            ongoing_text = driver.find_element(By.TAG_NAME, "body").text
            
            # Extract values
            metrics = extract_metrics(ongoing_text)
            
            if metrics:
                print("📊 Scraped Metrics:")
                print(f"   • Due Next Payout: ${metrics.get('due_next_payout', 0.0)}")
                print(f"   • Paid to you:     ${metrics.get('paid_to_you', 0.0)}")
                print(f"   • Hours Submitted: {metrics.get('hours_submitted', 0.0)}h")
                print(f"   • Usable Hours:    {metrics.get('usable_hours', 0.0)}h")
                print(f"   • Usability Rate:  {metrics.get('usability_rate', 0.0)}%")
                
                # Update Supabase
                print("Syncing metrics to Supabase...")
                due_val = metrics.get('due_next_payout', 0.0)
                success = update_supabase_user_earnings(target_user['id'], metrics, due_val)
                if success:
                    print(f"🎉 Success! Database synced for user: {target_user['username']}")
                else:
                    print(f"❌ Database update failed for user: {target_user['username']}")
            else:
                print("❌ Failed to parse metrics on the ongoing page.")
                
        except Exception as e:
            print(f"❌ Exception error occurred: {e}")
        finally:
            if driver:
                try:
                    driver.close() # Close current window tab
                except Exception:
                    pass
            
            if CLOSE_PROFILES_AFTER_SCRAPING:
                print("Closing browser profile...")
                close_ixbrowser_profile(p_id)
                
    print("\n" + "=" * 70)
    print("🎉 Sync process completed successfully!")
    print("=" * 70)

if __name__ == "__main__":
    main()
