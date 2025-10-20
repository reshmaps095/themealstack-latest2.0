// seeders/admin-seeder.js (NEW FILE)
const bcrypt = require('bcryptjs');
const { sequelize } = require('../database');

const createAdminUser = async () => {
  try {
    // Check if admin already exists
    const [results] = await sequelize.query(
      "SELECT COUNT(*) as count FROM users WHERE email = 'rahul@yopmail.com'"
    );
    
    if (results[0].count > 0) {
      console.log('Admin user already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Insert admin user
    await sequelize.query(`
      INSERT INTO users (
        first_name, 
        last_name, 
        email, 
        phone, 
        password, 
        role, 
        is_active, 
        is_verified, 
        verification_status, 
        created_at, 
        updated_at
      ) VALUES (
        'Rahul',
        'Krishnan',
        'rahul@yopmail.com',
        '+91-9999999999',
        '${hashedPassword}',
        'admin',
        1,
        1,
        'verified',
        NOW(),
        NOW()
      )
    `);

    console.log('Admin user created successfully!');
    console.log('Email: rahul@yopmail.com');
    console.log('Password: admin123');
    
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
};

// Run if called directly
if (require.main === module) {
  createAdminUser();
}

module.exports = { createAdminUser };