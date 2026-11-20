"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setSocketIO = setSocketIO;
exports.getSocketIO = getSocketIO;
exports.logSystem = logSystem;
exports.logAudit = logAudit;
const index_js_1 = require("../database/index.js");
let ioInstance = null;
function setSocketIO(io) {
    ioInstance = io;
}
function getSocketIO() {
    return ioInstance;
}
async function logSystem(level, moduleName, message, metadata) {
    const timestamp = new Date().toISOString().substring(11, 19);
    const formattedConsole = `[${timestamp}] [${level}] ${moduleName}: ${message}`;
    if (level === 'ERROR') {
        console.error(formattedConsole);
    }
    else if (level === 'WARNING') {
        console.warn(formattedConsole);
    }
    else {
        console.log(formattedConsole);
    }
    // Persist to database
    try {
        const metaStr = metadata ? JSON.stringify(metadata) : null;
        await index_js_1.db.execute('INSERT INTO system_logs (level, module, message, metadata_json) VALUES (?, ?, ?, ?)', [level, moduleName, message, metaStr]);
    }
    catch (err) {
        console.error('Failed to persist log to DB:', err);
    }
    // Stream via Socket.IO
    if (ioInstance) {
        ioInstance.emit('terminal:log', {
            timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
            level,
            module: moduleName,
            message,
            metadata
        });
    }
}
async function logAudit(userId, action, resource, details, ipAddress) {
    try {
        const detailsStr = details ? JSON.stringify(details) : null;
        const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || '127.0.0.1');
        await index_js_1.db.execute('INSERT INTO audit_logs (user_id, action, resource, details_json, ip_address) VALUES (?, ?, ?, ?, ?)', [userId, action, resource, detailsStr, ipStr]);
    }
    catch (err) {
        console.error('Failed to persist audit log:', err);
    }
}
