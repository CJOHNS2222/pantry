const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter passphrase to encrypt private key (AES-128): ', (passphrase) => {
  if (!passphrase) {
    console.error('❌ Passphrase cannot be empty.');
    rl.close();
    process.exit(1);
  }

  console.log('\nGenerating 2048-bit RSA key pair...');

  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-128-cbc',
        passphrase: passphrase
      }
    });

    fs.writeFileSync('private.pem', privateKey);
    fs.writeFileSync('public.pem', publicKey);

    console.log('  ✅ Created private.pem (encrypted with AES-128)');
    console.log('  ✅ Created public.pem');
    console.log('\n🎉 Key generation complete!');
  } catch (err) {
    console.error('❌ Error generating keys:', err.message);
  }

  rl.close();
});
