const jwt = require('jsonwebtoken');
require('dotenv').config({path: './.env'});

async function run() {
  const secret = process.env.JWT_SECRET || 'secret';
  console.log('Secret:', secret);
  const token = jwt.sign({ userId: '111111111111111111111111', orgId: '222222222222222222222222', role: 'admin' }, secret);
  const res = await fetch('http://localhost:5000/analytics/6a48b8dcb9417ed174cd7176/kpis', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}
run();
