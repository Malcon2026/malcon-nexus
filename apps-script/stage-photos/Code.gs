/**
 * Stage photo uploader and daily report for Malcon Nexus. Runs under the Google account that owns the Drive storage.
 *
 * Folder layout (created automatically):
 *   Malcon Nexus Photos / 2026 / 10-October / 26-October-2026 /
 *     MLS-10-26-004 Total knee replacement / Set Preparation / photo files
 *     Daily report 2026-10-26.csv           (private, not shared)
 *
 * Setup (once, in script.google.com):
 *   1. Project Settings → Script Properties:
 *        UPLOADER_TOKEN = a long random string (the Edge Functions send it)
 *      Leave FOLDER_ID out: the script creates its own "Malcon Nexus Photos" folder on first upload.
 *   2. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 *   3. Copy the Web app URL into the Supabase secret APPS_SCRIPT_URL.
 *
 * Uses the Drive advanced service (enabled in appsscript.json). It needs only the drive.file scope,
 * so the script can only see files it creates.
 */

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    if (!body.token || body.token !== props.getProperty('UPLOADER_TOKEN')) {
      return json({ error: 'Unauthorized' });
    }

    const rootId = rootFolderId(props);
    if (body.action === 'report') {
      return json({ fileId: saveReport(rootId, body.date, body.csv) });
    }

    const dayId = dateFolderId(rootId, todayParts());
    const folderId = getOrCreateFolder(dayId, [body.caseFolder, body.stageFolder]);
    const fileId = saveFile(folderId, body.name, body.mimeType, body.base64);
    return json({ fileId: fileId });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function rootFolderId(props) {
  const id = props.getProperty('FOLDER_ID');
  if (id) return id;
  const folderId = createFolder(null, 'Malcon Nexus Photos');
  props.setProperty('FOLDER_ID', folderId);
  return folderId;
}

/** Today in India time, e.g. { year: '2026', month: 9, day: '26' } for 26 October 2026. */
function todayParts() {
  const parts = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy|M|d').split('|');
  return { year: parts[0], month: Number(parts[1]) - 1, day: parts[2] };
}

/** 'YYYY-MM-DD' → the same parts todayParts() returns. */
function partsFromDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year: String(year), month: month - 1, day: String(day) };
}

function dateFolderId(rootId, today) {
  const yearId = findFolder(rootId, today.year) || createYear(rootId, today.year);
  const monthName = pad2(today.month + 1) + '-' + MONTHS[today.month];
  const dateName = today.day + '-' + MONTHS[today.month] + '-' + today.year;
  return getOrCreateFolder(yearId, [monthName, dateName]);
}

/** Creates the year folder and all 12 month folders in one go. */
function createYear(rootId, year) {
  const yearId = createFolder(rootId, year);
  MONTHS.forEach(function (month, i) {
    createFolder(yearId, pad2(i + 1) + '-' + month);
  });
  return yearId;
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function getOrCreateFolder(parentId, names) {
  return names.reduce(function (id, name) {
    return findFolder(id, name) || createFolder(id, name);
  }, parentId);
}

function findFolder(parentId, name) {
  const q =
    "name = '" + escapeQuery(name) + "' and '" + parentId + "' in parents" +
    " and mimeType = '" + FOLDER_MIME + "' and trashed = false";
  const res = Drive.Files.list({ q: q, fields: 'files(id)' });
  return res.files && res.files.length ? res.files[0].id : null;
}

function findFile(parentId, name) {
  const q = "name = '" + escapeQuery(name) + "' and '" + parentId + "' in parents and trashed = false";
  const res = Drive.Files.list({ q: q, fields: 'files(id)' });
  return res.files && res.files.length ? res.files[0].id : null;
}

function escapeQuery(text) {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function createFolder(parentId, name) {
  const res = Drive.Files.create(
    { name: name, mimeType: FOLDER_MIME, parents: parentId ? [parentId] : undefined },
    undefined,
    { fields: 'id' },
  );
  return res.id;
}

function saveFile(folderId, name, mimeType, base64) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, name);
  const res = Drive.Files.create({ name: name, parents: [folderId] }, blob, { fields: 'id' });
  Drive.Permissions.create({ type: 'anyone', role: 'reader' }, res.id);
  return res.id;
}

/** Writes the day's CSV into that day's folder, replacing an earlier run. Stays private. */
function saveReport(rootId, dateKey, csv) {
  const dayId = dateFolderId(rootId, partsFromDateKey(dateKey));
  const name = 'Daily report ' + dateKey + '.csv';
  const blob = Utilities.newBlob(csv, 'text/csv', name);
  const existing = findFile(dayId, name);
  if (existing) {
    Drive.Files.update({}, existing, blob);
    return existing;
  }
  return Drive.Files.create({ name: name, parents: [dayId] }, blob, { fields: 'id' }).id;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
