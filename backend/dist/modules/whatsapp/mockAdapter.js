"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockWhatsAppAdapter = void 0;
class MockWhatsAppAdapter {
    status = 'disconnected';
    qrCode = null;
    jid = null;
    phone = null;
    pushName = null;
    incomingHandlers = [];
    connectionChangeHandlers = [];
    sentMessages = [];
    shouldFailNextSend = false;
    failErrorMessage = 'Simulated connection failure';
    async init() {
        // No-op for mock
    }
    getAccountInfo() {
        return {
            jid: this.jid,
            phone: this.phone,
            name: this.pushName,
            status: this.status,
            qrCode: this.qrCode
        };
    }
    onIncomingMessage(handler) {
        this.incomingHandlers.push(handler);
    }
    onConnectionChange(handler) {
        this.connectionChangeHandlers.push(handler);
    }
    notify() {
        const info = this.getAccountInfo();
        for (const h of this.connectionChangeHandlers) {
            h(info);
        }
    }
    async connect() {
        this.status = 'connected';
        this.qrCode = null;
        this.phone = '6281234567890';
        this.jid = '6281234567890@s.whatsapp.net';
        this.pushName = 'WA Blast Mock Bot';
        this.notify();
    }
    async disconnect() {
        this.status = 'disconnected';
        this.qrCode = null;
        this.notify();
    }
    async logout() {
        this.status = 'logged_out';
        this.qrCode = null;
        this.jid = null;
        this.phone = null;
        this.pushName = null;
        this.notify();
    }
    async resetSession() {
        this.status = 'disconnected';
        this.qrCode = null;
        this.jid = null;
        this.phone = null;
        this.pushName = null;
        this.notify();
    }
    async reconnect() {
        await this.disconnect();
        await this.connect();
    }
    async sendTextMessage(toPhone, text) {
        if (this.status !== 'connected') {
            return { success: false, messageId: '', error: 'WhatsApp mock tidak terhubung' };
        }
        if (this.shouldFailNextSend) {
            this.shouldFailNextSend = false;
            return { success: false, messageId: '', error: this.failErrorMessage };
        }
        this.sentMessages.push({ to: toPhone, type: 'text', content: text });
        return {
            success: true,
            messageId: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            timestamp: Date.now()
        };
    }
    async sendImageMessage(toPhone, imagePath, caption) {
        if (this.status !== 'connected') {
            return { success: false, messageId: '', error: 'WhatsApp mock tidak terhubung' };
        }
        if (this.shouldFailNextSend) {
            this.shouldFailNextSend = false;
            return { success: false, messageId: '', error: this.failErrorMessage };
        }
        this.sentMessages.push({ to: toPhone, type: 'image', mediaPath: imagePath, content: caption });
        return {
            success: true,
            messageId: `mock_img_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            timestamp: Date.now()
        };
    }
    /**
     * Helper for tests to simulate incoming message from admin or contact
     */
    async simulateIncomingMessage(msg) {
        for (const h of this.incomingHandlers) {
            await h(msg);
        }
    }
}
exports.MockWhatsAppAdapter = MockWhatsAppAdapter;
