# SmartLeaves - Holiday Planner 🎉

> Maximize your vacation days by planning leaves strategically with Indian national holidays

**Live Demo:** [View Here](https://smartleaves.in/)

## What is SmartLeaves?

SmartLeaves helps you plan your holidays efficiently. Enter your available leave days, and it will show you the best way to combine them with national holidays and weekends to get maximum time off.

## Features

- ✨ Smart leave optimization for maximum vacation days
- 📅 Indian national holidays for 2025–2028
- 🔄 Sort results by date, best value, duration, or leaves required
- 🌙 Dark mode support
- 📱 Works on mobile, tablet, and desktop
- ⚡ Fast and lightweight - no installation needed

## How to Use

1. Enter your available leave days
2. Select the year you want to plan for
3. Choose your preference (long breaks or frequent trips)
4. Click "Generate My Holiday Plan"
5. Get your optimized vacation schedule!

## Quick Start

### Run Online
Just visit: [https://smartleaves.in/](https://smartleaves.in/)

### Run Locally
The app uses ES modules (`import` in `app.js`). Browsers only load those over **http://** or **https://** — not when you double-click `index.html` (`file://`).

```bash
git clone https://github.com/hritikSinghParihar/smart-leaves-planner.git
cd smart-leaves-planner
npx serve .
# open the URL shown (e.g. http://localhost:3000)
```

### Deploy (Netlify)
No build step. Connect the repo in Netlify with **publish directory** set to `.` (repo root), or use the included `netlify.toml`. [smartleaves.in](https://smartleaves.in/) is hosted this way — visiting the site URL loads the full app.

Other static hosts (GitHub Pages, etc.) work the same way: serve these files over HTTPS:- `index.html`, `app.js`, `style.css`
- `lib/` (`engine.js`, `holidays.js`, `ics.js`, `share.js`, `calendar.js`)

`node_modules/` is only for running tests locally — it is not required in production.

## Technology

- HTML5
- CSS3
- JavaScript (vanilla ES modules)
- No runtime dependencies; Vitest for tests only

## Contributing

Found a bug or have a suggestion? Open an [issue](https://github.com/hritiksinghparihar/smart-leave-planner/issues) or submit a pull request!

## Author

**Hritik Singh Parihar**
- GitHub: [@hritiksinghparihar](https://github.com/hritiksinghparihar)

## License

MIT License - feel free to use this project

---

⭐ If you find this helpful, please star this repo!
