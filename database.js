const mongoose = require('mongoose');
mongoose.set('toJSON', { virtuals: true, versionKey: false });

const MONGODB_URI = process.env.MONGODB_URI;

async function initDB() {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 20000,
    socketTimeoutMS: 45000,
  });
  console.log('MongoDB connected');
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected, reconnecting...');
});
mongoose.connection.on('error', err => {
  console.error('MongoDB error:', err.message);
});

// ---- Schemas ----
const appointmentSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true },
    phone:         { type: String, required: true },
    service:       { type: String, required: true },
    preferred_date:{ type: String, required: true },
    appt_time:     String,
    status:        { type: String, required: true, default: 'pending' },
    notes:         String,
    location_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
    created_at:    { type: Date, default: Date.now },
  },
  { timestamps: false }
);
appointmentSchema.virtual('id').get(function() { return this._id.toString(); });

const serviceSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  description: { type: String, required: true },
  price:       { type: String, required: true },
  duration:    { type: Number, default: 30 },
  icon:        { type: String, default: 'activity' },
  sort_order:  { type: Number, default: 0 },
});
serviceSchema.virtual('id').get(function() { return this._id.toString(); });

const faqSchema = new mongoose.Schema({
  question:   { type: String, required: true },
  answer:     { type: String, required: true },
  sort_order: { type: Number, default: 0 },
});
faqSchema.virtual('id').get(function() { return this._id.toString(); });

const settingsSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: String, required: true },
});
settingsSchema.virtual('id').get(function() { return this._id.toString(); });

const phoneSchema = new mongoose.Schema({
  phone:      { type: String, required: true },
  sort_order: { type: Number, default: 0 },
});
phoneSchema.virtual('id').get(function() { return this._id.toString(); });

const locationSchema = new mongoose.Schema({
  city:      { type: String, default: '' },
  street:    { type: String, default: '' },
  building:  { type: String, default: '' },
  is_active: { type: Boolean, default: true },
});
locationSchema.virtual('id').get(function() { return this._id.toString(); });

const locationScheduleSchema = new mongoose.Schema({
  location_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  day_of_week:  { type: Number, required: true, min: 0, max: 6 },
  start_time:   { type: String, required: true },
  end_time:     { type: String, required: true },
  lunch_start:  String,
  lunch_end:    String,
});
locationScheduleSchema.virtual('id').get(function() { return this._id.toString(); });

// ---- Models ----
const Appointment        = mongoose.model('Appointment',        appointmentSchema);
const Service            = mongoose.model('Service',            serviceSchema);
const Faq                = mongoose.model('Faq',                faqSchema);
const Setting            = mongoose.model('Setting',            settingsSchema);
const Phone              = mongoose.model('Phone',              phoneSchema);
const Location           = mongoose.model('Location',           locationSchema);
const LocationSchedule   = mongoose.model('LocationSchedule',   locationScheduleSchema);

// ---- Appointments ----
async function getAllAppointments(filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.date_from) query.preferred_date = { $gte: filters.date_from };
  if (filters.date_to) query.preferred_date = { ...query.preferred_date, $lte: filters.date_to };
  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: 'i' } },
      { phone: { $regex: filters.search, $options: 'i' } },
      { service: { $regex: filters.search, $options: 'i' } },
    ];
  }
  return Appointment.find(query).sort({ created_at: -1 });
}

async function getAppointment(id) {
  return Appointment.findById(id);
}

async function createAppointment({ name, phone, service, preferred_date, appt_time, notes, location_id }) {
  return Appointment.create({
    name, phone, service, preferred_date,
    appt_time: appt_time || null,
    notes: notes || null,
    status: 'pending',
    location_id: location_id || null,
  });
}

async function updateAppointment(id, updates) {
  const allowed = ['status', 'name', 'phone', 'service', 'preferred_date', 'appt_time', 'notes'];
  const doc = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) doc[key] = updates[key];
  }
  if (Object.keys(doc).length === 0) return getAppointment(id);
  return Appointment.findByIdAndUpdate(id, doc, { new: true });
}

async function deleteAppointment(id) {
  return Appointment.findByIdAndDelete(id);
}

