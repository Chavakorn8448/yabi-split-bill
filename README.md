# Yabi Split Bill

Static bill splitter for the friend group. The organizer (default Sarah) enters expenses, copies a **share link** for the chat, and each friend picks their name, ticks optional items, and sees one number: what to Zelle the organizer. The organizer's own view shows who owes her what and what she pays back to each person who fronted an item.

- Everyone Zelles the organizer their full share. The organizer then pays each fronter the full amount they fronted.
- The whole bill lives in the URL hash (lz-string compressed). No backend, nothing is sent anywhere.
- The organizer link carries opt-in ticks; re-copy it to save progress. (Mode is just a flag in the URL, not security.)
- Edit names and defaults at the top of `app.js`.

## Run locally
```
python3 -m http.server 8000   # or: npx serve .
npm test                      # money-math tests
```

## Live
https://yabi-split-bill.vercel.app
