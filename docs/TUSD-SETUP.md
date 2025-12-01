# TUS Server Setup Guide

## Problem: Hooks Directory Lost After Reboot

The TUS server uses `/tmp/tus-hooks/` for the post-finish hook, but `/tmp` is cleared on system reboot. This causes uploads to complete but never be processed by the backend.

## Solution: Auto-create hooks directory on service start

### Update systemd service:

```bash
sudo nano /etc/systemd/system/tusd.service
```

Add these lines under `[Service]`:

```ini
[Unit]
Description=TUS Upload Server
After=network.target

[Service]
Type=simple
User=meno
WorkingDirectory=/var/www/3speak-upload

# Create hooks directory and copy script before starting
# Use + prefix to run as root, otherwise it runs as User=meno
ExecStartPre=+/bin/mkdir -p /tmp/tus-hooks
ExecStartPre=+/bin/cp /var/www/3speak-upload/scripts/post-finish /tmp/tus-hooks/post-finish
ExecStartPre=+/bin/chmod +x /tmp/tus-hooks/post-finish
ExecStartPre=+/bin/chown -R meno:meno /tmp/tus-hooks

ExecStart=/var/www/3speak-upload/tusd_linux_amd64/tusd -upload-dir /tmp/uploads -hooks-dir /tmp/tus-hooks -hooks-enabled-events post-finish -port 1080 -verbose

Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Apply changes:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Restart TUS
sudo systemctl restart tusd

# Verify hooks directory exists
ls -la /tmp/tus-hooks/

# Check service status
sudo systemctl status tusd
```

## Manual Fix (temporary, until next reboot):

```bash
# Create directory
sudo mkdir -p /tmp/tus-hooks

# Copy script
sudo cp /var/www/3speak-upload/scripts/post-finish /tmp/tus-hooks/post-finish

# Make executable
sudo chmod +x /tmp/tus-hooks/post-finish

# Restart TUS
sudo systemctl restart tusd
```

## Verify it's working:

After uploading a test video, check Node.js logs for:

```
📁 TUS callback for username/permlink: /tmp/uploads/xxxxx
⬆️ Uploading to IPFS: /tmp/uploads/xxxxx
```

If you see these, the hook is working!
