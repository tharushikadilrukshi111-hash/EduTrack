require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

async function seed() {
  const accounts = [
    { name: 'Demo Teacher', role: 'teacher', identifier: process.env.SEED_TEACHER_EMAIL?.trim().toLowerCase(), password: process.env.SEED_TEACHER_PASSWORD },
    { name: 'Demo Student', role: 'student', identifier: process.env.SEED_STUDENT_REG?.trim().toUpperCase(), password: process.env.SEED_STUDENT_PASSWORD },
  ];
  if (!process.env.MONGODB_URI || accounts.some(a => !a.identifier || !a.password)) {
    throw new Error('Complete MONGODB_URI and all SEED_* credentials in backend/.env first.');
  }
  await mongoose.connect(process.env.MONGODB_URI);
  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await User.updateOne({ identifier: account.identifier }, {
      $set: { name: account.name, role: account.role, passwordHash },
    }, { upsert: true });
    console.log(`Demo ${account.role} ready: ${account.identifier}`);
  }
  await mongoose.disconnect();
}
seed().catch(err => { console.error(err.message); process.exit(1); });
