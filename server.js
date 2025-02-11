const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Database connection
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
}).promise();

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, 'profile-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Failed to authenticate token' });
        req.user = decoded;
        next();
    });
};

// Auth Routes
app.post('/api/signup', upload.single('profileImage'), async (req, res) => {
    try {
        const { name, email, password, dob } = req.body;
        
        // Check if email already exists
        const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const profileImage = req.file ? `/uploads/${req.file.filename}` : null;

        await db.execute(
            'INSERT INTO users (name, email, password, dob, profile_image) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, dob, profileImage]
        );

        res.status(201).json({ message: 'User created. Please log in.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        const user = users[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour from now

        await db.execute(
            'UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE email = ?',
            [resetToken, resetExpires, email]
        );

        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        await transporter.sendMail({
            to: email,
            subject: 'Password Reset Request',
            html: `
                <h2>Password Reset Request</h2>
                <p>Click the link below to reset your password. This link will expire in 1 hour.</p>
                <a href="${resetLink}">Reset Password</a>
                <p>If you didn't request this, please ignore this email.</p>
            `
        });

        res.json({ message: 'Password reset link sent to your email' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Profile Route
app.get('/api/profile', verifyToken, async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, name, email, dob, profile_image FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// User Management Routes
app.post('/api/users', verifyToken, upload.single('profileImage'), async (req, res) => {
    try {
        const { name, email, dob, password } = req.body;
        
        // Check if email already exists
        const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const profileImage = req.file ? `/uploads/${req.file.filename}` : null;
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.execute(
            'INSERT INTO users (name, email, dob, password, profile_image) VALUES (?, ?, ?, ?, ?)',
            [name, email, dob, hashedPassword, profileImage]
        );

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/users', verifyToken, async (req, res) => {
    try {
        const { search, sortBy, order } = req.query;
        let query = 'SELECT id, name, email, dob, profile_image FROM users WHERE is_deleted = false';

        if (search) {
            query += ` AND (name LIKE ? OR email LIKE ?)`;
        }

        if (sortBy) {
            query += ` ORDER BY ${sortBy} ${order || 'ASC'}`;
        }

        const [users] = await db.execute(query, search ? [`%${search}%`, `%${search}%`] : []);
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.put('/api/users/:id', verifyToken, upload.single('profileImage'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, dob } = req.body;
        const profileImage = req.file ? `/uploads/${req.file.filename}` : null;

        // Check if email already exists for other users
        const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ? AND id != ?', [email, id]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: 'Email already registered to another user' });
        }

        let query = 'UPDATE users SET name = ?, email = ?, dob = ?';
        const params = [name, email, dob];

        if (profileImage) {
            query += ', profile_image = ?';
            params.push(profileImage);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await db.execute(query, params);
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.delete('/api/users/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('UPDATE users SET is_deleted = true WHERE id = ?', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Endpoint to truncate the users table
app.delete('/api/users', verifyToken, async (req, res) => {
    try {
        await db.execute('TRUNCATE TABLE users');
        res.json({ message: 'All users deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

db.getConnection()
    .then(connection => {
        console.log('Database connected successfully');
        connection.release();
    })
    .catch(error => {
        console.error('Error connecting to the database:', error);
    });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));