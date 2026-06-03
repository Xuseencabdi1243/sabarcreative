const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer'); // 👈 KANI WAA CUSUB: Waxay akhrinaysaa faylasha (images)

const app = express();
const PORT = 3000;

// Faylasha kaydka xogta
const DATA_FILE = path.join(__dirname, 'projects.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

// 📂 1. CONFIGURATION-KA MULTER (Galka sawirada la gelinayo)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Sawirradu waxay si toos ah u gelayaan galka 'uploads'
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Magac gaar ah oo waqtiga ku xiran
    }
});
const upload = multer({ storage: storage });

// 🛡️ HELMET SECURITY HEADERS
app.use(helmet({
    contentSecurityPolicy: false, 
}));

app.use(express.json());

// ================= 🛡️ 1. AMNIGA CODSYADA (RATE LIMITER) =================
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 150, 
    handler: (req, res) => {
        const ip = req.ip || req.headers['x-forwarded-for'];
        const time = new Date().toISOString();
        const alertMessage = `[⚠️ AMNIGA - BRUTE FORCE]: IP-ga ${ip} ayaa isku dayay jabin waqtiga: ${time} \n`;
        
        fs.appendFile(path.join(__dirname, 'security_alerts.log'), alertMessage, (err) => {});
        console.log('\x1b[31m%s\x1b[0m', alertMessage);
        res.status(429).json({ status: "Error", message: "IP-gaaga waa la xannibay!" });
    }
});
app.use(limiter);

// static assets oo furan (CSS, Images, iyo Galka Uploads ee cusub)
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // 👈 CUSUB: Si sawirrada loo arki karo

// ================= 🔑 2. BOGGA XANNIBI TAANKA OO LALOO QURXIYAY (403 HTML) =================
const forbiddenHTML = `
<!DOCTYPE html>
<html lang="so">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>403 - Access Denied // SABAR Studio</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght=200;400;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #030303; }</style>
</head>
<body class="text-zinc-400 antialiased min-h-screen flex items-center justify-center p-6">
    <div class="max-w-md w-full text-center border border-zinc-900 bg-zinc-950/50 p-12 rounded-3xl backdrop-blur-xl relative overflow-hidden">
        <div class="absolute -top-24 -left-24 w-48 h-48 bg-red-500/5 rounded-full blur-3xl"></div>
        <div class="w-16 h-16 rounded-full bg-red-950/30 border border-red-900/40 flex items-center justify-center text-red-500 text-xl mx-auto mb-6 animate-pulse">🔒</div>
        <span class="text-[10px] uppercase tracking-[0.3em] text-red-500 font-bold block mb-2">ERROR 403 // FORBIDDEN</span>
        <h1 class="text-2xl font-bold text-white tracking-tight uppercase mb-4">Amniga Shirkadda</h1>
        <p class="text-xs text-zinc-500 leading-relaxed mb-8">Nidaamka ilaalinta ee **SABAR Studio** ayaa xannibay isku daygaaga. IP-gaaga waa la diiwangeliyay.</p>
        <div class="border-t border-zinc-900 pt-6">
            <a href="/" class="inline-block bg-zinc-900 border border-zinc-800 text-white text-[11px] uppercase tracking-widest font-bold px-8 py-3 rounded-full hover:bg-white hover:text-black transition duration-300">Ku laabo Hoyga</a>
        </div>
    </div>
</body>
</html>`;

app.get(['/admin.html', '/sabar-admin.html'], (req, res) => {
    const ip = req.ip || req.headers['x-forwarded-for'];
    console.log('\x1b[31m%s\x1b[0m', `[🚨 ALERT]: IP-ga ${ip} wuxuu isku dayay inuu si toos ah u xado admin.html!`);
    res.status(403).send(forbiddenHTML);
});

// ================= 📂 JSON DATABASE FUNCTIONS =================
let activeSessions = new Set(); 

