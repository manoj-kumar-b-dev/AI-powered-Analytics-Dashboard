const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/user');
const Org = require('../src/models/org');
const Dashboard = require('../src/models/dashboard');
const RefreshToken = require('../src/models/refreshToken');

let mongoServer;

beforeAll(async () => {
  // Disconnect any default connection
  await mongoose.disconnect();
  
  // Start the in-memory mongo server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  // Clean up collections before each test run
  await User.deleteMany({});
  await Org.deleteMany({});
  await Dashboard.deleteMany({});
  await RefreshToken.deleteMany({});
});

describe('SaaS Analytics platform integration testing', () => {
  
  describe('Feature 1: JWT Auth + Refresh Token Rotation', () => {
    
    it('should register a new user, create an organization, and login successfully', async () => {
      // 1. Register User A
      const regRes = await request(app)
        .post('/auth/register')
        .send({
          name: 'Alice Cooper',
          email: 'alice@companyA.com',
          password: 'password123'
        });
      
      expect(regRes.status).toBe(201);
      expect(regRes.body).toHaveProperty('accessToken');
      expect(regRes.body.user.name).toBe('Alice Cooper');
      expect(regRes.body.user.role).toBe('owner');
      expect(regRes.body.user.orgId).toBeDefined();

      // Check organization was created
      const org = await Org.findById(regRes.body.user.orgId);
      expect(org).toBeDefined();
      expect(org.name).toBe("Alice Cooper's Workspace");
      expect(org.ownerId.toString()).toBe(regRes.body.user.userId.toString());

      // 2. Login User A
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@companyA.com',
          password: 'password123'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty('accessToken');
      
      // Verify cookie cookie-parser refresh token
      const cookies = loginRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/refreshToken=/);
    });

    it('should rotate refresh token and revoke family if reuse is detected', async () => {
      // Register
      const regRes = await request(app)
        .post('/auth/register')
        .send({
          name: 'Bob Builder',
          email: 'bob@build.com',
          password: 'password123'
        });
      
      const cookies = regRes.headers['set-cookie'];
      const rawCookieToken = cookies[0].split(';')[0].split('=')[1];

      // Refresh once -> Should succeed and rotate
      const refreshRes1 = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [`refreshToken=${rawCookieToken}`]);

      expect(refreshRes1.status).toBe(200);
      expect(refreshRes1.body).toHaveProperty('accessToken');
      
      const cookies2 = refreshRes1.headers['set-cookie'];
      const rotatedCookieToken = cookies2[0].split(';')[0].split('=')[1];
      expect(rotatedCookieToken).not.toBe(rawCookieToken);

      // Re-use first refresh token (simulated theft) -> should revoke the whole family
      const refreshRes2 = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [`refreshToken=${rawCookieToken}`]);

      expect(refreshRes2.status).toBe(403);
      expect(refreshRes2.body.error.message).toContain('revoked');

      // Verify that the second rotated token is now also invalid
      const refreshRes3 = await request(app)
        .post('/auth/refresh')
        .set('Cookie', [`refreshToken=${rotatedCookieToken}`]);
      
      expect(refreshRes3.status).toBe(403);
    });
  });

  describe('Feature 2: Multi-Tenant Workspace Isolation', () => {
    
    it('should prevent cross-org reads and updates', async () => {
      // 1. Create Org A / User A
      const userARes = await request(app)
        .post('/auth/register')
        .send({
          name: 'Alice',
          email: 'alice@orgA.com',
          password: 'password123'
        });
      const aliceToken = userARes.body.accessToken;
      const aliceOrgId = userARes.body.user.orgId;

      // 2. Create Org B / User B
      const userBRes = await request(app)
        .post('/auth/register')
        .send({
          name: 'Bob',
          email: 'bob@orgB.com',
          password: 'password123'
        });
      const bobToken = userBRes.body.accessToken;

      // 3. Alice creates a dashboard in Org A
      const dashboardRes = await request(app)
        .post('/dashboards')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({
          name: "Alice's Private Board",
          widgets: [],
          layout: []
        });
      
      expect(dashboardRes.status).toBe(201);
      const dashboardId = dashboardRes.body._id;

      // 4. Bob tries to access Alice's dashboard (directly by ID) -> Should fail with 404/403
      // Because Bob's query context will be scoped to Bob's orgId, the query findById(dashboardId)
      // will filter by: _id: dashboardId AND orgId: bobOrgId. Since Alice's dashboard has aliceOrgId,
      // the find query returns null, resulting in a 404 Not Found!
      const bobGetRes = await request(app)
        .get(`/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${bobToken}`);
      
      expect(bobGetRes.status).toBe(404);

      // 5. Bob tries to update Alice's dashboard -> Should fail with 404
      const bobPutRes = await request(app)
        .put(`/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ name: 'Hacked name' });
      
      expect(bobPutRes.status).toBe(404);

      // Verify that Alice can retrieve her dashboard normally
      const aliceGetRes = await request(app)
        .get(`/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      
      expect(aliceGetRes.status).toBe(200);
      expect(aliceGetRes.body.name).toBe("Alice's Private Board");
    });
  });
});
