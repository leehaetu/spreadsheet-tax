# Spreadsheet Tax — iOS & Android apps

Thin native shells that load the product web surface (bridging app, client portal, and practice paths) against a configurable base URL. Business logic stays on the server — one codebase for web and mobile.

## Stack

- **Expo** (React Native) monorepo app under `mobile/spreadsheet-tax-app/`
- Same project builds **iOS** and **Android**

## Configure API / product URL

```bash
export EXPO_PUBLIC_PRODUCT_URL=https://spreadsheet-tax-production.up.railway.app
# or local:
# export EXPO_PUBLIC_PRODUCT_URL=http://localhost:3000
```

Default in app config: production Railway URL if set, else `http://localhost:3000`.

## Install & run

```bash
cd mobile/spreadsheet-tax-app
npm install

# Start Expo (choose iOS simulator, Android emulator, or device)
npm start

# Platform-specific
npm run ios       # requires Xcode on macOS
npm run android   # requires Android SDK / emulator
```

## Build (local)

```bash
cd mobile/spreadsheet-tax-app
npx expo export --platform ios
npx expo export --platform android
```

Or use EAS Build when credentials are configured:

```bash
npx eas-cli build --platform ios
npx eas-cli build --platform android
```

Store listing / TestFlight submission is out of scope for this scaffold.

## Product paths loaded in-app

| Screen | Path |
|--------|------|
| Home / sales | `/` |
| Bridging import | `/app` |
| Client portal | `/portal` |
| Accountant | `/accountant` |
| Practice | `/practice` |

IP © Lee Hine. See root `LICENSE`.
