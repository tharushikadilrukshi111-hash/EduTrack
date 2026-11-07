require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Student = require('./models/Student');

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

    const user = await User.findOneAndUpdate(
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

      {
        upsert: true,
        returnDocument: 'after',
        runValidators: true
      }

    );

    if (account.role === 'student') {
      await Student.updateOne(
        { userId: user._id },
        {
          $set: {
            registrationNumber: account.identifier
          }
        },
        {
          upsert: true,
          runValidators: true
        }
      );

      console.log('Student account and profile ready');
    } else {
      console.log(`${account.role} account ready`);
    }
  }

  await mongoose.disconnect();
}

main().catch(async error => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});
