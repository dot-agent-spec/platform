// SPDX-License-Identifier: Apache-2.0

'use strict';

const fs = require('fs');
const path = require('path');

const distPath = path.resolve(__dirname, '..', 'dist');

try {
    if (fs.existsSync(distPath)) {
        console.log(`[clean] Removing existing distribution directory: ${distPath}`);
        fs.rmSync(distPath, { recursive: true, force: true });
    }
    
    console.log(`[clean] Creating fresh distribution directory: ${distPath}`);
    fs.mkdirSync(distPath, { recursive: true });
    
    console.log('[clean] Workspace cleared successfully.');
} catch (error) {
    console.error(`[clean] Error during workspace cleanup: ${error.message}`);
    process.exit(1);
}