import json
import os
import re
import subprocess
import urllib.request
import urllib.error

# Supabase Configuration
SUPABASE_URL = "https://wliqqvdypzpnmwoegvam.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsaXFxdmR5cHpwbm13b2VndmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MTg1MDAsImV4cCI6MjA5NDE5NDUwMH0.zAaOnvTsgkrt2_OKSxNYpdSMxHfTKMbUEtv7uePte_g"

def get_git_info():
    """Parses GitHub Token and Repo Info from local git config safely."""
    try:
        url = subprocess.check_output(["git", "remote", "get-url", "origin"]).decode("utf-8").strip()
        # Pattern to match: https://<token>@github.com/<owner>/<repo>.git
        match = re.search(r"https://([^@]+)@github\.com/([^/]+)/([^.]+)", url)
        if match:
            return match.group(1), match.group(2), match.group(3)
        
        # Try standard github url
        match_std = re.search(r"github\.com/([^/]+)/([^.]+)", url)
        if match_std:
            return None, match_std.group(1), match_std.group(2)
    except Exception:
        pass
    return None, "free757", "nemu"

def make_request(url, data=None, headers=None, method="GET"):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, res.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")
    except Exception as e:
        return 0, str(e)

def update_constants_file(version):
    """Updates AppConstants.appVersion in lib/core/utils/constants.dart"""
    filepath = "lib/core/utils/constants.dart"
    if not os.path.exists(filepath):
        print(f"⚠️ Warning: {filepath} not found. Skipping file version update.")
        return False
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace the version
    updated_content = re.sub(
        r"static const String appVersion = '[^']+';",
        f"static const String appVersion = '{version}';",
        content
    )
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(updated_content)
    print(f"📝 Updated local version in constants.dart to: {version}")
    return True

def main():
    print("=" * 60)
    print("🚀 Nemu Mobile App - In-App Update Automation System 🚀")
    print("=" * 60)
    
    token, owner, repo = get_git_info()
    if not token:
        print("❌ Error: GitHub Token could not be retrieved from git remote config.")
        print("Please ensure your origin remote URL contains your PAT token.")
        return

    # 1. Ask for version
    default_version = "1.0.2+3"
    version_input = input(f"🔹 Enter new App Version [Default: {default_version}]: ").strip()
    new_version = version_input if version_input else default_version

    # 2. Ask for changelog
    print("\n🔹 Enter Changelog (What's new in this version?) [End with empty line]:")
    changelog_lines = []
    while True:
        line = input()
        if not line.strip():
            break
        changelog_lines.append(f"• {line.strip()}")
    
    if not changelog_lines:
        changelog = "• تحسينات عامة وإصلاح لبعض المشاكل التقنية."
    else:
        changelog = "\n".join(changelog_lines)

    # 3. Ask if forced update
    force_input = input("\n🔹 Is this a forced/mandatory update? (y/N): ").strip().lower()
    is_forced = force_input == "y"

    print("\n" + "-" * 50)
    print(f"📝 Summary of the Release:")
    print(f"   • Version: {new_version}")
    print(f"   • Forced: {is_forced}")
    print(f"   • Changelog:\n{changelog}")
    print("-" * 50)
    
    confirm = input("❓ Confirm deployment? (y/N): ").strip().lower()
    if confirm != "y":
        print("❌ Deployment cancelled by user.")
        return

    # Step 1: Update local constants.dart
    update_constants_file(new_version)

    # Step 2: Build Flutter APK
    print("\n🏗️ Building Flutter release APK... (This may take a moment)")
    try:
        subprocess.run(["flutter", "build", "apk", "--release"], check=True)
        print("✅ APK Built successfully!")
    except subprocess.CalledProcessError as e:
        print(f"❌ Error: Flutter build failed: {e}")
        return

    apk_path = "build/app/outputs/flutter-apk/app-release.apk"
    if not os.path.exists(apk_path):
        print(f"❌ Error: APK file not found at {apk_path}")
        return

    apk_size = os.path.getsize(apk_path)
    tag_name = f"v{new_version.split('+')[0]}"

    # Step 3: Create GitHub Release
    print(f"\n🔑 Creating GitHub Release tag {tag_name}...")
    release_data = {
        "tag_name": tag_name,
        "target_commitish": "main",
        "name": f"Release {tag_name}",
        "body": changelog,
        "draft": False,
        "prerelease": False
    }
    
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    }

    status, response_body = make_request(
        f"https://api.github.com/repos/{owner}/{repo}/releases",
        data=json.dumps(release_data).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    release_id = None
    if status == 201:
        release_id = json.loads(response_body)["id"]
        print(f"✅ Created new release! ID: {release_id}")
    elif status == 422:
        print("ℹ️ Release tag already exists. Fetching existing release...")
        status_get, body_get = make_request(
            f"https://api.github.com/repos/{owner}/{repo}/releases/tags/{tag_name}",
            headers=headers,
            method="GET"
        )
        if status_get == 200:
            release = json.loads(body_get)
            release_id = release["id"]
            print(f"✅ Found existing release! ID: {release_id}")
            
            # Delete existing asset with same name if any
            for asset in release.get("assets", []):
                if asset["name"] == "app-release.apk":
                    print(f"🗑️ Deleting old asset {asset['id']}...")
                    make_request(
                        f"https://api.github.com/repos/{owner}/{repo}/releases/assets/{asset['id']}",
                        headers=headers,
                        method="DELETE"
                    )
        else:
            print(f"❌ Failed to fetch existing release: {body_get}")
            return
    else:
        print(f"❌ Failed to create release: {status} - {response_body}")
        return

    # Step 4: Upload APK Asset
    print("\n📤 Uploading APK asset to GitHub Releases (this may take a few seconds)...")
    upload_url = f"https://uploads.github.com/repos/{owner}/{repo}/releases/{release_id}/assets?name=app-release.apk"
    
    with open(apk_path, "rb") as f:
        binary_data = f.read()

    upload_headers = {
        "Authorization": f"token {token}",
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Length": str(apk_size)
    }

    status_up, response_up = make_request(
        upload_url,
        data=binary_data,
        headers=upload_headers,
        method="POST"
    )

    if status_up == 201:
        print("✅ APK Uploaded successfully to GitHub Releases!")
        download_url = f"https://github.com/{owner}/{repo}/releases/download/{tag_name}/app-release.apk"
        print(f"🔗 Direct Download URL: {download_url}")
    else:
        print(f"❌ Failed to upload asset: {status_up} - {response_up}")
        return

    # Step 5: Update Supabase
    print("\n🛢️ Syncing new version and link to Supabase remote_configs...")
    
    supabase_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    config_value = {
        "url": download_url,
        "force": is_forced,
        "version": new_version,
        "changelog": changelog
    }

    update_payload = {
        "config_value": config_value,
        "updated_at": "now()"
    }

    status_db, response_db = make_request(
        f"{SUPABASE_URL}/rest/v1/remote_configs?config_key=eq.app_update",
        data=json.dumps(update_payload).encode("utf-8"),
        headers=supabase_headers,
        method="PATCH"
    )

    if status_db in (200, 204):
        print("\n" + "=" * 60)
        print("🎉 SUCCESS! App deployed and database configuration updated!")
        print("✨ All active users will receive this update instantly on startup.")
        print("=" * 60)
    else:
        print(f"❌ Failed to update Supabase remote_configs: {status_db} - {response_db}")

if __name__ == "__main__":
    main()
