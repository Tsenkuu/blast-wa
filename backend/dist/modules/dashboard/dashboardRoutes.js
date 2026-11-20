"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const os_1 = __importDefault(require("os"));
const index_js_1 = require("../../database/index.js");
const baileysService_js_1 = require("../whatsapp/baileysService.js");
const auth_js_1 = require("../../middleware/auth.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticate);
// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
    const waInfo = baileysService_js_1.whatsappService.getAccountInfo();
    // Contacts count
    const contactsCount = await index_js_1.db.getOne(`SELECT COUNT(*) as total, SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid FROM contacts`);
    // Message counters from broadcast_recipients
    const messageStats = await index_js_1.db.getOne(`SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
       SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
       SUM(CASE WHEN status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending
     FROM broadcast_recipients`);
    // Broadcasts count by status
    const broadcastStats = await index_js_1.db.getOne(`SELECT 
       COUNT(*) as total,
       SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
       SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM broadcasts`);
    // Server resources
    const totalMem = Math.round(os_1.default.totalmem() / 1024 / 1024);
    const freeMem = Math.round(os_1.default.freemem() / 1024 / 1024);
    const usedMem = totalMem - freeMem;
    const memoryPercent = Math.round((usedMem / totalMem) * 100);
    // Emergency stop status
    const emergencySetting = await index_js_1.db.getOne(`SELECT value_text FROM app_settings WHERE key_name = 'emergency_stop'`);
    const isEmergencyStop = emergencySetting?.value_text === '1';
    res.json({
        success: true,
        data: {
            whatsapp: {
                status: waInfo.status,
                phone: waInfo.phone,
                name: waInfo.name
            },
            contacts: {
                total: contactsCount?.total || 0,
                valid: contactsCount?.valid || 0
            },
            messages: {
                total: messageStats?.total || 0,
                sent: messageStats?.sent || 0,
                failed: messageStats?.failed || 0,
                skipped: messageStats?.skipped || 0,
                pending: messageStats?.pending || 0
            },
            broadcasts: {
                total: broadcastStats?.total || 0,
                running: broadcastStats?.running || 0,
                paused: broadcastStats?.paused || 0,
                completed: broadcastStats?.completed || 0
            },
            server: {
                totalMemoryMb: totalMem,
                usedMemoryMb: usedMem,
                memoryPercent,
                uptimeHours: (os_1.default.uptime() / 3600).toFixed(1)
            },
            emergencyStop: isEmergencyStop
        }
    });
});
// GET /api/dashboard/chart
router.get('/chart', async (req, res) => {
    // Return daily activity data for the last 7 days
    const today = new Date();
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayLabel = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
        // Count messages sent on that date
        const sentCount = await index_js_1.db.getOne(`SELECT COUNT(*) as count FROM broadcast_recipients 
       WHERE status = 'sent' AND (DATE(sent_at) = ? OR (sent_at IS NULL AND DATE(created_at) = ?))`, [dateStr, dateStr]);
        const failedCount = await index_js_1.db.getOne(`SELECT COUNT(*) as count FROM broadcast_recipients 
       WHERE status = 'failed' AND DATE(updated_at) = ?`, [dateStr]);
        chartData.push({
            date: dateStr,
            label: dayLabel,
            sent: sentCount?.count || 0,
            failed: failedCount?.count || 0
        });
    }
    res.json({ success: true, data: chartData });
});
// GET /api/dashboard/recent-broadcasts
router.get('/recent-broadcasts', async (req, res) => {
    const broadcasts = await index_js_1.db.query(`SELECT b.*, d.name as dataset_name 
     FROM broadcasts b 
     LEFT JOIN contact_datasets d ON b.dataset_id = d.id 
     ORDER BY b.id DESC LIMIT 5`);
    res.json({ success: true, data: broadcasts });
});
exports.default = router;
