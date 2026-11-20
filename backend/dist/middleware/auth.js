"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.authenticate = authenticate;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_js_1 = require("../config/index.js");
const index_js_2 = require("../database/index.js");
function generateToken(user) {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        username: user.username,
        roleId: user.roleId,
        roleName: user.roleName,
        fullName: user.fullName
    }, index_js_1.config.jwtSecret, { expiresIn: '24h' });
}
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : req.cookies?.token;
    if (!token) {
        res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, index_js_1.config.jwtSecret);
        // Check if user is still active in database
        const user = await index_js_2.db.getOne(`SELECT u.id, u.username, u.is_active, u.full_name, u.role_id, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`, [decoded.id]);
        if (!user || user.is_active !== 1) {
            res.status(401).json({ success: false, message: 'Akun tidak aktif atau sesi telah berakhir.' });
            return;
        }
        req.user = {
            id: user.id,
            username: user.username,
            roleId: user.role_id,
            roleName: user.role_name,
            fullName: user.full_name
        };
        next();
    }
    catch (err) {
        res.status(401).json({ success: false, message: 'Token tidak valid atau telah kadaluarsa.' });
        return;
    }
}
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
            return;
        }
        if (!allowedRoles.includes(req.user.roleName)) {
            res.status(403).json({
                success: false,
                message: 'Akses ditolak. Anda tidak memiliki izin untuk fitur ini.'
            });
            return;
        }
        next();
    };
}
