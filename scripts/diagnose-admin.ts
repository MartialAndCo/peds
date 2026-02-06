const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function diagnose() {
    const email = process.argv[2] || 'admin@admin.com'
    
    console.log('Diagnosing user:', email)
    
    try {
        const user = await prisma.user.findUnique({
            where: { email }
        })

        if (!user) {
            console.log('❌ User not found')
            return
        }

        console.log('\nUser found:')
        console.log('  ID:', user.id)
        console.log('  Email:', user.email)
        console.log('  Role:', user.role)
        console.log('  Created:', user.createdAt)
        console.log('  Password hash length:', user.password?.length || 0)
        
        // Check if role is valid
        const validRoles = ['ADMIN', 'COLLABORATOR', 'PROVIDER']
        if (!validRoles.includes(user.role)) {
            console.log('\n⚠️  WARNING: Role is not valid!')
            console.log('   Expected one of:', validRoles.join(', '))
        } else {
            console.log('\n✅ Role is valid')
        }

    } catch (error) {
        console.error('Error:', error)
    } finally {
        await prisma.$disconnect()
    }
}

diagnose()