// Read & Write Projects
function readProjects() {
    if (!fs.existsSync(DATA_FILE)) { fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2)); return []; }
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { return []; }
}
function writeProjects(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

// Read & Write Messages (Fariimaha Macaamiisha)
function readMessages() {
    if (!fs.existsSync(MESSAGES_FILE)) { fs.writeFileSync(MESSAGES_FILE, JSON.stringify([], null, 2)); return []; }
    try { return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8')); } catch (e) { return []; }
}
function writeMessages(data) { fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2)); }

// ================= 🌐 API ENDPOINTS =================

// 1. Hel Mashaariicda (Public)
app.get('/api/projects', (req, res) => {
    res.json(readProjects());
});

// 2. Endpoint-ka Macamiilku Fariinta ka soo dirayo (Public)
app.post('/api/messages', (req, res) => {
    const { name, email, message } = req.body;
    if(!name || !email || !message) return res.status(400).json({ success: false, message: "Fariinta ma dhammaystirna!" });

    const currentMessages = readMessages();
    const today = new Date();
    const formattedDate = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`;

    currentMessages.unshift({
        id: Date.now().toString(),
        name,
        email,
        message,
        date: formattedDate
    });

    writeMessages(currentMessages);
    res.json({ success: true, message: "Fariintaada si guul leh ayaa loo diray!" });
});

// 3. Admin Login
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'SabarStudio2026@') {
        const token = Math.random().toString(36).substring(2, 15);
        activeSessions.add(token);
        res.json({ success: true, token: token, message: "Waad soo gashay!" });
    } else {
        res.status(401).json({ success: false, message: "Username ama Password khaldan!" });
    }
});

// 4. Analytics & Data (Admin Only)
app.get('/api/admin/analytics', (req, res) => {
    const token = req.headers['authorization'];
    if (!activeSessions.has(token)) return res.status(401).json({ success: false, message: "Unauthorized" });

    const projects = readProjects();
    const messages = readMessages();

    res.json({
        totalProjects: projects.length,
        totalMessages: messages.length,
        recentProjects: projects,
        recentMessages: messages
    });
});

// 5. Ku dar Mashruuc (Admin Only) - 👈 HALKAN WAA LA BEDDELAY SAXIB
app.post('/api/projects/add', upload.single('imageFile'), (req, res) => {
    const token = req.headers['authorization'];
    if (!activeSessions.has(token)) return res.status(401).json({ success: false });
    
    // Maadaama foomku FormData yahay, xogta waxay ku dhex jirtaa req.body
    const { title, category, imageLink, description } = req.body;
    
    // Go'aami sawirka: Haddii uu kombiyuutarka ka soo upload-gareeyay isticmaal kii galka galay, haddi kalena kii link-ga ahaa
    let finalImage = imageLink;
    if (req.file) {
        finalImage = `/uploads/${req.file.filename}`;
    }

    const currentProjects = readProjects();
    currentProjects.push({ 
        id: Date.now().toString(), 
        title, 
        category, 
        image: finalImage, // Halkan waxaa galaya sawirka saxda ah
        description 
    });
    
    writeProjects(currentProjects);
    res.json({ success: true });
});

// 6. Tirtir Mashruuc (Admin Only)
app.delete('/api/projects/delete/:id', (req, res) => {
    const token = req.headers['authorization'];
    if (!activeSessions.has(token)) return res.status(401).json({ success: false });

    const projectId = req.params.id;
    let currentProjects = readProjects();
    writeProjects(currentProjects.filter(p => p.id !== projectId));
    res.json({ success: true });
});

// ================= 🔑 3. LINKIYADA GAARKA AH EE MAAMULKA =================
app.get(['/control', '/analytics', '/admin'], (req, res) => {
    res.sendFile(path.join(__dirname, 'sabar-admin.html'));
});

// 🛡️ MIDDLEWARE CATCH-ALL (DADKA CAADIGA AH)
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Shid Server-ka
app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(`🛡️  SABAR STUDIO PREMIUM ANTI-HACK SERVER ACTIVE`);
    console.log(`🚀 Nidaamka Fariimaha dhabta ah hadda waa boqolkiiba boqol diyaar!`);
    console.log(`===================================================`);
});