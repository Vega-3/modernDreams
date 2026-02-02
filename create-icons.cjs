const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'src-tauri', 'icons');

// Create a simple 32x32 ICO file
function createIco(size) {
    const width = size;
    const height = size;

    // Create pixel data (BGRA format)
    const pixels = Buffer.alloc(width * height * 4);
    const centerX = width / 2, centerY = height / 2;
    const radius = width * 0.375;
    const innerX = width * 0.625, innerY = height * 0.375;
    const innerRadius = width * 0.3125;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const distMain = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            const distInner = Math.sqrt((x - innerX) ** 2 + (y - innerY) ** 2);

            if (distMain <= radius && distInner > innerRadius) {
                // Purple color (BGRA) #6366f1
                pixels[idx] = 0xf1;     // B
                pixels[idx + 1] = 0x66; // G
                pixels[idx + 2] = 0x63; // R
                pixels[idx + 3] = 0xff; // A
            }
        }
    }

    // Flip vertically for BMP format
    const flipped = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
        pixels.copy(flipped, (height - 1 - y) * width * 4, y * width * 4, (y + 1) * width * 4);
    }

    // AND mask
    const andMask = Buffer.alloc(Math.ceil(width / 8) * height);

    // BMP info header (40 bytes)
    const bmpHeader = Buffer.alloc(40);
    bmpHeader.writeUInt32LE(40, 0);
    bmpHeader.writeInt32LE(width, 4);
    bmpHeader.writeInt32LE(height * 2, 8);
    bmpHeader.writeUInt16LE(1, 12);
    bmpHeader.writeUInt16LE(32, 14);
    bmpHeader.writeUInt32LE(0, 16);
    bmpHeader.writeUInt32LE(flipped.length + andMask.length, 20);

    // ICO header (6 bytes)
    const icoHeader = Buffer.alloc(6);
    icoHeader.writeUInt16LE(0, 0);
    icoHeader.writeUInt16LE(1, 2);
    icoHeader.writeUInt16LE(1, 4);

    // ICO directory entry (16 bytes)
    const icoDir = Buffer.alloc(16);
    icoDir.writeUInt8(width >= 256 ? 0 : width, 0);
    icoDir.writeUInt8(height >= 256 ? 0 : height, 1);
    icoDir.writeUInt8(0, 2);
    icoDir.writeUInt8(0, 3);
    icoDir.writeUInt16LE(1, 4);
    icoDir.writeUInt16LE(32, 6);
    icoDir.writeUInt32LE(40 + flipped.length + andMask.length, 8);
    icoDir.writeUInt32LE(22, 12);

    return Buffer.concat([icoHeader, icoDir, bmpHeader, flipped, andMask]);
}

// Create PNG file
function createPng(size) {
    const width = size;
    const height = size;

    // Create raw RGBA data
    const rawData = [];
    const centerX = width / 2, centerY = height / 2;
    const radius = width * 0.375;
    const innerX = width * 0.625, innerY = height * 0.375;
    const innerRadius = width * 0.3125;

    for (let y = 0; y < height; y++) {
        rawData.push(0); // Filter byte for PNG
        for (let x = 0; x < width; x++) {
            const distMain = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            const distInner = Math.sqrt((x - innerX) ** 2 + (y - innerY) ** 2);

            if (distMain <= radius && distInner > innerRadius) {
                rawData.push(0x63, 0x66, 0xf1, 0xff); // RGBA #6366f1
            } else {
                rawData.push(0, 0, 0, 0); // Transparent
            }
        }
    }

    // Simple PNG encoder
    const zlib = require('zlib');

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    function chunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length);
        const typeBuffer = Buffer.from(type);
        const crcData = Buffer.concat([typeBuffer, data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(crcData));
        return Buffer.concat([len, typeBuffer, data, crc]);
    }

    function crc32(buf) {
        let crc = 0xffffffff;
        const table = [];
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) {
                c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            }
            table[i] = c;
        }
        for (let i = 0; i < buf.length; i++) {
            crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
        }
        return (crc ^ 0xffffffff) >>> 0;
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr.writeUInt8(8, 8);  // Bit depth
    ihdr.writeUInt8(6, 9);  // Color type (RGBA)
    ihdr.writeUInt8(0, 10); // Compression
    ihdr.writeUInt8(0, 11); // Filter
    ihdr.writeUInt8(0, 12); // Interlace

    const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });
    const iend = Buffer.alloc(0);

    return Buffer.concat([
        signature,
        chunk('IHDR', ihdr),
        chunk('IDAT', compressed),
        chunk('IEND', iend)
    ]);
}

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Create all required icons
console.log('Creating icons...');

fs.writeFileSync(path.join(iconsDir, 'icon.ico'), createIco(32));
console.log('Created icon.ico');

fs.writeFileSync(path.join(iconsDir, '32x32.png'), createPng(32));
console.log('Created 32x32.png');

fs.writeFileSync(path.join(iconsDir, '128x128.png'), createPng(128));
console.log('Created 128x128.png');

fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), createPng(256));
console.log('Created 128x128@2x.png');

// For macOS, create a simple icns placeholder (just copy the 128x128 PNG)
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), createPng(128));
console.log('Created icon.icns (placeholder)');

console.log('Done! All icons created in src-tauri/icons/');
