#!/bin/bash
set -e

echo "=== Install Fail2ban ==="
apt-get install -y -qq fail2ban

echo "=== Create jail.local ==="
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
ignoreip = 127.0.0.1/8 ::1 212.15.80.178
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 2h
EOF

echo "=== Enable and start Fail2ban ==="
systemctl enable fail2ban
systemctl start fail2ban

echo "=== Fail2ban status ==="
fail2ban-client status
fail2ban-client status sshd

echo "=== DONE ==="
