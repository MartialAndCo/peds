const fetch = require('node-fetch');

async function testWebhook() {
    console.log('--- Starting Webhook Verification ---');

    // 1. Define the payload mimicking WAHA 'message.upsert'
    // Unique ID to avoid duplicates if re-running rapidly
    const uniqueId = `msg_${Date.now()}`;
    const payload = {
        event: 'message',
        session: 'default',
        payload: {
            id: uniqueId,
            timestamp: Date.now() / 1000,
            from: '33612345678@c.us',
            fromMe: false,
            type: 'ptt',        // Voice message type
            body: '',           // Usually empty for voice
            hasMedia: true,
            _data: {
                notifyName: 'Tester',
                mimetype: 'audio/ogg; codecs=opus'
            }
        }
    };

    console.log('Sending Webhook Payload:', JSON.stringify(payload, null, 2));

    try {
        const res = await fetch('http://localhost:3005/api/webhooks/waha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log('Webhook Response Status:', res.status);
        console.log('Webhook Response Body:', data);

        if (res.status === 200 && data.success) {
            console.log('SUCCESS: Webhook processed the message.');
            console.log('User Actions Required to Verify Full Flow:');
            console.log('1. Check Database: Ensure Contact "33612345678" exists, Conversation is created/active, and Message is saved.');
            console.log('2. Check Logs: Look for "WAHA SendSeen Error" or successful WAHA API calls (sendSeen, startTyping, sendText).');
        } else {
            console.error('FAILURE: Webhook returned unexpected response.');
        }

    } catch (error) {
        console.error('Network/Script Error:', error);
    }
}

testWebhook();
