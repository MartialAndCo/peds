const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Checking column types for table: contacts')
    const result = await prisma.$queryRaw`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'contacts';
    `
    console.table(result)
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
