// main-server/src/scripts/create-user.js
const readline = require('readline');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function createUser() {
  console.log('\n=== Create User ===\n');

  try {
    // Get user input
    const email = await question('Email: ');
    const name = await question('Name: ');
    const password = await question('Password: ');
    const role = await question('Role (admin/user) [user]: ') || 'user';

    // Validate input
    if (!email || !name || !password) {
      console.error('\nError: Email, name, and password are required');
      process.exit(1);
    }

    if (!['admin', 'user'].includes(role)) {
      console.error('\nError: Role must be either "admin" or "user"');
      process.exit(1);
    }

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.error('\nError: User with this email already exists');
      process.exit(1);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, name, role, created_at`,
      [email, name, passwordHash, role]
    );

    const user = result.rows[0];

    console.log('\n✓ User created successfully!\n');
    console.log('User Details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Created: ${user.created_at}`);
    console.log('');

  } catch (error) {
    console.error('\nError creating user:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  createUser();
}

module.exports = createUser;