/**
 * Stage photo uploader for Malcon Nexus. Runs under the Google account that owns the Drive storage.
 *
 * Setup (once, in script.google.com):
 *   1. Project Settings → Script Properties:
 *        UPLOADER_TOKEN = a long random string (the Edge Function sends it)
 *      Leave FOLDER_ID out: the script creates its own "Malcon Nexus Photos" folder on first upload.
 *   2. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 *   3. Copy the Web app URL into the Supabase secret APPS_SCRIPT_URL.
 *
 * Uses the drive.file scope (see appsscript.json), so it can only touch files this script creates.
 */

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const props = PropertiesService.getScriptProperties();
    if (!body.token || body.token !== props.getProperty('UPLOADER_TOKEN')) {
      return json({ error: 'Unauthorized' });
    }

    const root = rootFolder(props);
    const folder = getOrCreateFolder(root, [body.caseId, body.stage]);
    const file = saveFile(folder, body.name, body.mimeType, body.base64);

    return json({ fileId: file.getId() });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function rootFolder(props) {
  const id = props.getProperty('FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder('Malcon Nexus Photos');
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function saveFile(folder, name, mimeType, base64) {
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, name);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file;
}

function getOrCreateFolder(parent, names) {
  return names.reduce(function (folder, name) {
    const found = folder.getFoldersByName(name);
    return found.hasNext() ? found.next() : folder.createFolder(name);
  }, parent);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
