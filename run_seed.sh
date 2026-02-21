#!/bin/bash
set -a
source /root/peds/.env.production
set +a
. ~/.nvm/nvm.sh
cd /root/peds
node prisma/seed.js
