import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map(s => s.trim())
  : [];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true); // dev: allow all
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure directories exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ===== JSON File Database =====
const DB_PATH = path.join(__dirname, 'db.json');

function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return { users: {}, groups: {}, expenses: {}, settlements: {}, paymentHistory: [] };
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

let db = loadDB();

function generateInviteCode() {
  return 'FIN-' + nanoid(6).toUpperCase();
}

// ===== Multer for QR uploads =====
// Simple multer setup using diskStorage
import multer from 'multer';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `qr-${Date.now()}-${nanoid(6)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG, JPG, JPEG, WebP files are allowed'));
  }
});

// ===== Helper: Recalculate settlements =====
function recalculateSettlements(groupId) {
  const group = db.groups[groupId];
  if (!group) return;

  const members = group.members || [];
  const groupExpenses = Object.values(db.expenses).filter(e => e.groupId === groupId);

  // Calculate net balances
  const balances = {};
  members.forEach(m => { balances[m.userId] = { name: m.name, amount: 0 }; });

  for (const expense of groupExpenses) {
    if (balances[expense.paidBy]) {
      balances[expense.paidBy].amount += expense.amount;
    }
    for (const p of expense.participants || []) {
      if (balances[p.userId]) {
        balances[p.userId].amount -= p.shareAmount;
      }
    }
  }

  // Remove old pending settlements for this group
  for (const [id, s] of Object.entries(db.settlements)) {
    if (s.groupId === groupId && s.status === 'pending') {
      delete db.settlements[id];
    }
  }

  // Greedy settlement algorithm
  const debtors = [];
  const creditors = [];

  for (const [userId, data] of Object.entries(balances)) {
    if (data.amount < -0.01) {
      debtors.push({ userId, name: data.name, amount: Math.abs(data.amount) });
    } else if (data.amount > 0.01) {
      creditors.push({ userId, name: data.name, amount: data.amount });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    if (amount > 0.01) {
      const id = uuidv4();
      db.settlements[id] = {
        id,
        groupId,
        fromUserId: debtors[i].userId,
        fromUserName: debtors[i].name,
        toUserId: creditors[j].userId,
        toUserName: creditors[j].name,
        amount: Math.round(amount * 100) / 100,
        status: 'pending',
        paidAt: null,
        createdAt: new Date().toISOString()
      };
    }
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount < 0.01) i++;
    if (creditors[j].amount < 0.01) j++;
  }

  saveDB(db);
}

// ============ USER ROUTES ============

app.post('/api/users', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const id = uuidv4();
    db.users[id] = { id, name: name.trim(), mobile: '', acceptsCash: false, qrImage: '', createdAt: new Date().toISOString() };
    saveDB(db);
    res.status(201).json({ id, name: name.trim() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.get('/api/users/:userId', (req, res) => {
  const user = db.users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.get('/api/users/:userId/payment-details', (req, res) => {
  const user = db.users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    userId: user.id,
    name: user.name,
    mobile: user.mobile || '',
    acceptsCash: !!user.acceptsCash,
    qrImage: user.qrImage || ''
  });
});

app.put('/api/users/:userId/payment-details', (req, res) => {
  const user = db.users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { mobile, acceptsCash } = req.body;
  user.mobile = mobile || '';
  user.acceptsCash = !!acceptsCash;
  saveDB(db);
  res.json({ success: true });
});

app.post('/api/users/:userId/payment-qr', upload.single('qr'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const user = db.users[req.params.userId];
    if (!user) return res.status(404).json({ error: 'User not found' });
    const qrPath = `/uploads/${req.file.filename}`;
    user.qrImage = qrPath;
    saveDB(db);
    res.json({ qrImage: qrPath });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to upload QR' });
  }
});

app.delete('/api/users/:userId/payment-qr', (req, res) => {
  const user = db.users[req.params.userId];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.qrImage) {
    const filePath = path.join(__dirname, user.qrImage);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  user.qrImage = '';
  saveDB(db);
  res.json({ success: true });
});

// ============ GROUP ROUTES ============

app.post('/api/groups', (req, res) => {
  try {
    const { name, description, createdBy, creatorName, members } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Group name is required' });
    if (!createdBy) return res.status(400).json({ error: 'Creator ID is required' });

    const id = uuidv4();
    const inviteCode = generateInviteCode();
    const now = new Date().toISOString();

    const groupMembers = [
      { id: uuidv4(), userId: createdBy, name: creatorName || 'Creator', joinedAt: now }
    ];

    if (members && Array.isArray(members)) {
      for (const m of members) {
        if (m.name && m.name.trim()) {
          const memberId = uuidv4();
          groupMembers.push({ id: uuidv4(), userId: memberId, name: m.name.trim(), joinedAt: now });
          if (!db.users[memberId]) {
            db.users[memberId] = { id: memberId, name: m.name.trim(), mobile: '', acceptsCash: false, qrImage: '', createdAt: now };
          }
        }
      }
    }

    db.groups[id] = {
      id,
      name: name.trim(),
      description: description || '',
      inviteCode,
      createdBy,
      members: groupMembers,
      createdAt: now
    };

    saveDB(db);

    res.status(201).json({
      ...db.groups[id],
      invite_code: inviteCode
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

app.get('/api/groups/user/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const userGroups = Object.values(db.groups).filter(g =>
      g.members.some(m => m.userId === userId)
    );

    const result = userGroups.map(g => {
      const groupExpenses = Object.values(db.expenses).filter(e => e.groupId === g.id);
      
      // Calculate balance
      const balances = {};
      g.members.forEach(m => { balances[m.userId] = 0; });
      
      for (const expense of groupExpenses) {
        if (balances[expense.paidBy] !== undefined) {
          balances[expense.paidBy] += expense.amount;
        }
        for (const p of expense.participants || []) {
          if (balances[p.userId] !== undefined) {
            balances[p.userId] -= p.shareAmount;
          }
        }
      }

      const totalSpent = groupExpenses.reduce((sum, e) => sum + e.amount, 0);

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        invite_code: g.inviteCode,
        created_by: g.createdBy,
        created_at: g.createdAt,
        memberCount: g.members.length,
        expenseCount: groupExpenses.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
        balance: Math.round((balances[userId] || 0) * 100) / 100,
        lastActivity: groupExpenses.length > 0
          ? groupExpenses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].createdAt
          : g.createdAt
      };
    });

    result.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

app.get('/api/groups/invite/:inviteCode', (req, res) => {
  const group = Object.values(db.groups).find(g => g.inviteCode === req.params.inviteCode);
  if (!group) return res.status(404).json({ error: 'Invalid invite code' });
  res.json({ ...group, invite_code: group.inviteCode, memberCount: group.members.length });
});

app.get('/api/groups/:groupId', (req, res) => {
  const group = db.groups[req.params.groupId];
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const groupExpenses = Object.values(db.expenses)
    .filter(e => e.groupId === group.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    ...group,
    invite_code: group.inviteCode,
    expenses: groupExpenses
  });
});

app.post('/api/groups/join', (req, res) => {
  try {
    const { inviteCode, userId, userName } = req.body;
    if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    const group = Object.values(db.groups).find(g => g.inviteCode === inviteCode);
    if (!group) return res.status(404).json({ error: 'Invalid invite code' });

    const existing = group.members.find(m => m.userId === userId);
    if (existing) {
      return res.json({ alreadyMember: true, groupId: group.id, group: { ...group, invite_code: group.inviteCode } });
    }

    group.members.push({
      id: uuidv4(),
      userId,
      name: userName || 'Member',
      joinedAt: new Date().toISOString()
    });

    saveDB(db);
    recalculateSettlements(group.id);

    res.json({ groupId: group.id, group: { ...group, invite_code: group.inviteCode } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// ============ MEMBER ROUTES ============

app.post('/api/groups/:groupId/members', (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const group = db.groups[req.params.groupId];
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const userId = uuidv4();
    if (!db.users[userId]) {
      db.users[userId] = { id: userId, name: name.trim(), mobile: '', acceptsCash: false, qrImage: '', createdAt: new Date().toISOString() };
    }

    group.members.push({
      id: uuidv4(),
      userId,
      name: name.trim(),
      joinedAt: new Date().toISOString()
    });

    saveDB(db);
    res.status(201).json({ userId, name: name.trim(), members: group.members });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

app.delete('/api/groups/:groupId/members/:userId', (req, res) => {
  try {
    const group = db.groups[req.params.groupId];
    if (!group) return res.status(404).json({ error: 'Group not found' });

    group.members = group.members.filter(m => m.userId !== req.params.userId);
    saveDB(db);
    recalculateSettlements(req.params.groupId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// ============ EXPENSE ROUTES ============

app.post('/api/groups/:groupId/expenses', (req, res) => {
  try {
    const { description, amount, paidBy, category, date, splitMethod, participants } = req.body;

    if (!description) return res.status(400).json({ error: 'Description is required' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required' });
    if (!paidBy) return res.status(400).json({ error: 'Paid by is required' });
    if (!participants || participants.length === 0) return res.status(400).json({ error: 'At least one participant is required' });

    const id = uuidv4();
    const method = splitMethod || 'equal';

    const processedParticipants = participants.map(p => {
      let shareAmount = 0;
      if (method === 'equal') {
        shareAmount = amount / participants.length;
      } else if (method === 'exact') {
        shareAmount = p.amount || 0;
      } else if (method === 'percentage') {
        shareAmount = (amount * (p.percentage || 0)) / 100;
      } else if (method === 'shares') {
        const totalShares = participants.reduce((sum, pp) => sum + (pp.shares || 1), 0);
        shareAmount = (amount * (p.shares || 1)) / totalShares;
      }

      return {
        userId: p.userId,
        name: p.name,
        shareAmount: Math.round(shareAmount * 100) / 100,
        shareValue: p.amount || p.percentage || p.shares || 0
      };
    });

    db.expenses[id] = {
      id,
      groupId: req.params.groupId,
      description,
      amount,
      paidBy,
      paidByName: participants.find(p => p.userId === paidBy)?.name || 
                  db.groups[req.params.groupId]?.members.find(m => m.userId === paidBy)?.name || 'Unknown',
      category: category || 'Other',
      date: date || new Date().toISOString().split('T')[0],
      splitMethod: method,
      participants: processedParticipants,
      createdAt: new Date().toISOString()
    };

    saveDB(db);
    recalculateSettlements(req.params.groupId);

    res.status(201).json(db.expenses[id]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

app.get('/api/groups/:groupId/expenses', (req, res) => {
  const groupExpenses = Object.values(db.expenses)
    .filter(e => e.groupId === req.params.groupId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(groupExpenses);
});

app.put('/api/expenses/:expenseId', (req, res) => {
  try {
    const expense = db.expenses[req.params.expenseId];
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    const { description, amount, paidBy, category, date, splitMethod, participants } = req.body;

    const newAmount = amount || expense.amount;
    const method = splitMethod || expense.splitMethod;

    if (participants && participants.length > 0) {
      const processedParticipants = participants.map(p => {
        let shareAmount = 0;
        if (method === 'equal') {
          shareAmount = newAmount / participants.length;
        } else if (method === 'exact') {
          shareAmount = p.amount || 0;
        } else if (method === 'percentage') {
          shareAmount = (newAmount * (p.percentage || 0)) / 100;
        } else if (method === 'shares') {
          const totalShares = participants.reduce((sum, pp) => sum + (pp.shares || 1), 0);
          shareAmount = (newAmount * (p.shares || 1)) / totalShares;
        }
        return {
          userId: p.userId,
          name: p.name,
          shareAmount: Math.round(shareAmount * 100) / 100,
          shareValue: p.amount || p.percentage || p.shares || 0
        };
      });
      expense.participants = processedParticipants;
    }

    expense.description = description || expense.description;
    expense.amount = newAmount;
    expense.paidBy = paidBy || expense.paidBy;
    expense.category = category || expense.category;
    expense.date = date || expense.date;
    expense.splitMethod = method;

    if (paidBy) {
      const group = db.groups[expense.groupId];
      expense.paidByName = group?.members.find(m => m.userId === paidBy)?.name || expense.paidByName;
    }

    saveDB(db);
    recalculateSettlements(expense.groupId);

    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

app.delete('/api/expenses/:expenseId', (req, res) => {
  const expense = db.expenses[req.params.expenseId];
  if (!expense) return res.status(404).json({ error: 'Expense not found' });

  const groupId = expense.groupId;
  delete db.expenses[req.params.expenseId];
  saveDB(db);
  recalculateSettlements(groupId);

  res.json({ success: true });
});

// ============ BALANCE ROUTES ============

app.get('/api/groups/:groupId/balances', (req, res) => {
  const group = db.groups[req.params.groupId];
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const groupExpenses = Object.values(db.expenses).filter(e => e.groupId === req.params.groupId);

  const balances = {};
  group.members.forEach(m => {
    balances[m.userId] = { userId: m.userId, name: m.name, amount: 0 };
  });

  for (const expense of groupExpenses) {
    if (balances[expense.paidBy]) {
      balances[expense.paidBy].amount += expense.amount;
    }
    for (const p of expense.participants || []) {
      if (balances[p.userId]) {
        balances[p.userId].amount -= p.shareAmount;
      }
    }
  }

  const result = Object.values(balances).map(b => ({
    ...b,
    amount: Math.round(b.amount * 100) / 100
  }));

  res.json(result);
});

// ============ SETTLEMENT ROUTES ============

app.get('/api/groups/:groupId/settlements', (req, res) => {
  const settlements = Object.values(db.settlements)
    .filter(s => s.groupId === req.params.groupId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(settlements);
});

app.post('/api/settlements/:settlementId/pay', (req, res) => {
  const settlement = db.settlements[req.params.settlementId];
  if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

  const paidAt = new Date().toISOString();
  settlement.status = 'paid';
  settlement.paidAt = paidAt;

  db.paymentHistory.push({
    id: uuidv4(),
    groupId: settlement.groupId,
    settlementId: settlement.id,
    fromUserName: settlement.fromUserName,
    toUserName: settlement.toUserName,
    amount: settlement.amount,
    paidAt
  });

  saveDB(db);
  res.json({ success: true, paidAt });
});

app.post('/api/settlements/:settlementId/unpay', (req, res) => {
  const settlement = db.settlements[req.params.settlementId];
  if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

  settlement.status = 'pending';
  settlement.paidAt = null;

  db.paymentHistory = db.paymentHistory.filter(h => h.settlementId !== settlement.id);
  saveDB(db);
  res.json({ success: true });
});

app.post('/api/settlements/:settlementId/reminder', (req, res) => {
  const settlement = db.settlements[req.params.settlementId];
  if (!settlement) return res.status(404).json({ error: 'Settlement not found' });

  const message = `Hey ${settlement.fromUserName} 👋\nYou have a pending payment of ₹${settlement.amount.toLocaleString('en-IN')} to ${settlement.toUserName} on fin.`;
  res.json({ message, settlement });
});

// ============ SHARE ROUTES ============

app.get('/api/groups/:groupId/share', (req, res) => {
  const group = db.groups[req.params.groupId];
  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json({
    groupName: group.name,
    inviteCode: group.inviteCode,
    shareUrl: `${req.protocol}://${req.get('host')}/join/${group.inviteCode}`
  });
});

// ============ PAYMENT HISTORY ============

app.get('/api/groups/:groupId/payment-history', (req, res) => {
  const history = (db.paymentHistory || [])
    .filter(h => h.groupId === req.params.groupId)
    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
  res.json(history);
});

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File size must be under 300KB' });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ===== Serve Frontend (Production) =====
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(frontendDistPath, 'index.html'));
    }
  });
}

app.listen(PORT, () => {
  console.log(`\n  🚀 FIN Backend running on http://localhost:${PORT}\n`);
});
