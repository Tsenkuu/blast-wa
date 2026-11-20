"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const os_1 = __importDefault(require("os"));
const index_js_1 = require("../../database/index.js");
const broadcastQueueWorker_js_1 = require("../broadcast/broadcastQueueWorker.js");
const auth_js_1 = require("../../middleware/auth.js");
const logger_js_1 = require("../../utils/logger.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticate);
// GET /api/logs/system
router.get('/system', async (req, res) => {
    const level = req.query.level;
    const search = req.query.search;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '100', 10);
    const offset = (page - 1) * limit;
    let sql = 'SELECT * FROM system_logs WHERE 1=1';
    const params = [];
    if (level && level !== 'ALL') {
        sql += ' AND level = ?';
        params.push(level);
    }
    if (search) {
        sql += ' AND (message LIKE ? OR module LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const logs = await index_js_1.db.query(sql, params);
    res.json({ success: true, data: logs });
});
// GET /api/logs/audit
router.get('/audit', (0, auth_js_1.requireRole)(['Super Admin']), async (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = (page - 1) * limit;
    const logs = await index_js_1.db.query(`SELECT a.*, u.username, u.full_name 
     FROM audit_logs a 
     LEFT JOIN users u ON a.user_id = u.id 
     ORDER BY a.id DESC LIMIT ? OFFSET ?`, [limit, offset]);
    res.json({ success: true, data: logs });
});
// DELETE /api/logs/system (clear logs display/table)
router.delete('/system', (0, auth_js_1.requireRole)(['Super Admin']), async (req, res) => {
    await index_js_1.db.execute('DELETE FROM system_logs');
    await (0, logger_js_1.logAudit)(req.user.id, 'LOGS_CLEAR', 'system_logs', {}, req.ip);
    res.json({ success: true, message: 'Log sistem berhasil dibersihkan.' });
});
// GET /api/logs/download (export logs to plaintext)
router.get('/download', async (req, res) => {
    const logs = await index_js_1.db.query('SELECT created_at, level, module, message FROM system_logs ORDER BY id ASC LIMIT 5000');
    let output = `=== WA BLAST MANAGER PRO - SYSTEM LOG EXPORT ===\nExported: ${new Date().toISOString()}\n\n`;
    for (const log of logs) {
        output += `[${log.created_at}] [${log.level}] ${log.module}: ${log.message}\n`;
    }
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', 'attachment; filename="system_logs.txt"');
    res.send(output);
});
// GET /api/logs/server-metrics
router.get('/server-metrics', async (req, res) => {
    const totalMem = Math.round(os_1.default.totalmem() / 1024 / 1024);
    const freeMem = Math.round(os_1.default.freemem() / 1024 / 1024);
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    const cpus = os_1.default.cpus();
    const uptimeSeconds = Math.round(os_1.default.uptime());
    res.json({
        success: true,
        data: {
            uptimeSeconds,
            uptimeFormatted: `${(uptimeSeconds / 3600).toFixed(1)} jam`,
            totalMemoryMb: totalMem,
            usedMemoryMb: usedMem,
            freeMemoryMb: freeMem,
            memoryPercent: memPercent,
            cpuCores: cpus.length,
            cpuModel: cpus[0]?.model || 'Standard CPU',
            platform: `${os_1.default.platform()} ${os_1.default.arch()}`
        }
    });
});
// POST /api/logs/restart-worker
router.post('/restart-worker', (0, auth_js_1.requireRole)(['Super Admin']), async (req, res) => {
    await broadcastQueueWorker_js_1.broadcastQueueWorker.stop();
    setTimeout(async () => {
        await broadcastQueueWorker_js_1.broadcastQueueWorker.start();
    }, 1000);
    await (0, logger_js_1.logAudit)(req.user.id, 'WORKER_RESTART', 'broadcast_worker', {}, req.ip);
    await (0, logger_js_1.logSystem)('INFO', 'WORKER', 'Broadcast Queue Worker berhasil direstart oleh admin.');
    res.json({ success: true, message: 'Broadcast Worker berhasil direstart.' });
});
exports.default = router;
