const rcedit = require('rcedit');
const path = require('path');

async function embedIcon() {
  const exePath = path.join(__dirname, 'build', 'win-unpacked', 'NaturalToSQL.exe');
  const iconPath = path.join(__dirname, 'assets', 'logo.ico');
  
  console.log('Embedding icon into executable...');
  console.log('Executable:', exePath);
  console.log('Icon:', iconPath);
  
  try {
    await rcedit(exePath, {
      'version-string': {
        'FileDescription': 'NaturalToSQL - Natural Language to SQL Converter',
        'ProductName': 'NaturalToSQL',
        'CompanyName': 'NaturalToSQL',
        'LegalCopyright': '© 2025 NaturalToSQL'
      },
      'file-version': '1.0.0',
      'product-version': '1.0.0',
      'icon': iconPath
    });
    
    console.log('✅ Icon embedded successfully!');
  } catch (error) {
    console.error('❌ Failed to embed icon:', error);
    process.exit(1);
  }
}

embedIcon();