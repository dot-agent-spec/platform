/*
 * Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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