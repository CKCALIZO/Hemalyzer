# Gunicorn configuration for Render deployment
# Optimized for ML workloads with longer processing times

import multiprocessing
import os

# Bind to the PORT environment variable (Render requirement)
bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"

# Worker configuration
workers = int(os.environ.get('WEB_CONCURRENCY', 1))  # Render sets this based on instance size
worker_class = 'sync'
worker_connections = 1000

# Timeout configuration
# IMPORTANT: ML model inference can take time, especially on CPU
# Default is 30s, we increase to 5 minutes for classification + disease analysis
timeout = 300  # 5 minutes
graceful_timeout = 30
keepalive = 5

# Logging
accesslog = '-'  # Log to stdout
errorlog = '-'   # Log to stderr
loglevel = 'info'
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# SSL (not used on Render, but good to have for local testing)
keyfile = None
certfile = None

print(f"[Gunicorn] Starting with {workers} worker(s)")
print(f"[Gunicorn] Timeout set to {timeout}s for ML workloads")
print(f"[Gunicorn] Binding to {bind}")