async function getStats(dateFrom, dateTo) {
  return Appointment.aggregate([
    { $match: { preferred_date: { $gte: dateFrom, $lte: dateTo } } },
    { $group: { _id: { date: '$preferred_date', status: '$status' }, count: { $sum: 1 } } },
    { $project: { date: '$_id.date', status: '$_id.status', count: 1, _id: 0 } },
    { $sort: { date: 1, status: 1 } },
  ]);
}

// ---- Services ----
async function getAllServices() {
  return Service.find().sort({ sort_order: 1, _id: 1 });
}

async function createService({ name, description, price, duration, icon, sort_order }) {
  return Service.create({ name, description, price, duration: duration || 30, icon: icon || 'activity', sort_order: sort_order || 0 });
}

async function updateService(id, updates) {
  const allowed = ['name', 'description', 'price', 'duration', 'icon', 'sort_order'];
  const doc = {};
  for (const key of allowed) { if (updates[key] !== undefined) doc[key] = updates[key]; }
  if (Object.keys(doc).length === 0) return Service.findById(id);
  return Service.findByIdAndUpdate(id, doc, { new: true });
}

async function deleteService(id) {
  return Service.findByIdAndDelete(id);
}

// ---- FAQ ----
async function getAllFaq() {
  return Faq.find().sort({ sort_order: 1, _id: 1 });
}

async function createFaq({ question, answer, sort_order }) {
  return Faq.create({ question, answer, sort_order: sort_order || 0 });
}

async function updateFaq(id, updates) {
  const allowed = ['question', 'answer', 'sort_order'];
  const doc = {};
  for (const key of allowed) { if (updates[key] !== undefined) doc[key] = updates[key]; }
  if (Object.keys(doc).length === 0) return Faq.findById(id);
  return Faq.findByIdAndUpdate(id, doc, { new: true });
}

async function deleteFaq(id) {
  return Faq.findByIdAndDelete(id);
}

// ---- Settings ----
async function getAllSettings() {
  const rows = await Setting.find();
  const obj = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  return obj;
}

async function updateSetting(key, value) {
  return Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
}

// ---- Phones ----
async function getAllPhones() {
  return Phone.find().sort({ sort_order: 1, _id: 1 });
}

async function createPhone({ phone, sort_order }) {
  return Phone.create({ phone, sort_order: sort_order || 0 });
}

async function updatePhone(id, updates) {
  const allowed = ['phone', 'sort_order'];
  const doc = {};
  for (const key of allowed) { if (updates[key] !== undefined) doc[key] = updates[key]; }
  if (Object.keys(doc).length === 0) return Phone.findById(id);
  return Phone.findByIdAndUpdate(id, doc, { new: true });
}

async function deletePhone(id) {
  return Phone.findByIdAndDelete(id);
}

// ---- Locations ----
async function getAllLocations() {
  return Location.find({ is_active: true }).sort({ _id: 1 });
}

async function getAllLocationsAll() {
  return Location.find().sort({ _id: 1 });
}

async function createLocation({ city, street, building }) {
  return Location.create({ city: city || '', street: street || '', building: building || '', is_active: true });
}

async function updateLocation(id, updates) {
  const allowed = ['city', 'street', 'building', 'is_active'];
  const doc = {};
  for (const key of allowed) { if (updates[key] !== undefined) doc[key] = updates[key]; }
  if (Object.keys(doc).length === 0) return Location.findById(id);
  return Location.findByIdAndUpdate(id, doc, { new: true });
}

async function deleteLocation(id) {
  await LocationSchedule.deleteMany({ location_id: id });
  return Location.findByIdAndDelete(id);
}

// ---- Location Schedules ----
async function getLocationSchedules(locationId) {
  return LocationSchedule.find({ location_id: locationId }).sort({ day_of_week: 1 });
}

async function upsertLocationSchedule({ location_id, day_of_week, start_time, end_time, lunch_start, lunch_end }) {
  await LocationSchedule.deleteMany({ location_id, day_of_week });
  return LocationSchedule.create({ location_id, day_of_week, start_time, end_time, lunch_start: lunch_start || null, lunch_end: lunch_end || null });
}

async function deleteLocationSchedule(id) {
  return LocationSchedule.findByIdAndDelete(id);
}

// ---- Bulk & Combined ----
async function getContactsData() {
  const phones = await Phone.find().sort({ sort_order: 1, _id: 1 });
  const locations = await Location.find({ is_active: true }).sort({ _id: 1 });
  const schedules = {};
  for (const loc of locations) {
    schedules[loc._id.toString()] = await LocationSchedule.find({ location_id: loc._id }).sort({ day_of_week: 1 });
  }
  return { phones, locations, schedules };
}

