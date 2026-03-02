sed -i "s/const currentHost =.*/const currentHost = '127.0.0.1';/g" /root/peds/.next/standalone/server.js || true
/root/.nvm/versions/node/v22.22.0/bin/pm2 restart peds
