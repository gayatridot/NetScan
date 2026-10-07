# NETSCAN — IP & Network Intelligence

NETSCAN is a lightweight, educational IP address analyzer and network-information dashboard. A Flask/Python backend uses the standard-library `socket` and `ipaddress` modules; the responsive frontend is built with HTML, CSS, SVG, and vanilla JavaScript.

> **Scope and privacy:** IP analysis is performed locally by the Flask application and sends no packets to the address being analyzed. The dashboard reports the machine running Flask. It does not identify the browser visitor's private IP or hostname, discover LAN devices, or store submitted addresses.

## Features

- Server-side hostname, FQDN, resolved interface IP, and IP version using Python `socket`.
- IPv4 and IPv6 validation and classification using `ipaddress.ip_address()`.
- IPv4 Class A–E classification with IPv6 correctly shown as not applicable.
- Address scope labels: Private (RFC 1918 / IPv6 ULA), Public, or Special/Reserved.
- Animated dashboard, illustrative network topology, terminal-style scan sequence, class spectrum, and responsive mobile navigation.
- Copy server IP, sample addresses, reset, keyboard-friendly form, focus states, and reduced-motion support.
- No paid APIs, analytics, target probing, device discovery, or address storage.

## Technologies

- Python 3
- Flask
- Python `socket` and `ipaddress`
- HTML5, CSS3, SVG, and vanilla JavaScript
- Gunicorn for production hosting

## Project structure

```text
netscan/
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
├── render.yaml          # Optional Render Blueprint configuration
├── templates/
│   └── index.html
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── script.js
```

## Local setup

1. Install Python 3.10 or newer.
2. Open a terminal in the `netscan` folder and create a virtual environment:

   ```powershell
   python -m venv venv
   ```

3. Activate it on Windows:

   ```powershell
   venv\Scripts\activate
   ```

   On macOS/Linux use `source venv/bin/activate`.

4. Install dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

5. Start Flask:

   ```powershell
   python app.py
   ```

6. Open <http://127.0.0.1:5000>.

The application binds to `0.0.0.0` and reads the hosting platform's `PORT` environment variable. Local development defaults to port 5000.

## API

### `GET /api/network-info`

Returns the Flask host's hostname, FQDN, resolved address, address version, and a `Local server` / `Hosted server` runtime label. Values are server-side and can differ from the visitor's device.

### `POST /api/analyze-ip`

Send JSON such as `{"ip":"8.8.8.8"}`. Success returns `ip`, `version`, `class`, and `type`. Invalid or missing addresses return HTTP 400 with an error message. This endpoint parses an address only; it does not connect to it.

## GitHub upload

1. Create an empty repository on GitHub (do not add credentials or `.env` files).
2. In a terminal, change to this project directory and run:

   ```powershell
   git init
   git add .
   git commit -m "Build NETSCAN IP intelligence dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/netscan.git
   git push -u origin main
   ```

3. Replace the example repository URL with your own. The included `.gitignore` excludes virtual environments, Python cache files, environment files, and editor configuration.

## Free deployment on Render

Render's free web-service availability and limits can change. At deployment time, verify that the **Free** instance option is still offered for Python web services; a free service may sleep when idle and can have limited CPU/memory.

1. Push the repository to GitHub.
2. In Render, choose **New → Web Service** and connect the repository.
3. Select the project root (`netscan` if it is inside a larger repository).
4. Set the build command to `pip install -r requirements.txt`.
5. Set the start command to `gunicorn app:app`.
6. Choose the Free instance type if available, then deploy. Render supplies the `PORT` environment variable; the Flask development server is not used in production.
7. Open the generated `https://...onrender.com` URL and check both the dashboard and analyzer.

No API keys or paid third-party services are required. A generic Python-compatible free host can also be used if it supports a Python build command and a WSGI start command such as `gunicorn app:app`; check its current free-tier terms before deploying.

## Important: local IP and hostname limitation

A website cannot use server-side Python `socket` calls to read the browser visitor's private IP address or computer hostname. Flask runs on the server, so `socket.gethostname()` and `socket.gethostbyname()` describe the Flask host. On a cloud deployment, NETSCAN explicitly labels that data as hosted-server information. Browser networking protections also prevent ordinary pages from reliably identifying a visitor's private LAN address. NETSCAN does not use an external public-IP service and does not collect visitor IPs.

## Live Project link
[https://net-scan-gamma.vercel.app/_
](https://net-scan-gamma.vercel.app/)

## How the Python backend works

- Flask serves `templates/index.html` and the static assets at `/`.
- `GET /api/network-info` calls `socket.gethostname()`, `socket.getfqdn()`, and `socket.gethostbyname(hostname)` inside guarded error handling. It annotates the response as local or hosted server information.
- `POST /api/analyze-ip` reads JSON, rejects missing/malformed input with HTTP 400, and parses the address through `ipaddress.ip_address()`.
- IPv4 class is selected from the first-octet ranges A (1–126), B (128–191), C (192–223), D (224–239), and E (240–255). IPv6 has no traditional class, so it returns `N/A`.
- RFC 1918 IPv4 ranges and IPv6 ULA (`fc00::/7`) are labeled Private. Addresses reported globally reachable by Python are Public; other non-global/special ranges are Special/Reserved.
- The frontend calls these JSON routes with `fetch()` and updates the page without a reload.

## Suggested viva questions and answers

1. **What is an IP address?** A logical address used to identify an interface and route traffic on an IP network.
2. **What is the difference between IPv4 and IPv6?** IPv4 uses 32-bit addresses; IPv6 uses 128-bit addresses and a different notation and allocation model.
3. **What does Python's `ipaddress` module do here?** It parses IP literals, validates them, identifies their version, and provides properties such as global reachability.
4. **Why use `socket`?** It provides hostname and DNS/address-resolution functions for the machine running the Python application.
5. **Why does a hosted site show a server hostname?** Python runs on the hosting machine. The browser cannot ask that server-side process to inspect the visitor's private network.
6. **What is a private IPv4 address?** An address in one of the RFC 1918 ranges: `10.0.0.0/8`, `172.16.0.0/12`, or `192.168.0.0/16`.
7. **What does Class C mean in this demonstration?** A historical classful IPv4 range whose first octet is 192–223; modern networks are primarily described with CIDR prefixes instead.
8. **Why is an IPv6 class shown as N/A?** A/B/C/D/E classful addressing is an IPv4-era concept and does not apply to IPv6.
9. **Does the analyzer scan an IP or send packets?** No. It validates and classifies the text locally using `ipaddress`; it makes no connection to the target.
10. **How does the frontend communicate with Flask?** JavaScript sends JSON to `/api/analyze-ip` using `fetch()` and renders the returned JSON.
11. **Why return HTTP 400 for invalid input?** The request is syntactically received but contains a value the API cannot accept, so the client receives a clear client-error status.
12. **How is the service prepared for deployment?** Flask binds to `0.0.0.0`, reads `PORT`, and production can run through Gunicorn as `gunicorn app:app`.