async function bulkUpdateContacts({ phones: phonesData, locations: locationsData }) {
  // Phones: delete all, re-insert
  await Phone.deleteMany({});
  if (phonesData && phonesData.length > 0) {
    await Phone.insertMany(phonesData.map((p, i) => ({ phone: p.phone, sort_order: p.sort_order ?? i })));
  }

  // Locations: update existing or create new
  if (locationsData) {
    for (const loc of locationsData) {
      let locId;
      if (loc.id) {
        // MongoDB uses _id, but we're receiving 'id' from the frontend
        locId = loc.id;
        await Location.findByIdAndUpdate(locId, {
          city: loc.city || '', street: loc.street || '', building: loc.building || '', is_active: true
        }, { upsert: true });
        // Replace schedules
        await LocationSchedule.deleteMany({ location_id: locId });
      } else {
        const newLoc = await Location.create({
          city: loc.city || '', street: loc.street || '', building: loc.building || '', is_active: true
        });
        locId = newLoc._id.toString();
      }
      // Insert schedules
      if (loc.schedules && loc.schedules.length > 0) {
        const schedDocs = loc.schedules.map(s => ({
          location_id: locId,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          lunch_start: s.lunch_start || null,
          lunch_end: s.lunch_end || null,
        }));
        await LocationSchedule.insertMany(schedDocs);
      }
    }
  }
}

