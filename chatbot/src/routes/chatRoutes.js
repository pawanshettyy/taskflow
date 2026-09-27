/**
 * chatRoutes.js
 * -------------
 * Defines the REST API surface for the chatbot.
 */

const express = require('express');
const { postChat, deleteSession, getHealth } = require('../controllers/chatController');
const { validateChatRequest } = require('../middleware/validateRequest');

const router = express.Router();

// POST /api/chat -> send a message, get a reply + intent + confidence
router.post('/chat', validateChatRequest, postChat);

// DELETE /api/chat/session -> clear conversation context ("Clear chat")
router.delete('/chat/session', deleteSession);

// GET /api/health -> basic liveness check
router.get('/health', getHealth);

module.exports = router;
