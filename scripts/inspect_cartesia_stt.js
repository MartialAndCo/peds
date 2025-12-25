const { CartesiaClient } = require('@cartesia/cartesia-js');

const client = new CartesiaClient({ apiKey: 'dummy' });

const stt = client.stt;
console.log('stt object keys:', Object.keys(stt));
console.log('stt prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(stt)));
