const fs = require('fs');
const path = require('path');

// Simple PNG to ICO converter
// This is a basic implementation for creating a valid ICO header with PNG data

function createIcoFromPng(pngPath, icoPath) {
  try {
    const pngData = fs.readFileSync(pngPath);
    
    // ICO file structure:
    // Header (6 bytes): [0,0] [1,0] [count,0]
    // Directory entry (16 bytes per image)
    // PNG data
    
    const width = 256; // Default to 256x256
    const height = 256;
    
    // ICO Header (6 bytes)
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0);     // Reserved, must be 0
    header.writeUInt16LE(1, 2);     // Type: 1 for ICO
    header.writeUInt16LE(1, 4);     // Number of images
    
    // Directory Entry (16 bytes)
    const dirEntry = Buffer.alloc(16);
    dirEntry.writeUInt8(0, 0);          // Width (0 = 256)
    dirEntry.writeUInt8(0, 1);          // Height (0 = 256)
    dirEntry.writeUInt8(0, 2);          // Color palette (0 = no palette)
    dirEntry.writeUInt8(0, 3);          // Reserved
    dirEntry.writeUInt16LE(1, 4);       // Color planes
    dirEntry.writeUInt16LE(32, 6);      // Bits per pixel
    dirEntry.writeUInt32LE(pngData.length, 8);  // Size of image data
    dirEntry.writeUInt32LE(22, 12);     // Offset to image data (6 + 16 = 22)
    
    // Combine all parts
    const icoData = Buffer.concat([header, dirEntry, pngData]);
    
    fs.writeFileSync(icoPath, icoData);
    console.log(`Created ICO file: ${icoPath}`);
    return true;
  } catch (error) {
    console.error('Error creating ICO file:', error.message);
    return false;
  }
}

// Convert PNG to ICO
const pngPath = path.join(__dirname, 'assets', 'icon.png');
const icoPath = path.join(__dirname, 'assets', 'icon.ico');

if (fs.existsSync(pngPath)) {
  createIcoFromPng(pngPath, icoPath);
} else {
  console.error('PNG file not found:', pngPath);
}
