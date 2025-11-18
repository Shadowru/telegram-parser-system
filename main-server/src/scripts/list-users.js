const { Pool } = require('pg');
const Table = require('cli-table3');
const chalk = require('chalk');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function listUsers() {
  console.log(chalk.blue.bold('\n=== Users List ===\n'));

  try {
    const result = await pool.query(`
      SELECT 
        id,
        email,
        name,
        role,
        last_login_at,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);

    if (result.rows.length === 0) {
      console.log(chalk.yellow('No users found'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('Email'),
        chalk.cyan('Name'),
        chalk.cyan('Role'),
        chalk.cyan('Last Login'),
        chalk.cyan('Created')
      ],
      colWidths: [5, 30, 20, 10, 20, 20]
    });

    result.rows.forEach(user => {
      table.push([
        user.id,
        user.email,
        user.name,
        user.role === 'admin' ? chalk.red(user.role) : user.role,
        user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never',
        new Date(user.created_at).toLocaleString()
      ]);
    });

    console.log(table.toString());
    console.log(chalk.gray(`\nTotal users: ${result.rows.length}\n`));

  } catch (error) {
    console.error(chalk.red('\nError listing users:'), error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  listUsers();
}

module.exports = listUsers;