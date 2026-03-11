const fs = require('fs');
if (fs.existsSync('public/icons/badge-72.png')) {
  console.log('badge-72.png already exists — skipping generation');
  process.exit(0);
}

const sharp = require('sharp');
sharp('public/logo/logo_final.jpeg')
  .resize(72, 72, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 }
  })
  .greyscale()
  .negate()
  .png()
  .toFile('public/icons/badge-72.png')
  .then(() => console.log('badge-72.png generated ✅'))
  .catch(console.error);
