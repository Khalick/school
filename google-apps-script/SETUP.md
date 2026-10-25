# Connecting the application form

The application form on the website (`/apply`) sends each application to a small Google Apps Script that runs in the school's Google account. The script then:

- adds the application as a new row in the **Applications** tab of a Google Sheet
- saves any uploaded documents (photo, birth certificate, report) in a private Google Drive folder
- emails the school at **oliveschool946@gmail.com**
- emails the parent a confirmation with a reference number such as `OLV-2026-0001`, and copies in the student if they gave their own email

Setup takes about ten minutes and only needs doing once.

## 1. Create the sheet

1. Sign in to Google as **oliveschool946@gmail.com**. Use the school account, not a personal one, because emails are sent from the account that owns the script.
2. Go to sheets.google.com and create a blank spreadsheet called **Olive applications**.

## 2. Add the script

1. In the sheet, open **Extensions → Apps Script**.
2. Delete the code that is there, and paste in the whole of `Code.gs` from this folder.
3. Click **Save** (the disk icon).

## 3. Run the setup once

1. In the toolbar, choose the function **setup** from the drop-down, then click **Run**.
2. Google asks for permission. Click **Review permissions**, choose the school account, then:
   - click **Advanced**
   - click **Go to … (unsafe)**
   - click **Allow**

   The "unsafe" warning appears for every private script. It is safe here because this is the school's own script.
3. When it finishes, you will have:
   - an **Applications** tab with column headings, as the first tab of the sheet (the empty "Sheet1" tab is removed)
   - a Drive folder called **Olive applications – documents**
   - a test email in the inbox, with a link straight to the Applications tab

## 4. Publish it as a web app

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - Description: `Olive applications`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** and copy the **Web app URL**. It looks like `https://script.google.com/macros/s/…/exec`.

"Anyone" only means the website can send applications to it. Nobody can read the sheet or the documents. Those stay private in the school's Google account.

## 5. Connect the website

1. Open `site/apply.html` and find this line:

   ```
   data-endpoint="PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE"
   ```

2. Replace the placeholder text with the Web app URL, keeping the quotation marks.
3. Commit and push. Vercel redeploys automatically.

Until this step is done, the form still works: it offers to send the application by email or WhatsApp instead.

## 6. Test it

1. Open the website's `/apply` page and submit a test application with your own email address.
2. Check that you see:
   - a new row in the sheet
   - an email at oliveschool946@gmail.com
   - a confirmation email in your own inbox
3. Delete the test row afterwards.

## Changing the script later

After editing `Code.gs`, publish the change without changing the URL:

1. In Apps Script, replace the old code with the new `Code.gs` and click **Save**.
2. Run **setup** again. It updates the column headings if the form has new fields, and tidies the tabs.
3. Go to **Deploy → Manage deployments**.
4. Click the pencil icon.
5. Set **Version** to **New version**.
6. Click **Deploy**.

The website keeps working with the same URL, so nothing on the website needs to change.

## Good to know

- **Can't find an application?** It is in the **Applications** tab. Every school email has an "Open the Applications sheet" link that goes straight to it.
- **Email limit:** a free Gmail account can send to about 100 recipients a day through scripts. Each application uses two or three: the school, the parent and, if given, the student.
- **Uploads:** each document can be up to 5 MB, and must be a PDF, JPG, PNG or WebP.
- **Status columns:** use the **Status** and **Notes** columns to track each application (for example New, Contacted, Fee paid, Enrolled).
- **Privacy:** the sheet and folder hold children's personal details. Keep them private, and only share them with staff who need them.
- **Confirmation emails:** to stop them, set `SEND_CONFIRMATION: false` at the top of `Code.gs`, then publish a new version.
