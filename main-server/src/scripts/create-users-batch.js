// main-server/src/scripts/create-users-batch.js
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const fs = require('fs').promises;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createUsersFromFile(filePath) {
  console.log('\n=== Batch Create Users ===\n');

  try {
    // Read users from JSON file
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const users = JSON.parse(fileContent);

    if (!Array.isArray(users)) {
      throw new Error('File must contain an array of users');
    }

    console.log(`Found ${users.length} users to create\n`);

    const results = {
      created: [],
      skipped: [],
      errors: []
    };

    for (const user of users) {
      try {
        // Validate user data
        if (!user.email || !user.name || !user.password) {
          results.errors.push({
            email: user.email || 'unknown',
            error: 'Missing required fields'
          });
          continue;
        }

        // Check if user exists
        const existing = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [user.email]
        );

        if (existing.rows.length > 0) {
          results.skipped.push({
            email: user.email,
            reason: 'User already exists'
          });
          continue;
        }

        // Hash password
        const passwordHash = await bcrypt.hash(user.password, 10);

        // Create user
        const result = await pool.query(
          `INSERT INTO users (email, name, password_hash, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())
           RETURNING id, email, name, role`,
          [user.email, user.name, passwordHash, user.role || 'user']
        );

        results.created.push(result.rows[0]);
        console.log(`✓ Created user: ${user.email}`);

      } catch (error) {
        results.errors.push({
          email: user.email,
          error: error.message
        });
        console.error(`✗ Error creating user ${user.email}:`, error.message);
      }
    }

    // Print summary
    console.log('\n=== Summary ===\n');
    console.log(`Created: ${results.created.length}`);
    console.log(`Skipped: ${results.skipped.length}`);
    console.log(`Errors:  ${results.errors.length}`);

    if (results.skipped.length > 0) {
      console.log('\nSkipped users:');
      results.skipped.forEach(u => {
        console.log(`  - ${u.email}: ${u.reason}`);
      });
    }

    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(u => {
        console.log(`  - ${u.email}: ${u.error}`);
      });
    }

    console.log('');

  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: node create-users-batch.js <users.json>');
    process.exit(1);
  }

  createUsersFromFile(filePath);
}

module.exports = createUsersFromFile;