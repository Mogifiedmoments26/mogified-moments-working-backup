# Mogified Moments — Clean Magnet App

Clean rebuild for the Mogified Moments personalised magnet business.

## Products

Only two products are configured in `lib/products.ts`:

- 50 × 50 mm Square Magnet — ₹150
- 58 mm Circle Magnet — ₹150

Square artwork is 58 × 58 mm including 4 mm bleed on every side. Circle artwork is 66 mm including 4 mm bleed around the 58 mm finished circle. The print preview shows black outer artwork/cut guides and the finished boundary.

## Frames

Put the supplied transparent PNG assets into:

- `public/frames/square/`
- `public/frames/circle/`

The frame configuration is centralized in `lib/frames.ts`. The clean project is designed to use the existing filenames from the supplied frame collections.

Place the real Mogified Moments logo at:

`public/logo.png`

The app does not generate or substitute a brand logo.

## Routes

- `/` — mobile-first customer ordering flow
- `/guest` — prepaid celebration photo upload flow
- `/studio` — studio/admin orders and A4 print preview

## Firebase

Copy `.env.example` to `.env.local` and add the existing Firebase project values. With Firebase configured, orders use Firestore and original photos use Firebase Storage. Without Firebase, local browser storage is used so the UI can be tested immediately.

## Party packages

Party packages are prepaid bulk orders designed for events: the organiser pays in advance, selects the magnet shape, and guests can send their photos during the event using the party order number.

The current package quantities and prices are configured centrally in `lib/packages.ts`: 50, 100, 200 and 500 magnets.

## Printing

A4 is 210 × 297 mm. The Studio calculates the grid from the product artwork size and maintains physical dimensions using mm CSS units. Browser printing is used for the final print.
