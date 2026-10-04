import sys
import time
import re
import urllib.request
import urllib.error
import subprocess
import webbrowser
import os

def check_service(name: str, url: str, timeout_seconds: int = 30) -> bool:
    print(f"[*] Verifying {name} on {url} ...", end="", flush=True)
    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "CrisisCommand-HealthCheck/1.0"}
            )
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status in (200, 304, 404):  # server is up and listening
                    print(" [READY]")
                    return True
        except (urllib.error.HTTPError, urllib.error.URLError, ConnectionRefusedError, OSError):
            pass
        time.sleep(1)
        print(".", end="", flush=True)
    
    print(" [FAILED]")
    return False

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "full"

    if mode == "check-backend":
        if not check_service("Backend (FastAPI)", "http://127.0.0.1:8000/health", 30):
            print("\n[ERROR] Backend failed to respond on http://127.0.0.1:8000/health")
            print("Please check the 'Crisis Command - Backend' terminal window for details.")
            sys.exit(1)
        sys.exit(0)

    if mode == "check-frontend":
        if not check_service("Frontend (Vite)", "http://127.0.0.1:5173", 30):
            print("\n[ERROR] Frontend failed to respond on http://127.0.0.1:5173")
            print("Please check the 'Crisis Command - Frontend' terminal window for details.")
            sys.exit(1)
        sys.exit(0)

    if mode == "open-browser":
        try:
            webbrowser.open("http://127.0.0.1:5173")
        except Exception:
            pass
        sys.exit(0)

    if mode == "start-tunnel":
        print("[*] Starting Cloudflare Tunnel for port 5173...")
        cmd = ["cloudflared", "tunnel", "--url", "http://127.0.0.1:5173"]
        
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )

        tunnel_url = None
        url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
        start_time = time.time()

        # Read stderr line-by-line where cloudflared logs the tunnel URL
        while time.time() - start_time < 35:
            line = proc.stderr.readline()
            if not line and proc.poll() is not None:
                break
            if line:
                match = url_pattern.search(line)
                if match:
                    tunnel_url = match.group(0)
                    break
        
        if not tunnel_url:
            print("\n[ERROR] Failed to obtain trycloudflare.com tunnel URL.")
            print("Please verify that cloudflared has internet access and try again.")
            proc.terminate()
            sys.exit(1)

        banner = f"""
========================================
 CRISIS COMMAND STARTED
========================================
 Backend:
 http://127.0.0.1:8000

 Frontend:
 http://127.0.0.1:5173

 Cloudflare:
 {tunnel_url}

 Open the Cloudflare URL on another device.
========================================
"""
        print(banner)
        print("[*] Cloudflare Tunnel is active. Keep this window open.")
        print("[*] Press Ctrl+C in this terminal to stop the Cloudflare Tunnel.\n")

        try:
            while proc.poll() is None:
                line = proc.stderr.readline()
                if line and "error" in line.lower():
                    print(line.strip(), flush=True)
                time.sleep(0.5)
        except KeyboardInterrupt:
            print("\nStopping Cloudflare Tunnel...")
            proc.terminate()
            proc.wait()
            print("Cloudflare Tunnel stopped.")

if __name__ == "__main__":
    main()
