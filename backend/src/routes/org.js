const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const orgController = require('../controllers/orgController');

const router = express.Router();

// POST /orgs/:orgId/invite — Admin/Owner only, send invite
router.post('/:orgId/invite', requireAuth, requireRole('owner', 'admin'), orgController.invite);

// POST /orgs/invite/accept — Accept invite (public)
router.post('/invite/accept', orgController.acceptInvite);

// GET /orgs/:orgId — Get current organization details
router.get('/:orgId', requireAuth, orgController.getOrg);

module.exports = router;
