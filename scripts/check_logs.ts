
import { whatsapp } from '../lib/whatsapp'

async function main() {
    const logs = await whatsapp.adminLogs(200)
    console.log(JSON.stringify(logs, null, 2))
}

main().catch(console.error)
