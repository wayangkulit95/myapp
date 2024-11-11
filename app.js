const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const fetch = require('node-fetch');
const ejs = require('ejs');

const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', './views');  // Directory where EJS files will be stored

// Authentication credentials for the management panel
const USERNAME = 'mts001'; // Replace with your username
const PASSWORD = 'mtsiptv0123'; // Replace with your password

// Telegram Bot Configuration
const NEW_USER_BOT_TOKEN = '7874026628:AAGLhoaU8jnLObfpatEjKbqggNfu3Qf5S1M'; // Replace with your new user bot token
const NEW_USER_CHAT_ID = '7813473203'; // Replace with your new user chat ID

const CONTENT_ACCESS_BOT_TOKEN = '7743128397:AAF9o4rqa_Xltaveb2ujJHAbMi1XzIfWIpc'; // Replace with your content access bot token
const CONTENT_ACCESS_CHAT_ID = '7813473203'; // Replace with your content access chat ID

// Create SQLite Database
const db = new sqlite3.Database('./data.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Create Users and Resellers Tables if they don't exist
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    code TEXT NOT NULL,
    expiration TEXT NOT NULL,
    allowedCountries TEXT NOT NULL,
    allowedDevices TEXT DEFAULT '',
    userAgent TEXT DEFAULT '',
    userId TEXT NOT NULL,
    userCode TEXT NOT NULL,
    credits INTEGER DEFAULT 0
);`);

db.run(`CREATE TABLE IF NOT EXISTS resellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    credits INTEGER DEFAULT 0
);`);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key', // Replace with a secure key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Authentication Middleware
function isAuthenticated(req, res, next) {
    if (req.session.isAuthenticated) {
        return next();
    }
    res.redirect('/login');
}

// Function to send notifications to Telegram
function sendTelegramNotification(token, chatId, message) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const data = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
    };

    fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
    }).catch(err => console.error('Error sending message to Telegram:', err));
}

// Middleware for parsing JSON (if needed for future requests)
app.use(express.json());

// Home route (Dashboard for Admin/Reseller)
app.get('/', isAuthenticated, (req, res) => {
    const username = req.session.username;
    const isAdmin = req.session.isAdmin; // Set based on login role (Admin or Reseller)

    if (isAdmin) {
        // Admin Panel
        res.render('admin_dashboard', { username });
    } else {
        // Reseller Panel
        res.render('reseller_dashboard', { username });
    }
});

// Admin Route: Show the Add User Form
app.get('/admin/addUser', isAuthenticated, (req, res) => {
    if (req.session.isAdmin) {
        res.render('add_user_admin');  // Render the Add User form for Admin
    } else {
        res.redirect('/');  // Redirect to dashboard if not Admin
    }
});

// Admin Route: Add New User
app.post('/admin/addUser', isAuthenticated, (req, res) => {
    if (req.session.isAdmin) {
        const { username, userCode, expiration, allowedCountries, userId } = req.body;

        // Validate inputs (example: ensure required fields are provided)
        if (!username || !userCode || !expiration || !allowedCountries || !userId) {
            return res.send('All fields are required.');
        }

        // Insert new user into the database (SQLite in this case)
        const stmt = db.prepare('INSERT INTO users (username, userCode, expiration, allowedCountries, userId) VALUES (?, ?, ?, ?, ?)');
        stmt.run(username, userCode, expiration, allowedCountries, userId, (err) => {
            if (err) {
                console.error(err);
                return res.send('Error adding user');
            }

            // Redirect to the admin dashboard or another page after user is added
            res.send('User added successfully!');
        });

        stmt.finalize();
    } else {
        res.redirect('/');  // Redirect if the session is not an Admin
    }
});

// Admin Route: Show Admin Dashboard with Users and Resellers
app.get('/admin/dashboard', isAuthenticated, (req, res) => {
    if (req.session.isAdmin) {
        // Query the database to fetch users and resellers
        db.all('SELECT * FROM users WHERE role="user"', [], (err, users) => {
            if (err) {
                console.error(err);
                return res.send('Error fetching users');
            }

            // Query to fetch only the required fields for resellers
            db.all('SELECT username, password, credit_balance FROM users WHERE role="reseller"', [], (err, resellers) => {
                if (err) {
                    console.error(err);
                    return res.send('Error fetching resellers');
                }

                // Render the dashboard with the fetched data
                res.render('admin_dashboard', {
                    username: req.session.username,
                    users: users,
                    resellers: resellers
                });
            });
        });
    } else {
        res.redirect('/');  // Redirect if not an admin
    }
});


// Admin Route: Add Reseller
app.get('/admin/addReseller', isAuthenticated, (req, res) => {
    res.render('add_reseller');
});

// Admin Route: Top-Up Reseller Credits
app.get('/admin/topUpReseller', isAuthenticated, (req, res) => {
    res.render('top_up_reseller');
});

// Reseller Route: Add User
app.get('/reseller/addUser', isAuthenticated, (req, res) => {
    res.render('add_user');
});

// Login Route
app.get('/login', (req, res) => {
    res.render('login');
});

// Admin Login Validation
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === USERNAME && password === PASSWORD) {
        req.session.isAuthenticated = true;
        req.session.username = username;
        req.session.isAdmin = true;  // Set Admin role if correct login
        return res.redirect('/');
    }
    res.redirect('/login');
});

// Reseller Login (for simplicity, we're using static credentials for resellers)
app.post('/login/reseller', (req, res) => {
    const { username, password } = req.body;
    // Validate reseller credentials
    db.get('SELECT * FROM resellers WHERE username = ? AND password = ?', [username, password], (err, reseller) => {
        if (err || !reseller) {
            return res.redirect('/login');
        }
        req.session.isAuthenticated = true;
        req.session.username = username;
        req.session.isAdmin = false;  // Set Reseller role
        res.redirect('/');
    });
});

// Logout Route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Error logging out');
        }
        res.redirect('/login');
    });
});

// Reseller Route to Add User
app.post('/reseller/addUser', isAuthenticated, (req, res) => {
    const { username, code, expiration, allowedCountries, userId, userCode } = req.body;
    const resellerUsername = req.session.username;

    db.get('SELECT * FROM resellers WHERE username = ?', [resellerUsername], (err, reseller) => {
        if (err || !reseller) {
            return res.status(404).send('Reseller not found');
        }

        if (reseller.credits <= 0) {
            return res.status(400).send('Insufficient credits to add a user');
        }

        // Insert the new user into the database
        const sql = 'INSERT INTO users (username, code, expiration, allowedCountries, userId, userCode) VALUES (?, ?, ?, ?, ?, ?)';
        db.run(sql, [username, code, expiration, allowedCountries, userId, userCode], function(err) {
            if (err) {
                return res.status(500).send('Error adding user');
            }

            // Deduct credits after creating a user
            db.run('UPDATE resellers SET credits = credits - 1 WHERE username = ?', [resellerUsername], function(err) {
                if (err) {
                    return res.status(500).send('Error deducting credits');
                }

                // Notify Telegram about the new user creation
                const message = `New User Added by Reseller:\n- Username: <b>${username}</b>\n- Reseller: <b>${resellerUsername}</b>\n- Credits Deducted: <b>1</b>`;
                sendTelegramNotification(NEW_USER_BOT_TOKEN, NEW_USER_CHAT_ID, message);

                // Fetch the updated list of users for this reseller
                db.all('SELECT * FROM users WHERE userId = ?', [resellerUsername], (err, users) => {
                    if (err) {
                        return res.status(500).send('Error fetching users');
                    }

                    // Generate the URL for accessing content (you can adjust the URL format as needed)
                    const contentUrl = `/id=${username}/premium/code=${code}`;

                    // Render the Reseller Dashboard with the updated list of users and the generated content URL
                    res.render('reseller_dashboard', {
                        username: resellerUsername,
                        users: users, // Pass the list of users to the view
                        contentUrl: contentUrl // Pass the generated content URL
                    });
                });
            });
        });
    });
});

// Access Content Route
app.get('/id=:username/premium/code=:code', (req, res) => {
    const { username, code } = req.params;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent']; // Get the user's current userAgent

    // Get the full access URL
    const accessUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

    // Check if the user agent matches the OTT Navigator user agent
    const isOTTNavigator = userAgent.includes('OTT Navigator');

    if (!isOTTNavigator) {
        // Notify on Telegram about the browser access attempt
        const browserAccessMessage = `Browser Access Attempt:\n- Username: <b>${username}</b>\n- IP Address: <b>${ip}</b>\n- User Agent: <b>${userAgent}</b>\n- Access URL: <b>${accessUrl}</b>\n- Access Attempt Time: <b>${new Date().toLocaleString()}</b>`;
        sendTelegramNotification(CONTENT_ACCESS_BOT_TOKEN, CONTENT_ACCESS_CHAT_ID, browserAccessMessage);

        // Redirect non-OTT Navigator user agents to another website
        return res.redirect('https://i.ibb.co/bFsNJx8/redirect-browser.jpg'); // Replace with the URL of your choice
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err || !user) {
            return res.status(404).send('User not found');
        }

        // Check if the expiration date has passed
        const expirationDate = new Date(user.expiration);
        const currentDate = new Date();
        if (currentDate > expirationDate) {
            // Notify on Telegram about user expiration
            const expiredMessage = `
                User Expired:
                - Username: <b>${username}</b>
                - Expiration Date: <b>${user.expiration}</b>
                - IP Address: <b>${ip}</b>
                - Access URL: <b>${accessUrl}</b>
                - Access Attempt Time: <b>${new Date().toLocaleString()}</b>
            `;
            sendTelegramNotification(NEW_USER_BOT_TOKEN, NEW_USER_CHAT_ID, expiredMessage);

            // Redirect to a specified URL if expired
            const redirectUrl = 'https://drive.google.com/uc?export=download&id=17tm4rNb8oLhwu3U0Jwq8Dn_bZXH4fUf6'; // Replace with your redirect URL
            return res.redirect(redirectUrl);
        }

        // Lock the URL to the first device
        let allowedDevices = JSON.parse(user.allowedDevices || '[]');
        if (!allowedDevices.length) {
            allowedDevices.push(userAgent);
            db.run('UPDATE users SET allowedDevices = ? WHERE username = ?', [JSON.stringify(allowedDevices), username]);
        }

        // Notify on Telegram about user access
        const accessMessage = `
            User Accessed Content:
            - Username: <b>${username}</b>
            - Code: <b>${user.code}</b>
            - Expiration Date: <b>${user.expiration}</b>
            - Allowed Countries: <b>${user.allowedCountries}</b>
            - IP Address: <b>${ip}</b>
            - User Agent: <b>${userAgent}</b>
            - Access URL: <b>${accessUrl}</b>
            - Access Time: <b>${new Date().toLocaleString()}</b>
        `;
        sendTelegramNotification(CONTENT_ACCESS_BOT_TOKEN, CONTENT_ACCESS_CHAT_ID, accessMessage);

        // Fetch the content if the user is allowed, code matches, and expiration is valid
        const contentUrl = 'https://drive.google.com/uc?export=download&id=17gXmxMQ9aGcHRJvl_FVSf1sJqQtypTWG'; // Replace with your URL
        res.redirect(contentUrl);
    });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
