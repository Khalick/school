/**
 * Olive International Schools — online applications
 *
 * Receives applications from the website's form (/apply), then:
 *   1. adds a row to the "Applications" tab of the school's Google Sheet,
 *   2. saves any uploaded documents to a private Google Drive folder,
 *   3. emails the school, and
 *   4. emails the parent (and the student, if they gave an email) a confirmation
 *      with their reference number.
 *
 * Setup: see SETUP.md in this folder.
 */

var CONFIG = {
  SCHOOL_NAME: 'Olive International Schools',
  SCHOOL_EMAIL: 'oliveschool946@gmail.com',
  SCHOOL_PHONE: '+254 796 042 535',
  SPREADSHEET_NAME: 'Olive applications',   // used only if the script is not attached to a sheet
  SHEET_NAME: 'Applications',
  DRIVE_FOLDER_NAME: 'Olive applications – documents',
  REF_PREFIX: 'OLV',
  SEND_CONFIRMATION: true,
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  ALLOWED_TYPES: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  PAYBILL: '522533',
  ACCOUNT: '7979746',
  ADMISSION_FEE: 'KSh 3,000'
};

/* Form fields, in the order they appear as sheet columns. */
var FIELDS = [
  { key: 'studentName', label: 'Student name', required: true },
  { key: 'studentEmail', label: 'Student email' },
  { key: 'dateOfBirth', label: 'Date of birth', required: true },
  { key: 'gender', label: 'Gender', required: true },
  { key: 'currentLevel', label: 'Current class or grade', required: true },
  { key: 'currentSchool', label: 'Current or previous school' },
  { key: 'programme', label: 'Programme', required: true },
  { key: 'studyOption', label: 'Mode of study', required: true },
  { key: 'subjects', label: 'Subjects' },
  { key: 'needs', label: 'Special needs or medical conditions' },
  { key: 'parentName', label: 'Parent or guardian', required: true },
  { key: 'parentPhone', label: 'Phone', required: true },
  { key: 'parentEmail', label: 'Parent email', required: true },
  { key: 'confirm', label: 'Declaration', required: true }
];

var DOCUMENTS = [
  { key: 'birthCert', label: 'Birth certificate or passport' },
  { key: 'report', label: 'School report or KCPE certificate' },
  { key: 'photo', label: 'Passport photo' }
];

var HEADERS = ['Received', 'Reference']
  .concat(FIELDS.map(function (f) { return f.label; }))
  .concat(DOCUMENTS.map(function (d) { return d.label; }))
  .concat(['Status', 'Notes']);


/* ---------- web app entry points ---------- */

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Spam trap: the website field is hidden from people, so anything in it came from a bot.
    if (data.website) return json_({ ok: true, ref: CONFIG.REF_PREFIX });

    var missing = FIELDS.filter(function (f) { return f.required && !clean_(data[f.key]); })
      .map(function (f) { return f.label; });
    if (missing.length) return json_({ ok: false, error: 'Missing: ' + missing.join(', ') });
    if (!isEmail_(data.parentEmail)) return json_({ ok: false, error: 'Invalid email address' });
    if (clean_(data.studentEmail) && !isEmail_(data.studentEmail)) data.studentEmail = '';

    var ref, links, sheet;
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      sheet = getSheet_();
      ref = nextRef_(sheet);
      links = saveDocuments_(data.files || [], ref, clean_(data.studentName));
      var row = [new Date(), ref]
        .concat(FIELDS.map(function (f) { return safeCell_(data[f.key]); }))
        .concat(DOCUMENTS.map(function (d) { return links[d.key] || ''; }))
        .concat(['New', '']);
      sheet.appendRow(row);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    // The application is saved by now, so a failed email must not tell the family to send it again.
    try { notifySchool_(data, ref, links, sheet); } catch (err) { console.error(err); }
    if (CONFIG.SEND_CONFIRMATION) {
      try { confirmToApplicant_(data, ref); } catch (err) { console.error(err); }
    }

    return json_({ ok: true, ref: ref });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'The application could not be saved. Please try again.' });
  }
}

/* Opening the web app URL in a browser shows this, which is a quick way to check it is live. */
function doGet() {
  return json_({ ok: true, service: CONFIG.SCHOOL_NAME + ' applications' });
}


/* ---------- setup: run once, and again after updating this script ---------- */

