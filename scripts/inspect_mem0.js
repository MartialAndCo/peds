const mem0 = require('mem0ai');
console.log('Exports:', Object.keys(mem0));
console.log('Type of exports:', typeof mem0);
if (typeof mem0 === 'object') {
    console.log('Is Memory in exports?', 'Memory' in mem0);
}
console.log('Default export:', mem0.default);
