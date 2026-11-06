import http.server
import socketserver
import socket
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def get_all_network_ips():
    """Detect all IPv4 addresses on this PC."""
    ips = []
    # 1. Primary outbound adapter
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        s.connect(('8.8.8.8', 80))
        primary = s.getsockname()[0]
        s.close()
        if primary and not primary.startswith('127.'):
            ips.append(primary)
    except Exception:
        pass

    # 2. Hostname resolution
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None):
            ip = info[4][0]
            if ':' not in ip and not ip.startswith('127.') and ip not in ips:
                ips.append(ip)
    except Exception:
        pass

    return ips if ips else ['127.0.0.1']

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

    def log_message(self, format, *args):
        # Print when phone/client connects
        print(f" > Incoming connection from: {self.client_address[0]} ({args[0]})")

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("0.0.0.0", PORT), CustomHandler) as httpd:
            ips = get_all_network_ips()
            print("=" * 60)
            print(f"  Python Server is LISTENING on all interfaces (Port {PORT})")
            print("=" * 60)
            print(f"  [On this PC]      http://localhost:{PORT}/")
            for ip in ips:
                print(f"  [On your phone]   http://{ip}:{PORT}/")
            print("=" * 60)
            print("  Waiting for phone connection (keep this window open)...")
            httpd.serve_forever()
    except OSError as e:
        print(f"\n[ERROR] Could not start server on port {PORT}: {e}")
        print("Tip: Port might already be in use. Check with: netstat -ano | findstr :5000\n")
    except KeyboardInterrupt:
        print("\nShutting down server.")