// ---- Seed defaults ----
async function seedDefaults() {
  const svcCount = await Service.countDocuments();
  if (svcCount === 0) {
    const defaults = [
      { name: 'Консультація ЛОР-лікаря', description: 'Огляд, діагноз, індивідуальний план лікування', price: 'від 700 ₴', duration: 30, icon: 'info', sort_order: 0 },
      { name: 'Перевірка слуху (аудіометрія)', description: 'Комп\'ютерна тест-аудіометрія 500-8000 Гц', price: 'від 500 ₴', duration: 30, icon: 'activity', sort_order: 1 },
      { name: 'Ендоскопія порожнини носа', description: 'Огляд з використанням ендоскопа, фіксація на відео', price: 'від 1 200 ₴', duration: 30, icon: 'settings', sort_order: 2 },
      { name: 'Ендоскопія глотки та гортані', description: 'Огляд задньої стінки глотки, мигдаликів, голосових зв\'язок', price: 'від 1 000 ₴', duration: 20, icon: 'settings', sort_order: 3 },
      { name: 'Лікування отиту гострого', description: 'Комплексна терапія, призначення антибіотиків, крапель', price: 'від 800 ₴', duration: 30, icon: 'upload', sort_order: 4 },
      { name: 'Лікування отиту хронічного', description: 'Довгострокова терапія, санация, фізіотерапія', price: 'від 1 000 ₴', duration: 45, icon: 'upload', sort_order: 5 },
      { name: 'Лікування синуситу', description: 'Промивання «кукушка», антибіотикотерапія, дренаж', price: 'від 600 ₴', duration: 45, icon: 'droplet', sort_order: 6 },
      { name: 'Промивання пазух «Кукушка»', description: 'Катетарно-струменеве промивання носових пазух', price: 'від 500 ₴', duration: 20, icon: 'droplet', sort_order: 7 },
      { name: 'Промивання вуха (ірригація)', description: 'Професійне очищення вушного каналу від сірки', price: 'від 400 ₴', duration: 15, icon: 'droplet', sort_order: 8 },
      { name: 'Видалення сірчаного затора (кератону)', description: 'Механічне видалення під контролем отоскопа', price: 'від 500 ₴', duration: 20, icon: 'activity', sort_order: 9 },
      { name: 'Парацентез барабанної перетинки', description: 'Мініінвазивна процедура з подальшим лікуванням', price: 'від 1 500 ₴', duration: 45, icon: 'settings', sort_order: 10 },
      { name: 'Видалення поліпів носа', description: 'Хірургічне та лазерне видалення під місцевим знеболенням', price: 'від 5 000 ₴', duration: 60, icon: 'shield', sort_order: 11 },
      { name: 'Аденотомія', description: 'Видалення аденоїдів класичним методом', price: 'від 6 000 ₴', duration: 60, icon: 'activity', sort_order: 12 },
      { name: 'Ендоскопічна аденотомія', description: 'Контрольоване видалення аденоїдів під відеоконтролем', price: 'від 9 000 ₴', duration: 90, icon: 'activity', sort_order: 13 },
      { name: 'Тонзилектомія', description: 'Видалення мигдаликів (обидва)', price: 'від 7 000 ₴', duration: 90, icon: 'shield', sort_order: 14 },
      { name: 'Конхотомія', description: 'Видалення/звуження нижньої носової раковини', price: 'від 4 000 ₴', duration: 60, icon: 'shield', sort_order: 15 },
      { name: 'Септопластика', description: 'Виправлення перегородки носа', price: 'від 12 000 ₴', duration: 120, icon: 'shield', sort_order: 16 },
      { name: 'Лікування алергічного риніту', description: 'Діагностика алергенів, імунотерапія, підбір медикаментів', price: 'від 900 ₴', duration: 30, icon: 'coffee', sort_order: 17 },
      { name: 'Лікування вазомоторного риніту', description: 'Терапія, лазер, електрокоагуляція', price: 'від 800 ₴', duration: 30, icon: 'coffee', sort_order: 18 },
      { name: 'Лікування частого чхання (риніт)', description: 'Визначення причини, підбір терапії', price: 'від 600 ₴', duration: 20, icon: 'coffee', sort_order: 19 },
      { name: 'Лазерне лікування носових出血', description: 'Коагуляція судин при регулярних носових кривавленнях', price: 'від 1 500 ₴', duration: 30, icon: 'droplet', sort_order: 20 },
      { name: 'Електрокоагуляція судин носа', description: 'Профілактика носових кривавлень', price: 'від 1 200 ₴', duration: 30, icon: 'droplet', sort_order: 21 },
      { name: 'Постановка вушних труб (гуми)', description: 'Для лікування рецидивуючого отиту', price: 'від 3 000 ₴', duration: 45, icon: 'settings', sort_order: 22 },
      { name: 'Лікування храпу (Laser-assisted uvulopalatoplasty)', description: 'Лазерна корекція м\'якого піднебіння', price: 'від 4 000 ₴', duration: 60, icon: 'settings', sort_order: 23 },
      { name: 'Діагностика апное сну (ЛОР-аспект)', description: 'Огляд, оцінка факторів ризику, планування', price: 'від 1 500 ₴', duration: 45, icon: 'info', sort_order: 24 },
      { name: 'Дитяча отоларингологія', description: 'Прийом дітей від 3 років, лікування без стресу', price: 'від 700 ₴', duration: 30, icon: 'users', sort_order: 25 },
      { name: 'Лікування аденоїдів у дітей (консервативне)', description: 'Медикаментозна терапія, промивання, фізіотерапія', price: 'від 900 ₴', duration: 30, icon: 'users', sort_order: 26 },
      { name: 'Лікування тонзиліту у дітей', description: 'Комплексна терапія гострого та хронічного запалення мигдаликів', price: 'від 800 ₴', duration: 30, icon: 'users', sort_order: 27 },
      { name: 'Лікування отиту у дітей', description: 'Безболісне лікування, знімок отоскопом, краплі', price: 'від 800 ₴', duration: 30, icon: 'users', sort_order: 28 },
      { name: 'Післяопераційний огляд', description: 'Перевірка стану після процедури, зняття швів', price: 'від 400 ₴', duration: 15, icon: 'info', sort_order: 29 },
      { name: 'Консультація за висновками МРТ/КТ', description: 'Інтерпретація результатів обстеження', price: 'від 600 ₴', duration: 20, icon: 'info', sort_order: 30 },
      { name: 'Складення медичної довідки', description: 'Для навчальних закладів, басейну, спорту', price: 'від 300 ₴', duration: 10, icon: 'info', sort_order: 31 },
      { name: 'Лікування лабіодингіту (тріщин губ)', description: 'Підбір місцевих препаратів, діагностика причини', price: 'від 500 ₴', duration: 15, icon: 'droplet', sort_order: 32 },
      { name: 'Лікування фарингіту (гострого, атрофічного)', description: 'Місцева терапія, фізіопроцедури, інгаляції', price: 'від 600 ₴', duration: 20, icon: 'coffee', sort_order: 33 },
      { name: 'Лікування ларингіту', description: 'Медикаментозна терапія, інгаляції, режим мовчання', price: 'від 700 ₴', duration: 25, icon: 'coffee', sort_order: 34 },
      { name: 'Лікування трахеїту', description: 'Комплексна терапія, бронхоскопія за показаннями', price: 'від 700 ₴', duration: 30, icon: 'coffee', sort_order: 35 },
      { name: 'Розширена консультація ЛОР-лікаря', description: 'Детальний огляд, аналіз анамнезу, консультація 45 хв', price: 'від 1 200 ₴', duration: 45, icon: 'info', sort_order: 36 },
      { name: 'Домашня консультація', description: 'Виклик лікаря додому (м. Буча)', price: 'від 2 000 ₴', duration: 60, icon: 'info', sort_order: 37 },
      { name: 'Онлайн-консультація', description: 'З\'язок через Zoom/Telegram, попередня оцінка', price: 'від 500 ₴', duration: 20, icon: 'info', sort_order: 38 },
      { name: 'Видалення папілом гортані', description: 'Ендоскопічне видалення під загальним наркозом', price: 'від 10 000 ₴', duration: 90, icon: 'shield', sort_order: 39 },
      { name: 'Лікування гіпертрофії мигдаликів', description: 'Медикаментозна терапія, криодеструкція', price: 'від 900 ₴', duration: 30, icon: 'coffee', sort_order: 40 },
      { name: 'Кріодеструкція мигдаликів', description: 'Вплив рідким азотом для зменшення тканини', price: 'від 1 500 ₴', duration: 30, icon: 'settings', sort_order: 41 },
      { name: 'Лікування хронічного риносинуситу', description: 'Терапія, промивання, фізіотерапія', price: 'від 900 ₴', duration: 30, icon: 'droplet', sort_order: 42 },
      { name: 'Фізіотерапія (ЛОР)', description: 'Лазер, УВЧ, електрофорез — 1 процедура', price: 'від 300 ₴', duration: 20, icon: 'activity', sort_order: 43 },
      { name: 'Аллергопроба (направлення)', description: 'Підготовка, направлення, консультація алерголога', price: 'від 500 ₴', duration: 15, icon: 'coffee', sort_order: 44 },
      { name: 'Лікування мукоcele (кисти пазухи)', description: 'Хірургічне видалення, санация', price: 'від 8 000 ₴', duration: 90, icon: 'shield', sort_order: 45 },
      { name: 'Лікування перфорації барабанної перетинки', description: 'Консервативне / хірургічне (тімпанопластика)', price: 'від 15 000 ₴', duration: 120, icon: 'shield', sort_order: 46 },
      { name: 'Етамбул (чистка вух)', description: 'Професійна гігієна зухів під мікроскопом', price: 'від 600 ₴', duration: 30, icon: 'droplet', sort_order: 47 },
      { name: 'Лікування еустахієвого запалення', description: 'Бужування, заміни, фізіотерапія', price: 'від 700 ₴', duration: 25, icon: 'coffee', sort_order: 48 },
      { name: 'Бужування слухової труби (Полице)', description: 'Відновлення вентиляції та дренажу', price: 'від 600 ₴', duration: 15, icon: 'activity', sort_order: 49 },
    ];
    await Service.insertMany(defaults);
  }

  const faqCount = await Faq.countDocuments();
  if (faqCount === 0) {
    const faqDefaults = [
      { question: 'Чи потрібно приходити за попереднім записом?', answer: 'Так, прийом ведеться виключно за попереднім записом. Це дозволяє уникнути черги та отримати якісну консультацію без очікування.', sort_order: 0 },
      { question: 'Чи лікуєте ви дітей?', answer: 'Так, приймаємо дітей від 3 років. Дитячий прийом проходить у дружній атмосфері, з урахуванням вікових особливостей лікування.', sort_order: 1 },
      { question: 'Які способи оплати приймаються?', answer: 'Готівка, безготівкова оплата картою, Apple Pay / Google Pay. Чеки та акти вимоги надаємо за бажанням.', sort_order: 2 },
      { question: 'Чи видається медична довідка?', answer: 'Так, видаємо всі необхідні медичні довідки, висновки, направлення. Документи оформлюються протягом прийому або протягом 1 дня для аналізів.', sort_order: 3 },
      { question: 'Скільки триває прийом?', answer: 'Звичайна консультація — 20-30 хвилин. При необхідності процедур або розширеного огляду — до 1 години.', sort_order: 4 },
      { question: 'Як підготуватися до ендоскопії носа?', answer: 'Спеціальної підготовки не потребує. Рекомендуємо не їсти за 1 годину до процедури. Перед прийомом повідомте про прийом ліків.', sort_order: 5 },
      { question: 'Чи болить ендоскопія носа?', answer: 'Процедура практично безболісна — використовується знеболювальний спрей. Відчуття дискомфортні, але терпимі.', sort_order: 6 },
      { question: 'Як проходитиме аденотомія?', answer: 'Операція триває 30-60 хв під місцевим або загальним знеболенням (для дітей). Госпіталізація на 1 день або амбулаторно.', sort_order: 7 },
      { question: 'Що буде після операції?', answer: 'Призначимо післяопераційні огляди на 3-й та 10-й день. Даммо детальні рекомендації щодо догляду та лікування.', sort_order: 8 },
      { question: 'Чи є гарантія на хірургічні процедури?', answer: 'Так, надаємо гарантію на якість виконаних процедур. При виникненні ускладнень — безкоштовне лікування в межах гарантії.', sort_order: 9 },
      { question: 'Можна скасувати запис?', answer: 'Так, скасувати або перенести запис можна за 4 години до нього — через телефон або онлайн.', sort_order: 10 },
      { question: 'Чи працюєте ви за програмою ОСЦМД?', answer: 'Наразі ми працюємо на комерційній основі. Консультація щодо ОСЦМД — на прийомі.', sort_order: 11 },
      { question: 'Які документи взяти на перший прийом?', answer: 'Паспорт (або довідку про народження для дітей), медичну картку, результати попередніх обстежень, якщо є.', sort_order: 12 },
      { question: 'Dekretний лист можна отримати?', answer: 'Так, лікар призначає непрацездатність за медичними показаннями. Dokument оформлюється електронно.', sort_order: 13 },
      { question: 'Чи можна прийти без направлення педіатра?', answer: 'Так, направлення не потрібне. Ви можете звернутися до нас безпосередньо.', sort_order: 14 },
      { question: 'Як проходить промивання «кукушка»?', answer: 'Пацієнт лежить на спині, через один ніздрю подається розчин, через інший — відсмоктується разом із гнійним вмістом. Тривалість 10-15 хв.', sort_order: 15 },
      { question: 'Скільки процедур «кукушка» потрібно?', answer: 'Зазвичай 5-10 процедур через день. Точну кількість лікар визначає після огляду.', sort_order: 16 },
      { question: 'Чи лікуєте поліпи носа без операції?', answer: 'На ранніх стадіях можливе медикаментозне лікування. При великих поліпах — лазерне або хірургічне видалення.', sort_order: 17 },
      { question: 'Як зрозуміти, що потрібен ЛОР-лікар?', answer: 'Біль у вусі, закладеність, застуда довше 7 днів, біль при ковтанні, храп, втрата слуху — приводи для консультації.', sort_order: 18 },
      { question: 'Чи можна отримати результати МРТ у вас?', answer: 'Так, ми інтерпретуємо результати МРТ/КТ ЛОР-органів. Консультація за висновками — 400₴.', sort_order: 19 },
      { question: 'Чи робите ви видалення мигдаликів?', answer: 'Так, тонзилектомія виконується під місцевим знеболенням. Перед операцією потрібен загальний аналіз крові та ЕКГ.', sort_order: 20 },
      { question: 'Чи лікуєте ви храп?', answer: 'Так, проводимо діагностику причин храпу та апное сну. Лікування: лазер, ЛОР-терапія, операція за показаннями.', sort_order: 21 },
      { question: 'Можна оплатити частинами?', answer: 'Так, можлива оплата карткою частинами (сервіс Split). Деталі — на рецепції.', sort_order: 22 },
      { question: 'Як зв\'язатися з лікарем після прийому?', answer: 'Ви можете написати у WhatsApp/Viber для уточнень. Відповідь протягом кількох годин у робочий час.', sort_order: 23 },
      { question: 'Чи робите ви домашні візити?', answer: 'Так, доступний виклик лікаря додому (м. Буча та околиці). Вартість — від 2000₴.', sort_order: 24 },
    ];
    await Faq.insertMany(faqDefaults);
  }

  const setCount = await Setting.countDocuments();
  if (setCount === 0) {
    const settingsDefaults = [
      { key: 'phones', value: JSON.stringify(['068 864 67 40']) },
      { key: 'phone', value: '068 864 67 40' },
      { key: 'addresses', value: JSON.stringify(['м. Буча, вул. Бориса Гмирі, 7']) },
      { key: 'schedule', value: 'Пн-Пт: 09:00 — 18:00<br>Сб: 10:00 — 14:00' },
      { key: 'locations', value: JSON.stringify([{
        address: 'м. Буча, вул. Бориса Гмирі, 7',
        schedule: 'Пн-Пт: 09:00 — 18:00<br>Сб: 10:00 — 14:00',
        lunchBreak: '13:00 — 14:00',
        closedDays: ['0']
      }]) },
    ];
    await Setting.insertMany(settingsDefaults);
  }

  // Migrate from settings to new collections
  await migrateContactsFromSettings();
}

