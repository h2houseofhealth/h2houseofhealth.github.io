/**
 * Database Migration: Guest Checkout Support
 * 
 * Description:
 *   - Makes user_id nullable to support guest bookings
 *   - Adds guest_name, guest_email, guest_phone columns
 *   - Adds booking_type column to track user type (registered, google, guest)
 *   - Backward compatible: all existing bookings remain unchanged
 *   - Marks existing bookings as 'registered' type
 * 
 * Execution:
 *   This migration runs automatically when the server starts via initDb()
 *   in server.js. No manual execution needed.
 */

const migrations = {
  '001-guest-checkout': {
    up: (db) => {
      console.log('Running migration: Guest Checkout Support...');
      
      try {
        // Step 1: Add new columns for guest information
        db.exec(`
          ALTER TABLE bookings ADD COLUMN guest_name TEXT;
          ALTER TABLE bookings ADD COLUMN guest_email TEXT;
          ALTER TABLE bookings ADD COLUMN guest_phone TEXT;
          ALTER TABLE bookings ADD COLUMN booking_type TEXT NOT NULL DEFAULT 'registered';
        `);
        console.log('✓ Added guest columns and booking_type');

        // Step 2: Create indices for guest lookups and payment tracking
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_booking_guest_email ON bookings(guest_email);
          CREATE INDEX IF NOT EXISTS idx_booking_payment_order ON bookings(payment_order_id) WHERE payment_order_id IS NOT NULL;
        `);
        console.log('✓ Created indices for guest email and payment tracking');

        // Step 3: Mark Google users (optional enhancement)
        const googleUsers = db.prepare(`
          SELECT DISTINCT b.id FROM bookings b
          JOIN users u ON u.id = b.user_id
          WHERE u.google_id IS NOT NULL
        `).all();
        
        if (googleUsers.length > 0) {
          db.prepare(`UPDATE bookings SET booking_type = 'google' WHERE id = ?`).bind();
          for (const row of googleUsers) {
            db.prepare(`UPDATE bookings SET booking_type = 'google' WHERE id = ?`).run(row.id);
          }
          console.log(`✓ Marked ${googleUsers.length} Google user bookings`);
        }

        // Step 4: Verify migration
        const info = db.prepare(`PRAGMA table_info(bookings)`).all();
        const hasGuestColumns = info.some(col => col.name === 'guest_email') &&
                               info.some(col => col.name === 'guest_phone') &&
                               info.some(col => col.name === 'guest_name') &&
                               info.some(col => col.name === 'booking_type');
        
        if (hasGuestColumns) {
          console.log('✓ Migration completed successfully');
          return { success: true, message: 'Guest checkout support added' };
        } else {
          throw new Error('Migration verification failed: columns not found');
        }
      } catch (error) {
        console.error('✗ Migration failed:', error.message);
        throw error;
      }
    },

    down: (db) => {
      console.log('Rollback: Guest Checkout Support (this would remove guest columns)');
      console.log('⚠ Rollback not recommended - data loss risk');
      console.log('Manual rollback: Remove guest_name, guest_email, guest_phone, booking_type columns');
    }
  }
};

module.exports = migrations;
