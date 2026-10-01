const { query } = require('./db');

// Best-effort audit trail: a failed log write must never fail the user's action.
async function logActivity(user, action, details) {
  try {
    await query(
      'INSERT INTO activity_logs (user_id, user_name, action, details) VALUES ($1, $2, $3, $4)',
      [user?.id || null, user?.name || null, action, details || null]
    );
  } catch (err) {
    console.error('activity log failed:', err.message);
  }
}

module.exports = { logActivity };
