require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function main() {
  const accounts = [
    {
      name: 'Demo Student',
      role: 'student',
      identifier: process.env.SEED_STUDENT_REG?.trim().toUpperCase(),
      email: process.env.SEED_STUDENT_EMAIL?.trim().toLowerCase(),
      password: process.env.SEED_STUDENT_PASSWORD
    },
    {
      name: 'Demo Teacher',
      role: 'teacher',
      identifier: process.env.SEED_TEACHER_EMAIL?.trim().toLowerCase(),
      email: process.env.SEED_TEACHER_EMAIL?.trim().toLowerCase(),
      password: process.env.SEED_TEACHER_PASSWORD
    }
  ];

  if (
    !process.env.MONGODB_URI ||
    accounts.some(
      account =>
        !account.identifier ||
        !account.email ||
        !account.password ||
        account.password.length < 8
    )
  ) {
    throw new Error('Check the MongoDB URI and demo credentials in .env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);

    await User.updateOne(
      { identifier: account.identifier },
      {
        $set: {
          name: account.name,
          role: account.role,
          identifier: account.identifier,
          email: account.email,
          passwordHash
        }
      },
      { upsert: true,
        runValidators: true }
    );

    console.log(`${account.role} account ready`);
  }

  await mongoose.disconnect();
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});