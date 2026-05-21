const http = require('http');

const data = JSON.stringify({ email: "admin@gmail.com", password: "Admin@123" });
const options = {
    hostname: 'localhost',
    port: 5001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = http.request(options, res => {
    let responseBody = '';
    res.on('data', chunk => responseBody += chunk);
    res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', responseBody));
});

req.on('error', e => console.error('ERROR:', e.message));
req.write(data);
req.end();
