import { settingsService } from '@/lib/settings-cache'
import { venice } from '@/lib/venice'

async function checkVenice() {
    console.log('🔍 Checking Venice API...\n')
    
    try {
        const settings = await settingsService.getSettings()
        console.log('Venice API Key:', settings.venice_api_key ? '✅ SET (' + settings.venice_api_key.substring(0, 10) + '...)' : '❌ MISSING')
        console.log('Venice Model:', settings.venice_model || 'venice-uncensored (default)')
        
        if (!settings.venice_api_key) {
            console.log('\n❌ NO VENICE API KEY - This would cause all SWARM responses to fail!')
            return
        }
        
        // Test API call
        console.log('\n🧪 Testing Venice API call...')
        const test = await venice.chatCompletion(
            'You are a helpful assistant. Reply with just: OK',
            [],
            'Say OK',
            {
                apiKey: settings.venice_api_key,
                model: settings.venice_model || 'venice-uncensored',
                temperature: 0.1,
                max_tokens: 10
            }
        )
        console.log('Test response:', test)
        
        if (test && test.includes('OK')) {
            console.log('\n✅ Venice API is working')
        } else {
            console.log('\n⚠️ Venice API returned unexpected response')
        }
        
    } catch (error: any) {
        console.error('\n❌ Venice API ERROR:', error.message)
        console.log('\nThis would cause the SWARM to return "jsuis là" for all responses!')
    }
}

checkVenice().then(() => process.exit()).catch(console.error)
