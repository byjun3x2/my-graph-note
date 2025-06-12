const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'your-secret-key';

// MongoDB 연결
mongoose.connect('mongodb://localhost:27017/mindmap');

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true },
    password: String,
});

const nodeSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    id: String,
    content: String,
    tags: [String],
    color: String,
    x: Number,
    y: Number,
});

const linkSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    source: String,
    target: String,
});

const User = mongoose.model('User', userSchema);
const Node = mongoose.model('Node', nodeSchema);
const Link = mongoose.model('Link', linkSchema);

// 회원가입
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '필수 입력값 누락' });
    const hashed = await bcrypt.hash(password, 10);
    try {
        const user = await User.create({ username, password: hashed });
        res.json({ message: '회원가입 완료' });
    } catch (e) {
        res.status(400).json({ message: '이미 존재하는 아이디입니다.' });
    }
});

// 로그인
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: '아이디 또는 비밀번호 오류' });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ message: '아이디 또는 비밀번호 오류' });
    const token = jwt.sign({ userId: user._id, username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userId: user._id, username });
});

// 인증 미들웨어
function auth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: '인증 필요' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        res.status(401).json({ message: '토큰 오류' });
    }
}

// 노드+링크 불러오기 (로그인 사용자별)
app.get('/api/graph', auth, async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const nodes = await Node.find({ userId });
    const links = await Link.find({ userId });
    res.json({ nodes, links });
});

// 노드+링크 저장 (전체 덮어쓰기, userId로만 저장)
app.post('/api/graph', auth, async (req, res) => {
    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const { nodes, links } = req.body;
    await Node.deleteMany({ userId });
    await Link.deleteMany({ userId });
    if (nodes && nodes.length > 0) {
        await Node.insertMany(nodes.map(n => ({ ...n, userId })));
    }
    if (links && links.length > 0) {
        await Link.insertMany(links.map(l => ({
            ...l,
            userId,
            source: typeof l.source === "object" ? l.source.id : l.source,
            target: typeof l.target === "object" ? l.target.id : l.target
        })));
    }
    res.json({ message: '그래프 저장 완료' });
});

app.listen(4000, () => console.log('서버 실행중: http://localhost:4000'));
