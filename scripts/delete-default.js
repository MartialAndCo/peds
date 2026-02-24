const http = require('http');

const optionsStop = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/sessions/stop',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json'
    }
};

const optionsDelete = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/sessions/delete',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json'
    }
};

const req1 = http.request(optionsStop, (res) => {
    console.log(`STOP Status: ${res.statusCode}`);
    const req2 = http.request(optionsDelete, (res) => {
        console.log(`DELETE Status: ${res.statusCode}`);
    });
    req2.on('error', (e) => console.error(e));
    req2.write(JSON.stringify({ sessionId: 'default' }));
    req2.end();
});
req1.on('error', (e) => console.error(e));
req1.write(JSON.stringify({ sessionId: 'default' }));
req1.end();
