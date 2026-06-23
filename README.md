# PantherNav

PantherNav is a campus transit web app for Georgia State University. It shows route options, stop arrivals, and a live bus map using PassioGO data for GSU system `480`.

## Features

- Route Finder for comparing campus shuttle route options
- Arrivals view for buses serving a selected stop
- Live Map powered by Google Maps JavaScript API
- Live list of buses currently reporting positions
- Google Places autocomplete for campus location search
- Google Maps walking direction links
- GSU-inspired dark theme with blue, black, and red accents

## Tech Stack

- Next.js 14 App Router
- React
- Tailwind CSS
- Google Maps JavaScript API
- Google Places API
- PassioGO transit data
- TurfJS distance calculations


## How To Use

### Route Finder

1. Open the Route Finder tab.
2. Enter your starting location.
3. Enter your destination.
4. Review the ranked route cards.
5. Click a route card to expand walking and bus steps.
6. Use the direction buttons to open walking directions in Google Maps.

### Arrivals

1. Open the Arrivals tab.
2. Select a bus stop.
3. View routes serving that stop and estimated arrival times.
4. Use the directions button to open the stop in Google Maps.

### Live Map

1. Open the Live Map tab.
2. View live bus markers and shuttle stop markers.
3. Click a bus marker to see bus and route details.
4. Click a stop marker to open its arrivals.
5. Use the Buses running now panel to see all active buses.

The app refreshes live transit data about every 10 seconds.


