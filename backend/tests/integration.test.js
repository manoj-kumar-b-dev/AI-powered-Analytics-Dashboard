const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/user');
const Org = require('../src/models/org');
const DashboardPreference = require('../src/models/dashboardPreference');
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
  await DashboardPreference.deleteMany({});
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

      // 3. Bob tries to access Alice's organization -> Should fail with 403
      const bobGetOrgRes = await request(app)
        .get(`/orgs/${aliceOrgId}`)
        .set('Authorization', `Bearer ${bobToken}`);
      
      expect(bobGetOrgRes.status).toBe(403);

      // 4. Verify Alice can access her organization normally
      const aliceGetOrgRes = await request(app)
        .get(`/orgs/${aliceOrgId}`)
        .set('Authorization', `Bearer ${aliceToken}`);
      
      expect(aliceGetOrgRes.status).toBe(200);
      expect(aliceGetOrgRes.body._id).toBe(aliceOrgId.toString());
    });
  });
});
