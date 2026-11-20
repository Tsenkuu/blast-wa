"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const index_js_1 = require("../../database/index.js");
const auth_js_1 = require("../../middleware/auth.js");
const rateLimit_js_1 = require("../../middleware/rateLimit.js");
const logger_js_1 = require("../../utils/logger.js");
const router = (0, express_1.Router)();
// POST /api/auth/login
router.post('/login', rateLimit_js_1.loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
        return;
    }
    try {
        const user = await index_js_1.db.getOne(`SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.username = ?`, [username]);
        if (!user || user.is_active !== 1) {
            await (0, logger_js_1.logAudit)(null, 'LOGIN_FAILED', 'auth', { username, reason: 'User not found or inactive' }, req.ip);
            res.status(401).json({ success: false, message: 'Username atau password salah.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isMatch) {
            await (0, logger_js_1.logAudit)(user.id, 'LOGIN_FAILED', 'auth', { username, reason: 'Invalid password' }, req.ip);
            res.status(401).json({ success: false, message: 'Username atau password salah.' });
            return;
        }
        const authUser = {
            id: user.id,
            username: user.username,
            roleId: user.role_id,
            roleName: user.role_name,
            fullName: user.full_name
        };
        const token = (0, auth_js_1.generateToken)(authUser);
        await (0, logger_js_1.logAudit)(user.id, 'LOGIN_SUCCESS', 'auth', { username }, req.ip);
        await (0, logger_js_1.logSystem)('INFO', 'AUTH', `User "${user.username}" (${user.role_name}) berhasil login.`);
        res.json({
            success: true,
            message: 'Login berhasil.',
            token,
            user: authUser
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat login.' });
    }
});
// GET /api/auth/me
router.get('/me', auth_js_1.authenticate, async (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});
// POST /api/auth/change-password
router.post('/change-password', auth_js_1.authenticate, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
        res.status(400).json({
            success: false,
            message: 'Password baru harus memiliki minimal 6 karakter.'
        });
        return;
    }
    try {
        const user = await index_js_1.db.getOne('SELECT id, password_hash FROM users WHERE id = ?', [req.user.id]);
        if (!user) {
            res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
            return;
        }
        const isMatch = await bcryptjs_1.default.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            res.status(400).json({ success: false, message: 'Password saat ini salah.' });
            return;
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const newHash = await bcryptjs_1.default.hash(newPassword, salt);
        await index_js_1.db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
        await (0, logger_js_1.logAudit)(req.user.id, 'PASSWORD_CHANGE', 'auth', {}, req.ip);
        res.json({ success: true, message: 'Password berhasil diubah.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: 'Gagal mengubah password.' });
    }
});
// POST /api/auth/logout
router.post('/logout', auth_js_1.authenticate, async (req, res) => {
    await (0, logger_js_1.logAudit)(req.user.id, 'LOGOUT', 'auth', {}, req.ip);
    res.json({ success: true, message: 'Logout berhasil.' });
});
exports.default = router;
