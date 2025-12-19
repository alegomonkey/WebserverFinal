// /routes chat.js 
const express = require('express');
const router = express.Router();
const db = require('../database');

// Renders the main chat interface with recent messages and user information
router.get('/', (req, res) => {
    try {
        let messages = [];
        if (req.session.user) {
            messages = db.prepare(`
                SELECT cm.*, 
                       u.username, u.display_name, u.name_color
                FROM chat_messages cm
                JOIN users u ON cm.user_id = u.id
                ORDER BY cm.created_at DESC
                LIMIT 50
            `).all();
            

            messages.forEach(msg => {
                if (msg.created_at) {
                    const date = new Date(msg.created_at);
                    msg.formattedTime = date.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            });
            
            messages.reverse();
        }
        
        res.render('chat', {
            title: 'Town Square - Live Chat',
            messages: messages,
            currentUser: req.session.user || null
        });
    } catch (error) {
        console.error('Error loading chat:', error);
        res.status(500).render('error', {
            title: 'Error - Wild West Chat',
            message: 'Failed to load chat'
        });
    }
});

// Returns paginated chat history as JSON for authenticated users with limit and before parameters
router.get('/history', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.status(401).json({ 
            success: false, 
            error: 'Authentication required' 
        });
    }
    
    try {
        const limit = parseInt(req.query.limit) || 50;
        const before = req.query.before;
        
        let query = `
            SELECT cm.*, 
                   u.username, u.display_name, u.name_color
            FROM chat_messages cm
            JOIN users u ON cm.user_id = u.id
        `;
        
        const params = [];
        
        if (before) {
            query += ` WHERE cm.created_at < ?`;
            params.push(before);
        }
        
        query += ` ORDER BY cm.created_at DESC LIMIT ?`;
        params.push(limit);
        
        const stmt = db.prepare(query);
        const messages = stmt.all(...params);
        
        res.json({
            success: true,
            messages: messages.reverse()
        });
    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch chat history' 
        });
    }
});

module.exports = router;