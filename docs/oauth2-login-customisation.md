# OAuth2 Login Screen Customisation — Patent Workbench

This guide covers two related but distinct things:

1. **The in-app demo component** (`OAuthLoginDemo.tsx`) — a React screen that lives inside the app and previews the login flow during development or stakeholder demos. It is **not** the real authentication mechanism.
2. **The oauth2-proxy HTML templates** (`sign_in.html`, `error.html`) — the actual branded pages served by `oauth2-proxy` in production. The app itself never handles auth logic; the proxy intercepts unauthenticated requests before they reach the frontend.

---

## The in-app demo component

### What it is

`client/src/components/OAuthLoginDemo.tsx` is a fully-designed React component that renders a two-panel login screen matching the Patent Workbench visual identity. It is gated behind the `VITE_DEMO_OAUTH` build flag and is never compiled into a production bundle unless that flag is set.

It is useful for:

- **Stakeholder demos** — shows the complete login → loader → app flow without any infrastructure.
- **Design iteration** — the login UI can be developed and refined independently of oauth2-proxy or Authelia.

### How to enable it

In `client/.env` (or `client/.env.local`), set:

```dotenv
VITE_DEMO_OAUTH=true
```

Restart the dev server. The app will now start on the login screen and transition through the AppLoader into the workbench after a successful "sign in" (any non-empty username and password are accepted).

To disable it and skip directly to the app (the default for production builds):

```dotenv
VITE_DEMO_OAUTH=false
# or remove the line entirely
```

### What the component does today

| Behaviour | Detail |
| --- | --- |
| Form submission | Validates that username and password are non-empty, then calls the `onAuthenticated` callback — no HTTP request is made |
| Authelia SSO button | Triggers the same local callback — no OAuth2 redirect |
| Logout button (header) | Resets the app phase to `'login'` in local React state — no server-side session invalidation |
| Theme | Always rendered in dark mode regardless of the app's global theme setting |

### What is missing for a real deployment

The component provides the full visual shell and UX flow, but all authentication logic would need to be implemented before it could replace an actual auth proxy:

| Missing piece | What is needed |
| --- | --- |
| **Credential authentication** | `POST` the form to a real endpoint (backend or Authelia directly); handle 401/403 responses from the server |
| **OAuth2/OIDC SSO flow** | Redirect to the Authelia authorisation URL (`/oauth2/authorize?client_id=…&redirect_uri=…&response_type=code`); handle the callback and exchange the code for tokens |
| **Session / token management** | Store the access token (preferably in an HttpOnly cookie set by the server), include it in every API request, handle token refresh and expiry |
| **Route protection** | On app init, check whether a valid session exists; redirect to login if not |
| **Real logout** | Call the server's token revocation or Authelia logout endpoint to invalidate the session before resetting local state |
| **Server error messages** | Surface error strings returned by the auth backend ("invalid credentials", "account locked", etc.) |

> [!NOTE]
> For a lab deployment using oauth2-proxy, none of the above needs to be implemented in the React app. The proxy handles everything — the app only ever sees already-authenticated requests. The demo component exists purely for visual preview and is bypassed entirely in production.

---

## oauth2-proxy templates — table of contents

