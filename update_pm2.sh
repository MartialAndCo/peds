cd /root/peds
/root/.nvm/versions/node/v22.22.0/bin/pm2 set peds:PORT 3005
/root/.nvm/versions/node/v22.22.0/bin/pm2 set peds:HOST 127.0.0.1
/root/.nvm/versions/node/v22.22.0/bin/pm2 restart peds --update-env
