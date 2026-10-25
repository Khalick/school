# Olive International Schools: website and crest

The website for Olive International Schools, Nairobi: Cambridge IGCSE, AS & A Level, and KCSE private candidates.

## What's here

```
site/          the website (plain HTML, CSS and JavaScript, no build step)
  index.html     Home
  about.html     About
  learning.html  Learning (Cambridge programmes, subjects, exam calendar)
  kcse.html      KCSE private candidates
  admissions.html Admissions (steps, enquiry form, fees, FAQs)
  apply.html     Online application form
  404.html       Page shown for broken links
  robots.txt
  assets/        css, js, img (crest, favicons, share image), photos
brand/         the redrawn crest (SVG + PNG) and brand-guide.html
google-apps-script/  the script behind the application form, and SETUP.md
photos/        CREDITS.md: where each photo came from and what to replace it with
vercel.json    Vercel settings (serves site/, clean URLs, headers)
serve.ps1      local preview server
```

## Preview locally

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open http://localhost:5173/. The preview behaves like Vercel: pages have clean addresses (`/about`, `/kcse`), and broken links show the site's 404 page.

Links and images use paths that start at the site root (`/about`, `/assets/...`). That means opening the HTML files directly by double-clicking them won't load the styles. Use the preview server instead.

## Push to GitHub

From this folder:

```bash
git init
git add .
git commit -m "Olive International Schools website"
git branch -M main
git remote add origin https://github.com/<your-account>/<repo-name>.git
git push -u origin main
```

`.gitignore` keeps the reference photos that were dropped into this folder out of the repository. Those are other people's pictures and are not used on the site.

> This folder is inside OneDrive. If OneDrive sync gives you trouble with the `.git` folder, clone the repository to a folder outside OneDrive (for example `C:\dev\olive`) and work from there.

## Deploy on Vercel

1. Go to vercel.com, choose **Add New → Project**, and import the GitHub repository.
2. Leave every setting as it is. `vercel.json` already tells Vercel to:
   - serve the `site` folder
   - use no build step
   - use clean URLs, so `/about.html` redirects to `/about`
   - use `404.html` for missing pages
   - add basic security headers
3. Click **Deploy**. Every later push to `main` redeploys automatically.

To add a custom domain (for example `olive.ac.ke`), open the project and go to **Settings → Domains**.

## Before launch

0. **Connect the application form.** Follow `google-apps-script/SETUP.md`, which takes about ten minutes with the school's Google account. Then paste the web app URL into `site/apply.html`. Until then, the form offers to send applications by email or WhatsApp.
1. **Replace the photos.** The photos are licensed stand-ins from Pexels, not Olive students. `photos/CREDITS.md` lists every file and the sizes needed. Keep the same file names, and the site updates automatically.
2. **Check the content** against how the school actually runs:
   - the subject list (`learning.html`)
   - the homeschool support list
   - the KCSE support and dates (`kcse.html`), checked against the current KNEC circular
   - the FAQ answers (`admissions.html`, `kcse.html`)
3. **Add the address** when ready. Search the pages for `Nairobi, Kenya`.
4. **Once the domain is known:**
   - Change `content="/assets/img/og-image.png"` in each page's `<head>` to the full address, such as `https://olive.ac.ke/assets/img/og-image.png`. Without this, link previews on WhatsApp and Facebook won't show the image.
   - Add a sitemap.

## Editing

- The header and footer are repeated in every page: `index`, `about`, `learning`, `kcse`, `admissions` and `404`. If you change one, change them all.
- Colours, type and spacing are set at the top of `site/assets/css/styles.css`.
- The phone number and email are also set at the top of `site/assets/js/site.js`.

## Design: "Modern heritage"

Like a finely printed school prospectus, brought to the screen.

- **Type:** Libre Caslon for headlines, and Libre Franklin for text, labels and buttons. Both are free on Google Fonts.
- **Colour:** an ivory background, with school green and crest gold. Gold is used for fine lines and accents.
- **Signature detail:** the thin gold keyline from the crest's shield. It frames the photos, quarters the "four quarters" section and appears as rules and diamond markers.
- **Motion:**
  - Headings rise in word by word, and photos move in parallax with the scroll. Both glide smoothly up and down.
  - The home banner is a slow slideshow with a pause button.
  - All motion switches off for visitors who choose reduced motion in their device settings.
- **Phones:** a fixed bottom bar with Call, WhatsApp and Enquire on every page.
"# school" 
