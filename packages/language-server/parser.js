'use strict';

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectStates(text) {
    const results = [];
    const re = /^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
        results.push({ name: m[1], offset: m.index + (m[0].length - m[1].length) });
    }
    return results;
}

function collectTypes(text) {
    const results = [];
    const re = /^type\s+([a-zA-Z0-9_.-]+)/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
        results.push({ name: m[1], offset: m.index + (m[0].length - m[1].length) });
    }
    return results;
}

function offsetToPosition(text, offset) {
    const lines = text.slice(0, offset).split('\n');
    return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

function getCurrentStateName(text, offset) {
    const before = text.slice(0, offset);
    const lines = before.split('\n').reverse();
    for (const line of lines) {
        const m = line.match(/^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/);
        if (m) return m[1];
    }
    return null;
}

module.exports = { escapeRegex, collectStates, collectTypes, offsetToPosition, getCurrentStateName };
