import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

async function fixAdminUser() {
    const email = 'admin@admin.com'
    const password = 'admin123' // Change this to your actual admin password

    console.log('Checking admin user...')
    
    const user = await prisma.user.findUnique({
        where: { email }
    })

    if (!user) {
        console.log('Admin user not found, creating...')
        const hashedPassword = await bcrypt.hash(password, 10)
        await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                role: 'ADMIN'
            }
        })
        console.log('Admin user created successfully')
    } else {
        console.log('Admin user found:', {
            id: user.id,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt
        })
        
        // Ensure role is ADMIN
        if (user.role !== 'ADMIN') {
            console.log('Fixing role to ADMIN...')
            await prisma.user.update({
                where: { id: user.id },
                data: { role: 'ADMIN' }
            })
            console.log('Role updated to ADMIN')
        }
        
        // Reset password if needed
        const hashedPassword = await bcrypt.hash(password, 10)
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword }
        })
        console.log('Password reset successfully')
    }

    console.log('Done!')
    process.exit(0)
}

fixAdminUser().catch(e => {
    console.error('Error:', e)
    process.exit(1)
})
