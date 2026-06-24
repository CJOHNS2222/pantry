const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const DEFAULT_KEY_PATH = 'private.pem';
const DEFAULT_ENC_PATH = 'com.smart.pantry.enc';
const DEFAULT_OUT_PATH = 'api_keys.txt';

rl.question('Enter passphrase for private.pem: ', (passphrase) => {
  try {
    if (!fs.existsSync(DEFAULT_KEY_PATH)) {
      throw new Error(`Private key file "${DEFAULT_KEY_PATH}" not found.`);
    }
    if (!fs.existsSync(DEFAULT_ENC_PATH)) {
      throw new Error(`Encrypted file "${DEFAULT_ENC_PATH}" not found.`);
    }

    const privateKeyPem = fs.readFileSync(DEFAULT_KEY_PATH, 'utf8');
    const encryptedData = fs.readFileSync(DEFAULT_ENC_PATH);

    console.log('\nDecrypting file...');

    const decrypted = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        passphrase: passphrase || undefined,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha1' // Default hash for OpenSSL's pkeyutl -pkeyopt rsa_padding_mode:oaep
      },
      encryptedData
    );

    fs.writeFileSync(DEFAULT_OUT_PATH, decrypted);
    console.log(`  ✅ Decrypted content saved to: ${DEFAULT_OUT_PATH}`);
    console.log('\n--- Decrypted Content ---');
    console.log(decrypted.toString('utf8').trim());
    console.log('-------------------------\n');

  } catch (err) {
    console.error('\n❌ Decryption failed:', err.message);
  }

  rl.close();
});