function setup() {
  var sheet = getSheet_();
  var ss = sheet.getParent();
  // Remove empty default tabs ("Sheet1" and so on) so the applications are the first thing you see.
  ss.getSheets().forEach(function (s) {
    if (s.getSheetId() !== sheet.getSheetId() && /^Sheet\d+$/.test(s.getName()) && s.getLastRow() === 0) ss.deleteSheet(s);
  });
  sheet.setColumnWidths(1, HEADERS.length, 170);
  var fixed = fixOldRows_(sheet);
  if (fixed) console.log('Moved ' + fixed + ' older application(s) into the right columns.');
  getFolder_();
  // Sending a test email also triggers the email permission prompt.
  MailApp.sendEmail(CONFIG.SCHOOL_EMAIL, 'Olive applications are connected',
    'The application form is set up. New applications will appear in the "' + CONFIG.SHEET_NAME +
    '" tab of this sheet:\n\n' + sheetUrl_(sheet) + '\n\nYou will also receive an email for each one.');
  console.log('Applications will be saved here: ' + sheetUrl_(sheet));
}


/* ---------- helpers ---------- */

/* The sheet this script is attached to; or, if it was created on its own, a sheet it makes once and remembers. */
function getSpreadsheet_() {
  var ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (ss) return ss;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* it was deleted: make a new one */ }
  }
  ss = SpreadsheetApp.create(CONFIG.SPREADSHEET_NAME);
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

/* The "Applications" tab: created as the first tab if needed, with headings that match the form. */
function getSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    var first = ss.getSheets()[0];
    sheet = (first && first.getLastRow() === 0) ? first.setName(CONFIG.SHEET_NAME) : ss.insertSheet(CONFIG.SHEET_NAME, 0);
  }
  if (sheet.getIndex() !== 1) {
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(1);
  }
  syncHeaders_(sheet);
  return sheet;
}

/* Makes row 1 match HEADERS. A new heading gets a new column of its own, so the
   applications already in the sheet stay under the headings they were saved with. */
function syncHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  var current = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) { return String(v).trim(); }) : [];
  if (current.slice(0, HEADERS.length).join('|') === HEADERS.join('|')) return;
  if (sheet.getMaxColumns() < HEADERS.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADERS.length - sheet.getMaxColumns());
  HEADERS.forEach(function (h, i) {
    if (current[i] === h) return;
    var at = current.indexOf(h);
    if (at > i) {
      sheet.moveColumns(sheet.getRange(1, at + 1), i + 1);
      current.splice(i, 0, current.splice(at, 1)[0]);
    } else if (current[i]) {
      sheet.insertColumnBefore(i + 1);
      current.splice(i, 0, h);
    } else {
      current[i] = h;
    }
  });
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#0F4235').setFontColor('#F6F2EA');
  sheet.setFrozenRows(1);
}

/* Repairs rows saved before the "Student email" column was added (those rows have the
   gender one column to the left), and puts back the leading 0 that Sheets removed from
   phone numbers. Run by setup; safe to run any number of times. */
function fixOldRows_(sheet) {
  var rows = sheet.getLastRow() - 1;
  if (rows < 1) return 0;
  var width = Math.max(sheet.getLastColumn(), HEADERS.length);
  var values = sheet.getRange(2, 1, rows, width).getValues();
  var gender = HEADERS.indexOf('Gender'), phone = HEADERS.indexOf('Phone');
  var isGender = function (v) { return /^(female|male)$/i.test(String(v).trim()); };
  var moved = 0;
  values.forEach(function (r, n) {
    var out = r, changed = false;
    if (isGender(r[gender - 1]) && !isGender(r[gender]) && r[width - 1] === '') {
      out = r.slice(0, gender - 2).concat(['']).concat(r.slice(gender - 2, width - 1));
      changed = true;
      moved++;
    }
    if (typeof out[phone] === 'number') {
      out[phone] = (String(out[phone]).length === 9 ? '0' : '') + out[phone];
      changed = true;
    }
    if (!changed) return;
    // Text goes back in with the same protection as new applications, so Sheets keeps it as typed.
    sheet.getRange(n + 2, 1, 1, width).setValues([out.map(function (v) { return typeof v === 'string' ? safeCell_(v) : v; })]);
  });
  return moved;
}

function sheetUrl_(sheet) {
  return sheet.getParent().getUrl() + '#gid=' + sheet.getSheetId();
}

function nextRef_(sheet) {
  var n = Math.max(sheet.getLastRow(), 1); // the heading row is row 1, so the first application is 0001
  return CONFIG.REF_PREFIX + '-' + new Date().getFullYear() + '-' + ('000' + n).slice(-4);
}

function getFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DOCS_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* folder was deleted: make a new one */ }
  }
  var folder = DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
  props.setProperty('DOCS_FOLDER_ID', folder.getId());
  return folder;
}

