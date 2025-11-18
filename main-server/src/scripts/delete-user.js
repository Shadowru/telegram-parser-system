const readline = require('readline');
const { Pool } = require('pg');
const chalk = require('chalk');

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

async function deleteUser() {
  console.log(chalk.blue.bold('\n=== Delete User ===\n'));

  try {
    const email = await question('Email of user to delete: ');

    if (!email) {
      console.error(chalk.red('\nError: Email is required'));
      process.exit(1);
    }

    // Find user
    const userResult = await pool.query(
      'SELECT id, email, name, role FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      console.error(chalk.red('\nError: User not found'));
      process.exit(1);
    }

    const user = userResult.rows[0];

    console.log(chalk.yellow('\nUser to delete:'));
    console.log(`  ID:    ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name:  ${user.name}`);
    console.log(`  Role:  ${user.role}`);

    const confirm = await question(chalk.red('\nAre you sure you want to delete this user? (yes/no): '));

    if (confirm.toLowerCase() !== 'yes') {
      console.log(chalk.yellow('\nDeletion cancelled'));
      process.exit(0);
    }

    // Delete user
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

    console.log(chalk.green('\n✓ User deleted successfully\n'));

  } catch (error) {
    console.error(chalk.red('\nError deleting user:'), error.message);
    process.exit(1);
  } finally {
    rl.close();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  deleteUser();
}

module.exports = deleteUser;