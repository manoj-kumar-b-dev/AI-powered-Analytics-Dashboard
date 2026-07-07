const jwt = require('jsonwebtoken');
require('dotenv').config({path: './.env'});
async function run() {
  const secret = process.env.JWT_SECRET || 'secret';
  const token = jwt.sign({ userId: '111111111111111111111111', orgId: '222222222222222222222222', role: 'admin' }, secret);
  const res = await fetch('http://localhost:5000/analytics/6a48b8dcb9417ed174cd7176/kpi-mapping', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mappings: { revenue: 'col1' } })
  });
  console.log(res.status);
  console.log(await res.text());
}
run();
