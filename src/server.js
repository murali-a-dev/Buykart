// Buykart Server - API Services
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./api/routes');

const app = express();
const port = process.env.PORT || 3000;

// ── CORS ──────────────────────────────────────────────────────────
const defaultAllowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'https://buykart-supermart.vercel.app'
];

const envOrigins = process.env.ALLOWED_ORIGIN
    ? process.env.ALLOWED_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
    : [];

const allowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...envOrigins]));
const isDev = process.env.NODE_ENV !== 'production';

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        // Allow all in local development
        if (isDev) return callback(null, true);

        // Allow explicit origins or any Vercel deployment (production & preview branches)
        const isAllowed = allowedOrigins.includes(origin) ||
            /^https:\/\/([a-zA-Z0-9-]+\.)?vercel\.app$/.test(origin);

        if (isAllowed) {
            return callback(null, true);
        }

        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// ── BODY PARSING ──────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── SECURITY HEADERS ──────────────────────────────────────────────
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// ── RATE LIMITER for Admin Login ─────────────────────────────────
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = isDev ? 100 : 10; // Relaxed limit in development

app.use((req, res, next) => {
    req.clearLoginAttempts = () => {
        loginAttempts.delete(req.ip);
    };
    req.incrementLoginAttempts = () => {
        const key = req.ip;
        const now = Date.now();
        const attempts = loginAttempts.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
        if (now > attempts.resetAt) {
            attempts.count = 0;
            attempts.resetAt = now + RATE_LIMIT_WINDOW_MS;
        }
        attempts.count += 1;
        loginAttempts.set(key, attempts);
    };
    next();
});

app.use('/admin/login', (req, res, next) => {
    if (req.method !== 'POST') return next();
    const key = req.ip;
    const now = Date.now();
    const attempts = loginAttempts.get(key);

    if (attempts && now <= attempts.resetAt && attempts.count >= RATE_LIMIT_MAX) {
        return res.status(429).json({
            success: false,
            message: 'Too many failed login attempts. Please try again in 15 minutes.'
        });
    }

    next();
});

// ── STATIC FILES ───────────────────────────────────────────────────
const isVercel = process.env.VERCEL === '1';
const uploadDir = isVercel ? '/tmp' : path.join(__dirname, '../public/img/inventory');
app.use('/public/img/inventory', express.static(uploadDir));

// Fix for Vercel URL path resolution for serverless functions
app.use((req, res, next) => {
    const realPath = req.headers['x-matched-path'] || req.headers['x-invoke-path'] || req.headers['x-forwarded-uri'];
    if (realPath && realPath !== '/api/index.js' && realPath !== '/api/index') {
        req.url = realPath;
    }
    next();
});

const fs = require('fs');
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
}
app.use('/public', express.static(path.join(__dirname, '../public')));

// ── API ROUTES ─────────────────────────────────────────────────────
app.use('/', routes);

// ── SPA FALLBACK ───────────────────────────────────────────────────
app.use((req, res, next) => {
    if (req.method === 'GET' && req.headers.accept && req.headers.accept.includes('text/html')) {
        const isApiExplicit = req.path.startsWith('/api/');
        if (!isApiExplicit && fs.existsSync(path.join(distPath, 'index.html'))) {
            return res.sendFile(path.join(distPath, 'index.html'));
        }
    }
    next();
});

app.listen(port, () => {
    console.log(`Buykart server running on port ${port} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