async function migrateContactsFromSettings() {
  const phoneCount = await Phone.countDocuments();
  const locCount = await Location.countDocuments();
  if (phoneCount > 0 || locCount > 0) return;

  const allSettings = await Setting.find();
  const settingsMap = {};
  allSettings.forEach(r => { settingsMap[r.key] = r.value; });

  try {
    const phones = JSON.parse(settingsMap.phones || '[]');
    if (phones.length > 0) {
      await Phone.insertMany(phones.map((p, i) => ({ phone: p, sort_order: i })));
    }
  } catch (_) {}

  try {
    const locs = JSON.parse(settingsMap.locations || '[]');
    for (const loc of locs) {
      const addr = loc.address || '';
      const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
      let city = '', street = '', building = '';
      if (parts.length >= 3) { building = parts[parts.length-1]; street = parts[parts.length-2]; city = parts.slice(0, parts.length-2).join(', '); }
      else if (parts.length === 2) { street = parts[1]; city = parts[0]; }
      else if (parts.length === 1) { city = parts[0]; }

      const newLoc = await Location.create({ city, street, building, is_active: true });

      let lunchStart = null, lunchEnd = null;
      if (loc.lunchBreak) {
        const lm = loc.lunchBreak.match(/(\d{1,2}:\d{2})\s*—\s*(\d{1,2}:\d{2})/);
        if (lm) { lunchStart = lm[1]; lunchEnd = lm[2]; }
      }

      const closedDays = (loc.closedDays || []).map(Number);
      const allActiveDays = [1, 2, 3, 4, 5, 6, 0].filter(d => !closedDays.includes(d));

      const schedLines = (loc.schedule || '').split(/<br[\s>]*/).map(s => s.trim()).filter(Boolean);
      const schedDocs = allActiveDays.map(day => {
        let startTime = '09:00', endTime = '18:00';
        const dayAbbr = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][day];
        for (const line of schedLines) {
          if (line.includes(dayAbbr)) {
            const hm = line.match(/(\d{1,2}:\d{2})\s*—\s*(\d{1,2}:\d{2})/);
            if (hm) { startTime = hm[1]; endTime = hm[2]; }
            break;
          }
        }
        return {
          location_id: newLoc._id.toString(),
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
          lunch_start: lunchStart,
          lunch_end: lunchEnd,
        };
      });
      if (schedDocs.length > 0) {
        await LocationSchedule.insertMany(schedDocs);
      }
    }
  } catch (_) {}
}

module.exports = {
  initDB,
  getAllAppointments, getAppointment, createAppointment, updateAppointment, deleteAppointment, getStats,
  getAllServices, createService, updateService, deleteService,
  getAllFaq, createFaq, updateFaq, deleteFaq,
  getAllSettings, updateSetting,
  getAllPhones, createPhone, updatePhone, deletePhone,
  getAllLocations, getAllLocationsAll, createLocation, updateLocation, deleteLocation,
  getLocationSchedules, upsertLocationSchedule, deleteLocationSchedule,
  getContactsData, bulkUpdateContacts,
  seedDefaults,
  // Models for migration
  Appointment, Service, Faq, Setting, Phone, Location, LocationSchedule,
};
