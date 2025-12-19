// routes/profile.js
const express = require('express');
const router = express.Router();
const db = require('../database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');
const { requireAuth } = require('../modules/auth-middleware');

// User profile, account management
router.get('/', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    try {
        const dbUser = db.prepare(`
            SELECT * FROM users WHERE id = ?
        `).get(userId);

        const comments = db.prepare(`
            SELECT * FROM comments 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 10
        `).all(userId);

        // add session info to user passed into profile for handlebars nav. 
        const user = {
            ...dbUser,                 
            isLoggedIn: true,          
            name: req.session.username,
        };
        
        res.render('profile', {
            title: 'My Profile - Wild West Forum',
            user: user,
            comments: comments,
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).render('error', {
            title: 'Error - Wild West Forum',
            message: 'Failed to load profile'
        });
    }
});

// Updates user password with validation and requires re-login after successful change
router.post('/password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.session.userId;

        if (!currentPassword || !newPassword || !confirmPassword) {
            
            return res.redirect('/profile?error=' + encodeURIComponent('All fields are required.'));
        }
        
        if (newPassword !== confirmPassword) {
            return res.redirect('/profile?error=' + encodeURIComponent('Passwords do not match.'));
        }
        
        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            return res.redirect(`/profile?error=${encodeURIComponent(validation.errors.join(', '))}`);
        }

        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);

        const passwordMatch = await comparePassword(currentPassword, user.password_hash);
        if (!passwordMatch) {
            return res.redirect('/profile?error=' + encodeURIComponent("Current password is invalid."));
        }

        const newHash = await hashPassword(newPassword);

        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
            res.redirect('/login?error=' + encodeURIComponent("Password Changed! Please login again."));
        });
    } catch (error) {
        console.error('Error updating password:', error);
        res.redirect('/profile?error=' + encodeURIComponent("Failed to update password."));
    }
});

// Updates email address with login verification 
router.post('/email', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newEmail, confirmEmail } = req.body;
        const userId = req.session.userId;

        if (!currentPassword || !newEmail || !confirmEmail) {
            return res.redirect('/profile?error=' + encodeURIComponent('All fields are required.'));
        }
        
        if (newEmail !== confirmEmail) {
            return res.redirect('/profile?error=' + encodeURIComponent('New Email does not match.'));
        }
        
        if (!newEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.redirect('/profile?error=' + encodeURIComponent('Invalid email format.'));
        }

        const existingUser = db.prepare(`
            SELECT id FROM users WHERE email = ? AND id != ?
        `).get(newEmail, userId);
        
        if (existingUser) {
            return res.redirect('/profile?error=' + encodeURIComponent('Email already in use.'));
        }
        
        const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
        
        const passwordMatch = await comparePassword(currentPassword, user.password_hash);
        if (!passwordMatch) {
            return res.redirect('/profile?error=' + encodeURIComponent('Current password is incorrect'));
        }

        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(newEmail, userId);
        
        res.redirect('/profile?success=' + encodeURIComponent('Email updated successfully'));
    } catch (error) {
        console.error('Error updating email:', error);
        res.redirect('/profile?error=' + encodeURIComponent('Failed to update email'));
    }
});

// Updates display name - prevent duplicates
router.post('/display-name', requireAuth, (req, res) => {
    try {
        const { displayName } = req.body;
        const userId = req.session.userId;
        
        if (!displayName || displayName.trim().length === 0) {
            return res.redirect('/profile?error=' + encodeURIComponent('Display name is required'));
        }

        // prevent duplicates
        const existing = db.prepare('SELECT id FROM users WHERE display_name = ? AND id != ?').get(displayName.trim(), userId);
        if (existing) {
            return res.redirect('/profile?error=' + encodeURIComponent('Display name already in use.'));
        }

        db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(displayName.trim(), userId);
        
        res.redirect('/profile?success=' + encodeURIComponent('Display name updated successfully'));
    } catch (error) {
        console.error('Error updating display name:', error);
        res.redirect('/profile?error=' + encodeURIComponent('Failed to update display name'));
    }
});

// Updates user profile customization options including name color and bio
router.post('/customization', requireAuth, (req, res) => {
    try {
        const { nameColor, bio } = req.body;
        const userId = req.session.userId;
        
        const colorRegex = /^#[0-9A-F]{6}$/i;
        if (nameColor && !colorRegex.test(nameColor)) {
            return res.redirect('/profile?error=' + encodeURIComponent('Invalid color format'));
        }
        
        db.prepare(`
            UPDATE users 
            SET name_color = ?,
                bio = ?
            WHERE id = ?
        `).run(nameColor, bio, userId);

        res.redirect('/profile?success=' + encodeURIComponent('Profile updated successfully'));
    } catch (error) {
        console.error('Error updating profile:', error);
        res.redirect('/profile?error=' + encodeURIComponent('Failed to update profile'));
    }
});

module.exports = router;