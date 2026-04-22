const selfsigned = require('selfsigned');
const fs = require('fs');
const path = require('path');

const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048 });

const keyPath = path.join(__dirname, '../key.pem');
const certPath = path.join(__dirname, '../cert.pem');

fs.writeFileSync(keyPath, pems.private);
fs.writeFileSync(certPath, pems.cert);

console.log('✅ Local HTTPS certificates generated successfully!');
console.log('   - Key: ' + keyPath);
console.log('   - Cert: ' + certPath);
console.log('\nNext steps:');
console.log('1. Set USE_HTTPS=true in your .env file.');
console.log('2. Restart the server.');
console.log('3. Visit https://localhost:3000 (you will see a security warning).');
