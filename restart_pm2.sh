/root/.nvm/versions/node/v22.22.0/bin/pm2 delete peds
cd /root/peds
/root/.nvm/versions/node/v22.22.0/bin/pm2 start npm --name "peds" -- run start
sleep 3
ss -ltnp | grep 3005
/root/.nvm/versions/node/v22.22.0/bin/pm2 save
