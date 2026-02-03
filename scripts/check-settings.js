const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
p.setting.findFirst().then(s => {
    console.log('Settings keys:', Object.keys(s || {}))
    console.log('venice_api_key exists:', !!s?.venice_api_key)
    if (s?.venice_api_key) console.log('Key prefix:', s.venice_api_key.substring(0, 15) + '...')
    p.$disconnect()
}).catch(e => { console.error(e); p.$disconnect() })
