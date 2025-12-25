const { CartesiaClient } = require('@cartesia/cartesia-js');

const client = new CartesiaClient({ apiKey: 'dummy' });

console.log('Client keys:', Object.keys(client));
if (client.stt) {
    console.log('client.stt keys:', Object.keys(client.stt));
    if (client.stt.prototype) console.log('client.stt.prototype:', Object.getOwnPropertyNames(client.stt.prototype));
}
if (client.voice) { // check for other potential namespaces
    console.log('client.voice keys:', Object.keys(client.voice));
}

// Check prototype of client to see methods
console.log('Client prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
