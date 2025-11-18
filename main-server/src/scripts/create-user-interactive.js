// main-server/src/scripts/create-user-interactive.js
const inquirer = require('inquirer');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const chalk = require('chalk');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Please enter a valid email address';
  }

  // Check if email exists
  const result = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length > 0) {
    return 'User with this email already exists';
  }

  return true;
}

function validatePassword(password) {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return true;
}

async function createUser() {
  console.log(chalk.blue.bold('\n=== Create User ===\n'));

  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'email',
        message: 'Email:',
        validate: validateEmail
      },
      {
        type: 'input',
        name: 'name',
        message: 'Full Name:',
        validate: (input) => input.length >= 2 || 'Name must be at least 2 characters'
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        mask: '*',
        validate: validatePassword
      },
      {
        type: 'password',
        name: 'confirmPassword',
        message: 'Confirm Password:',
        mask: '*',
        validate: (input, answers) => {
          if (input !== answers.password) {
            return 'Passwords do not match';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'role',
        message: 'Role:',
        choices: [
          { name: 'User (Standard access)', value: 'user' },
          { name: 'Admin (Full access)', value: 'admin' }
        ],
        default: 'user'
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Create this user?',
        default: true
      }
    ]);

    if (!answers.confirm) {
      console.log(chalk.yellow('\nUser creation cancelled'));
      process.exit(0);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(answers.password, 10);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, email, name, role, created_at`,
      [answers.email, answers.name, passwordHash, answers.role]
    );

    const user = result.rows[0];

    console.log(chalk.green.bold('\n✓ User created successfully!\n'));
    console.log(chalk.cyan('User Details:'));
    console.log(`  ${chalk.gray('ID:')}      ${user.id}`);
    console.log(`  ${chalk.gray('Email:')}   ${user.email}`);
    console.log(`  ${chalk.gray('Name:')}    ${user.name}`);
    console.log(`  ${chalk.gray('Role:')}    ${user.role}`);
    console.log(`  ${chalk.gray('Created:')} ${user.created_at}`);
    console.log('');

  } catch (error) {
    console.error(chalk.red('\n✗ Error creating user:'), error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  createUser();
}

module.exports = createUser;