1. [How oauth2-proxy templates work](#how-oauth2-proxy-templates-work)
2. [Directory setup](#directory-setup)
3. [sign_in.html — full template](#sign_inhtml--full-template)
4. [error.html — full template](#errorhtml--full-template)
5. [Configure oauth2-proxy to use the templates](#configure-oauth2-proxy-to-use-the-templates)
6. [Serving static assets via nginx](#serving-static-assets-via-nginx)
7. [Testing](#testing)

---

## How oauth2-proxy templates work

`oauth2-proxy` renders two HTML pages from disk:

| File | When shown |
| --- | --- |
| `sign_in.html` | Any unauthenticated request — user sees this before being redirected to the IdP |
| `error.html` | Auth failures, expired sessions, misconfiguration |

Templates use Go's `html/template` syntax. The variables available in `sign_in.html` are:

| Variable | Value |
| --- | --- |
| `{{.ProxyPrefix}}` | URL prefix of the proxy (e.g., `/oauth2`) |
| `{{.Redirect}}` | The original URL the user was trying to reach |
| `{{.ProviderName}}` | Human-readable name of the IdP (e.g., `"Authelia"`, `"Azure"`) |
| `{{.SignInMessage}}` | Optional message set via `--banner` flag |
| `{{.Footer}}` | Optional footer text set via `--footer` flag |
| `{{.Version}}` | oauth2-proxy version string |

> [!NOTE]
> Static assets (images, external CSS files) referenced in the template must be served separately — typically by nginx. The templates in this guide inline all CSS and the SVG logo to avoid that dependency.

---

## Directory setup

```bash
sudo mkdir -p /opt/oauth2-proxy/templates
sudo chown $USER:$USER /opt/oauth2-proxy/templates
```

---

## sign_in.html — full template

Save this file to `/opt/oauth2-proxy/templates/sign_in.html`:

```html
<!DOCTYPE html>
<html lang="en" data-scheme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Patent Workbench — Sign In</title>
  <link
    href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600;700&display=swap"
    rel="stylesheet"
  />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:          #1a1b1e;
      --surface:     #25262b;
      --surface-alt: #2c2e33;
      --border:      #373a40;
      --accent:      #60b5ff;
      --accent-hover:#0a91ff;
      --accent-press:#0073d0;
      --text:        #c1c2c5;
      --text-strong: #e8e9ec;
      --text-dim:    #5c5f66;
      --radius:      8px;
      --font:        'IBM Plex Sans', 'Helvetica Neue', sans-serif;
      --font-heading:'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif;
    }

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5rem;
    }

    .logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .logo svg {
      width: 48px;
      height: 48px;
    }

    .logo-title {
      font-family: var(--font-heading);
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--text-strong);
      letter-spacing: -0.01em;
    }

    .logo-sub {
      font-size: 0.8rem;
      color: var(--text-dim);
      text-align: center;
      margin-top: -0.5rem;
    }

    .divider {
      width: 100%;
      height: 1px;
      background: var(--border);
    }

    .message {
      font-size: 0.85rem;
      color: var(--text);
      text-align: center;
      line-height: 1.5;
    }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.65rem 1.25rem;
      background: var(--accent);
      color: #0d1117;
      font-family: var(--font);
      font-size: 0.9rem;
      font-weight: 600;
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      transition: background 0.15s ease;
      text-decoration: none;
    }

    .btn:hover  { background: var(--accent-hover); color: #fff; }
    .btn:active { background: var(--accent-press); }

    .footer {
      margin-top: 2rem;
      font-size: 0.75rem;
      color: var(--text-dim);
      text-align: center;
    }
  </style>
</head>
<body>

  <div class="card">

    <div class="logo">
      <!-- Patent Workbench logo — inline SVG -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="2"  y="2"  width="8" height="8" rx="1.5" fill="#60b5ff"/>
        <rect x="12" y="2"  width="8" height="8" rx="1.5" fill="#60b5ff" opacity="0.22"/>
        <rect x="22" y="2"  width="8" height="8" rx="1.5" fill="#60b5ff" opacity="0.55"/>
        <rect x="2"  y="12" width="8" height="8" rx="1.5" fill="#60b5ff" opacity="0.22"/>
        <rect x="12" y="12" width="8" height="8" rx="1.5" fill="#60b5ff"/>
        <rect x="22" y="12" width="8" height="8" rx="1.5" fill="#60b5ff" opacity="0.22"/>
        <rect x="2"  y="22" width="8" height="8" rx="1.5" fill="#60b5ff" opacity="0.55"/>
        <rect x="12" y="22" width="8" height="8" rx="1.5" fill="#60b5ff" opacity="0.22"/>
        <rect x="22" y="22" width="8" height="8" rx="1.5" fill="#60b5ff"/>
      </svg>
      <span class="logo-title">Patent Workbench</span>
      <span class="logo-sub">Local LLM Assistant for Patent Ideation</span>
    </div>

    <div class="divider"></div>

    {{if .SignInMessage}}
    <p class="message">{{.SignInMessage}}</p>
    {{else}}
    <p class="message">Sign in with your lab credentials to continue.</p>
    {{end}}

    <form method="POST" action="{{.ProxyPrefix}}/sign_in" style="width:100%">
      <input type="hidden" name="rd" value="{{.Redirect}}" />
      <button type="submit" class="btn">
        Sign in with {{.ProviderName}}
      </button>
    </form>

  </div>

  {{if .Footer}}
  <p class="footer">{{.Footer}}</p>
  {{else}}
  <p class="footer">Access is restricted to authorised lab users.</p>
  {{end}}

</body>
</html>
```

---

## error.html — full template

Save this file to `/opt/oauth2-proxy/templates/error.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Patent Workbench — Access Error</title>
  <link
    href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@600;700&display=swap"
    rel="stylesheet"
  />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:          #1a1b1e;
      --surface:     #25262b;
      --border:      #373a40;
      --accent:      #60b5ff;
      --text:        #c1c2c5;
      --text-strong: #e8e9ec;
      --text-dim:    #5c5f66;
      --error:       #ff6b6b;
      --radius:      8px;
      --font:        'IBM Plex Sans', 'Helvetica Neue', sans-serif;
      --font-heading:'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif;
    }

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.25rem;
      text-align: center;
    }

    .error-code {
      font-family: var(--font-heading);
      font-size: 3rem;
      font-weight: 700;
      color: var(--error);
      line-height: 1;
    }

    .error-title {
      font-family: var(--font-heading);
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--text-strong);
    }

    .error-message {
      font-size: 0.85rem;
      color: var(--text);
      line-height: 1.6;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.6rem 1.5rem;
      background: var(--accent);
      color: #0d1117;
      font-family: var(--font);
      font-size: 0.875rem;
      font-weight: 600;
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .btn:hover { background: #0a91ff; color: #fff; }
  </style>
</head>
<body>
  <div class="card">
    <div class="error-code">{{.StatusCode}}</div>
    <div class="error-title">{{.Title}}</div>
    <p class="error-message">{{.Message}}</p>
    <a href="{{.ProxyPrefix}}/sign_in" class="btn">Back to sign in</a>
  </div>
</body>
</html>
```

---

## Configure oauth2-proxy to use the templates

In `/etc/oauth2-proxy/oauth2-proxy.cfg`, add:

```ini
custom-templates-path = "/opt/oauth2-proxy/templates"

# Optional: message shown below the sign-in button
banner = "Lab access only — contact your administrator to request an account."

# Optional: footer text
footer = "Patent Workbench · Internal use only"
```

Restart oauth2-proxy to apply:

```bash
sudo systemctl restart oauth2-proxy
sudo systemctl status oauth2-proxy   # confirm it loaded without errors
```

---

## Serving static assets via nginx

The templates in this guide inline all CSS and the SVG logo, so no additional nginx configuration is needed for assets.

If you later want to reference external files (e.g., a hosted font mirror, a PNG banner image), add a location block in nginx that serves them from a local path:

```nginx
# In the patent-workbench nginx server block
location /oauth2/static/ {
    alias /opt/oauth2-proxy/static/;
    expires 7d;
}
```

Then reference them in the template as `src="/oauth2/static/banner.png"`.

---

## Testing

1. Open a private/incognito browser window and navigate to `https://patent-workbench.lab/patent-workbench`.
2. You should be redirected to the branded sign-in page before the app loads.
3. After successful login, confirm you land on the Patent Workbench app — not on an oauth2-proxy default page.
4. Test the error page by navigating directly to `https://patent-workbench.lab/oauth2/sign_out` and then accessing a protected route.

**Common issues:**

| Symptom | Cause | Fix |
| --- | --- | --- |
| Template not loading (default page shown) | `custom-templates-path` path is wrong or directory not readable | `ls -la /opt/oauth2-proxy/templates/` — confirm files exist and are readable by the process user |
| Google Fonts not loading | Lab server has no internet access | Self-host the fonts: download the WOFF2 files, serve from nginx, and update the `<link>` href |
| `{{.ProviderName}}` renders empty | Provider name not set in the oauth2-proxy config | Add `provider-display-name = "Authelia"` (or your IdP name) to `oauth2-proxy.cfg` |
