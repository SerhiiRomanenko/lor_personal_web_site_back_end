require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const dbModule = require('./database');
const { initDB, getAllAppointments, createAppointment, updateAppointment, deleteAppointment, getStats, getAllServices, createService, updateService, deleteService, getAllFaq, createFaq, updateFaq, deleteFaq, getAllSettings, updateSetting, getAllPhones, createPhone, updatePhone, deletePhone, getAllLocations, getAllLocationsAll, createLocation, updateLocation, deleteLocation, getLocationSchedules, upsertLocationSchedule, deleteLocationSchedule, getContactsData, bulkUpdateContacts, seedDefaults } = dbModule;

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';

// Build allowed CORS origins — env var takes priority, localhost for dev
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  /https:\/\/.*\.vercel\.app$/,
  /https:\/\/.*\.vercel\.domain$/,
  /https:\/\/.*\.vercel\.dev$/,
];
if (FRONTEND_ORIGIN) allowedOrigins.push(FRONTEND_ORIGIN);

app.use(cors({ origin: allowedOrigins }));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

// Simple session-like auth via header token
function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token === ADMIN_PASSWORD) return next();
  if (req.query.token === ADMIN_PASSWORD) return next();
  res.status(401).json({ error: 'Невірний пароль' });
}

// Serve client static files — only locally (Vercel hosts frontend in production)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client')));

  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'admin.html'));
  });

  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'login.html'));
  });
}

// API routes
app.post('/api/appointments', async (req, res) => {
  const { name, phone, service, preferred_date, appt_time, location_id } = req.body;
  if (!name || !phone || !service || !preferred_date) {
    return res.status(400).json({ error: 'Будь ласка, заповніть всі поля' });
  }
  const appointment = await createAppointment({ name, phone, service, preferred_date, appt_time, location_id: location_id || null });

  // Send Telegram notification
  if (process.env.TG_TOKEN && process.env.TG_CHAT_ID) {
    const text = `🩺 *Нова заявка на прийом*\n\n👤 *Ім'я:* ${name}\n📞 *Телефон:* ${phone}\n🏥 *Послуга:* ${service}\n📅 *Бажана дата:* ${preferred_date}`;
    try {
      await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TG_CHAT_ID, text, parse_mode: 'Markdown' })
      });
    } catch (err) {
      console.error('Telegram error:', err.message);
    }
  }

  res.json(appointment);
});

app.get('/api/appointments/stats', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'Потрібні from та to' });
  const stats = await getStats(from, to);
  res.json(stats);
});

app.get('/api/appointments', requireAuth, async (req, res) => {
  const { status, date_from, date_to, date, search } = req.query;
  const appointments = await getAllAppointments({ status, date_from: date || date_from, date_to: date || date_to, search });
  res.json(appointments);
});

app.patch('/api/appointments/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status, name, phone, service, preferred_date, appt_time, notes } = req.body;
  const updated = await updateAppointment(id, { status, name, phone, service, preferred_date, appt_time, notes });
  if (!updated) return res.status(404).json({ error: 'Не знайдено' });
  res.json(updated);
});

app.delete('/api/appointments/:id', requireAuth, async (req, res) => {
  await deleteAppointment(req.params.id);
  res.json({ ok: true });
});

// --- Services ---
app.get('/api/services', async (req, res) => { res.json(await getAllServices()); });
app.post('/api/services', requireAuth, async (req, res) => { res.json(await createService(req.body)); });
app.patch('/api/services/:id', requireAuth, async (req, res) => {
  const updated = await updateService(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Не знайдено' });
  res.json(updated);
});
app.delete('/api/services/:id', requireAuth, async (req, res) => { await deleteService(req.params.id); res.json({ ok: true }); });

// --- FAQ ---
app.get('/api/faq', async (req, res) => { res.json(await getAllFaq()); });
app.post('/api/faq', requireAuth, async (req, res) => { res.json(await createFaq(req.body)); });
app.patch('/api/faq/:id', requireAuth, async (req, res) => {
  const updated = await updateFaq(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Не знайдено' });
  res.json(updated);
});
app.delete('/api/faq/:id', requireAuth, async (req, res) => { await deleteFaq(req.params.id); res.json({ ok: true }); });

// --- Settings ---
app.get('/api/settings', async (req, res) => { res.json(await getAllSettings()); });
app.post('/api/settings', requireAuth, async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'Потрібне поле key' });
  res.json(await updateSetting(key, value || ''));
});

// --- Phones ---
app.get('/api/phones', async (req, res) => { res.json(await getAllPhones()); });
app.post('/api/phones', requireAuth, async (req, res) => { res.json(await createPhone(req.body)); });
app.patch('/api/phones/:id', requireAuth, async (req, res) => {
  const updated = await updatePhone(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Не знайдено' });
  res.json(updated);
});
app.delete('/api/phones/:id', requireAuth, async (req, res) => { await deletePhone(req.params.id); res.json({ ok: true }); });

// --- Locations ---
app.get('/api/locations', async (req, res) => { res.json(await getAllLocationsAll()); });
app.post('/api/locations', requireAuth, async (req, res) => { res.json(await createLocation(req.body)); });
app.patch('/api/locations/:id', requireAuth, async (req, res) => {
  const updated = await updateLocation(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Не знайдено' });
  res.json(updated);
});
app.delete('/api/locations/:id', requireAuth, async (req, res) => { await deleteLocation(req.params.id); res.json({ ok: true }); });

// --- Location Schedules ---
app.get('/api/locations/:id/schedules', async (req, res) => { res.json(await getLocationSchedules(req.params.id)); });
app.patch('/api/location-schedules', requireAuth, async (req, res) => { await upsertLocationSchedule(req.body); res.json({ ok: true }); });
app.delete('/api/location-schedules/:id', requireAuth, async (req, res) => { await deleteLocationSchedule(req.params.id); res.json({ ok: true }); });

// --- Contacts Combined ---
app.get('/api/contacts', async (req, res) => { res.json(await getContactsData()); });
app.post('/api/contacts/bulk', requireAuth, async (req, res) => { await bulkUpdateContacts(req.body); res.json({ ok: true }); });

// Health check — for UptimeRobot to keep Render awake
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Root redirect — only locally (Vercel hosts frontend in production)
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
  });
}

initDB().then(async () => {
  await seedDefaults();
  app.listen(PORT, () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch(err => {
  console.error('Failed to init database:', err);
  process.exit(1);
});
