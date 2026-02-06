import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'

async function resetAdminPassword() {
    const email = 'admin@admin.com'
    const newPassword = 'bhcmi6pm'

    console.log('Resetting password for:', email)
    
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    
    await prisma.user.update({
        where: { email },
        data: { 
            password: hashedPassword,
            role: 'ADMIN'
        }
    })

    console.log('✅ Password reset successfully!')
    console.log('   Email:', email)
    console.log('   New password:', newPassword)
    console.log('\n⚠️  Change this password after login!')
}

resetAdminPassword().catch(console.error)
