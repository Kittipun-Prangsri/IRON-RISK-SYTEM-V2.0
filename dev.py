import http.server
import socketserver
import webbrowser
import threading
import time
import os
import re

PORT = 8001

class GASLocalHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Serve Index.html when the root or Index.html is requested
        path = self.path.strip('/')
        if not path or path.split('?')[0] == 'Index.html':
            index_path = os.path.join('src', 'Index.html')
            if os.path.exists(index_path):
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.end_headers()
                
                with open(index_path, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                
                # Resolve include('xxx') template tags
                def resolve_include(match):
                    filename = match.group(1)
                    candidates = [
                        os.path.join('src', f"{filename}.css"),
                        os.path.join('src', f"{filename}.js"),
                        os.path.join('src', f"{filename}.html"),
                        os.path.join('src', filename)
                    ]
                    for candidate in candidates:
                        if os.path.exists(candidate):
                            with open(candidate, 'r', encoding='utf-8') as cf:
                                content = cf.read()
                            
                            # Wrap in appropriate tags if not already wrapped
                            stripped = content.strip()
                            if candidate.endswith('.css') and not (stripped.startswith('<style>') or stripped.startswith('<link')):
                                content = f"<style>\n{content}\n</style>"
                            elif candidate.endswith('.js') and not stripped.startswith('<script>'):
                                content = f"<script>\n{content}\n</script>"
                            return content
                    return f"<!-- Include failed: {filename} not found -->"
                
                # Replace <?!= include('Filename'); ?>
                processed_html = re.sub(r"<\?!= include\(['\"]([^'\"]+)['\"]\);\s*\?>", resolve_include, html_content)
                self.wfile.write(processed_html.encode('utf-8'))
                return
            else:
                self.send_error(404, "Index.html not found")
                return
        
        return super().do_GET()

def open_browser():
    time.sleep(1)  # Wait for server to boot
    webbrowser.open(f"http://localhost:{PORT}/Index.html")

if __name__ == "__main__":
    # Open default browser in a separate thread
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Run server
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), GASLocalHandler) as httpd:
        print(f"============================================================")
        print(f"🚀 Dev Server started at http://localhost:{PORT}/Index.html")
        print(f"📝 Press Ctrl+C to stop the server")
        print(f"============================================================")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