function saveDocuments_(files, ref, studentName) {
  var links = {};
  if (!files.length) return links;
  var folder = getFolder_();
  files.forEach(function (f) {
    var doc = DOCUMENTS.filter(function (d) { return d.key === f.field; })[0];
    if (!doc || !f.data || CONFIG.ALLOWED_TYPES.indexOf(f.type) === -1) return;
    var bytes = Utilities.base64Decode(f.data);
    if (bytes.length > CONFIG.MAX_FILE_BYTES) return;
    var ext = (String(f.name).match(/\.[a-z0-9]{2,5}$/i) || [''])[0];
    var name = ref + ' – ' + studentName + ' – ' + doc.label + ext;
    var file = folder.createFile(Utilities.newBlob(bytes, f.type, name));
    links[doc.key] = file.getUrl();
  });
  return links;
}

function notifySchool_(data, ref, links, sheet) {
  var rows = FIELDS.filter(function (f) { return f.key !== 'confirm'; })
    .map(function (f) { return [f.label, clean_(data[f.key])]; })
    .concat(DOCUMENTS.map(function (d) {
      return [d.label, links[d.key] ? '<a href="' + links[d.key] + '">Open document</a>' : ''];
    }));
  var table = rows.filter(function (r) { return r[1]; }).map(function (r) {
    var value = r[1].indexOf('<a ') === 0 ? r[1] : esc_(r[1]).replace(/\n/g, '<br>');
    return '<tr><td style="padding:6px 16px 6px 0;color:#6A726E;vertical-align:top">' + esc_(r[0]) +
      '</td><td style="padding:6px 0;color:#18221E">' + value + '</td></tr>';
  }).join('');
  var html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">' +
    '<h2 style="color:#0F4235;margin:0 0 4px">New application ' + esc_(ref) + '</h2>' +
    '<p style="margin:0 0 16px;color:#47514C">' + esc_(clean_(data.studentName)) + ' · ' + esc_(clean_(data.programme)) +
    ' · ' + esc_(clean_(data.studyOption)) + '</p>' +
    '<table style="border-collapse:collapse">' + table + '</table>' +
    '<p style="margin:20px 0 0"><a href="' + sheetUrl_(sheet) + '">Open the Applications sheet</a></p></div>';
  MailApp.sendEmail({
    to: CONFIG.SCHOOL_EMAIL,
    subject: 'New application ' + ref + ': ' + clean_(data.studentName) + ' (' + clean_(data.programme) + ')',
    htmlBody: html,
    replyTo: clean_(data.parentEmail),
    name: CONFIG.SCHOOL_NAME + ' website'
  });
}

/* Confirmation to the parent, with the student copied in if they gave their own email. */
function confirmToApplicant_(data, ref) {
  var parent = clean_(data.parentEmail).toLowerCase();
  var student = clean_(data.studentEmail).toLowerCase();
  var html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#18221E">' +
    '<p>Dear ' + esc_(clean_(data.parentName)) + (student && student !== parent ? ' and ' + esc_(clean_(data.studentName)) : '') + ',</p>' +
    '<p>Thank you for applying to ' + CONFIG.SCHOOL_NAME + '. We have received the application for <b>' +
    esc_(clean_(data.studentName)) + '</b> (' + esc_(clean_(data.programme)) + ', ' + esc_(clean_(data.studyOption)) + ').</p>' +
    '<p>Your reference number is <b>' + esc_(ref) + '</b>.</p>' +
    '<p><b>What happens next</b></p><ol>' +
    '<li>Our admissions team will contact you to talk about the application.</li>' +
    '<li>To secure the place, pay the one-time admission fee of ' + CONFIG.ADMISSION_FEE + ' by M-Pesa: Paybill <b>' +
    CONFIG.PAYBILL + '</b>, account <b>' + CONFIG.ACCOUNT + '</b>.</li>' +
    '<li>Bring or send any documents you have not uploaded yet.</li></ol>' +
    '<p>If you have any questions, reply to this email or call ' + CONFIG.SCHOOL_PHONE + '.</p>' +
    '<p>Kind regards,<br>' + CONFIG.SCHOOL_NAME + '<br>Your future. Our commitment.</p></div>';
  var message = {
    to: parent,
    subject: 'Your application to ' + CONFIG.SCHOOL_NAME + ' (' + ref + ')',
    htmlBody: html,
    replyTo: CONFIG.SCHOOL_EMAIL,
    name: CONFIG.SCHOOL_NAME
  };
  if (student && student !== parent) message.cc = student;
  MailApp.sendEmail(message);
}

function clean_(v) {
  return String(v == null ? '' : v).trim().slice(0, 2000);
}

/* Saves each answer exactly as typed: a value such as "=HYPERLINK(...)" is not run as a
   formula, and a phone number such as 0712 345 678 keeps its leading 0. */
function safeCell_(v) {
  var s = clean_(v);
  return /^[=+\-@]/.test(s) || /^[\d\s().\/-]+$/.test(s) ? "'" + s : s;
}

function isEmail_(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean_(v));
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
