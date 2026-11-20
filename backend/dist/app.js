"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const index_js_1 = require("./config/index.js");
// Route imports
const authRoutes_js_1 = __importDefault(require("./modules/auth/authRoutes.js"));
const whatsappRoutes_js_1 = __importDefault(require("./modules/whatsapp/whatsappRoutes.js"));
const excelRoutes_js_1 = __importDefault(require("./modules/excel/excelRoutes.js"));
const broadcastRoutes_js_1 = __importDefault(require("./modules/broadcast/broadcastRoutes.js"));
const templateRoutes_js_1 = __importDefault(require("./modules/templates/templateRoutes.js"));
const mediaRoutes_js_1 = __importDefault(require("./modules/media/mediaRoutes.js"));
const adminRoutes_js_1 = __importDefault(require("./modules/admin-bot/adminRoutes.js"));
const logRoutes_js_1 = __importDefault(require("./modules/logs/logRoutes.js"));
const dashboardRoutes_js_1 = __importDefault(require("./modules/dashboard/dashboardRoutes.js"));
const settingsRoutes_js_1 = __importDefault(require("./modules/settings/settingsRoutes.js"));
function createApp() {
    const app = (0, express_1.default)();
    // Security Middleware
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false, // allow Socket.IO and inline resources
        crossOriginResourcePolicy: { policy: 'cross-origin' }
    }));
    // CORS configuration
    app.use((0, cors_1.default)({
        origin: (origin, callback) => {
            // Allow localhost, local dev, or matching origins
            if (!origin || index_js_1.config.cors.origin.includes(origin) || origin.startsWith('http://localhost:')) {
                callback(null, true);
            }
            else {
                callback(null, true); // Dev-friendly permissive CORS
            }
        },
        credentials: true
    }));
    app.use(express_1.default.json({ limit: '25mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '25mb' }));
    // Static uploads serving
    if (!fs_1.default.existsSync(index_js_1.config.storage.uploadDir)) {
        fs_1.default.mkdirSync(index_js_1.config.storage.uploadDir, { recursive: true });
    }
    app.use('/uploads', express_1.default.static(index_js_1.config.storage.uploadDir));
    // Health check
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'healthy',
            app: 'WA BLAST MANAGER PRO',
            timestamp: new Date().toISOString()
        });
    });
    // Mount API modules
    app.use('/api/auth', authRoutes_js_1.default);
    app.use('/api/whatsapp', whatsappRoutes_js_1.default);
    app.use('/api/excel', excelRoutes_js_1.default);
    app.use('/api/broadcasts', broadcastRoutes_js_1.default);
    app.use('/api/templates', templateRoutes_js_1.default);
    app.use('/api/media', mediaRoutes_js_1.default);
    app.use('/api/admins', adminRoutes_js_1.default);
    app.use('/api/logs', logRoutes_js_1.default);
    app.use('/api/dashboard', dashboardRoutes_js_1.default);
    app.use('/api/settings', settingsRoutes_js_1.default);
    // Serve Frontend build in production if available
    const frontendDist = path_1.default.resolve(__dirname, '../../frontend/dist');
    if (fs_1.default.existsSync(frontendDist)) {
        app.use(express_1.default.static(frontendDist));
        app.get('*', (req, res) => {
            if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
                res.sendFile(path_1.default.join(frontendDist, 'index.html'));
            }
        });
    }
    // Global Error Handler
    app.use((err, req, res, next) => {
        console.error('Unhandled Server Error:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'Terjadi kesalahan internal pada server'
        });
    });
    return app;
}
