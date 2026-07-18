# ISS Orbital Tracker

An interactive browser-based tracker for the International Space Station, Earth satellites, aircraft, the Moon, Mars, and a compact solar-system view.

## Features

- Live ISS position, altitude, speed, ground track, footprint, and country/ocean readout
- TLE/SGP4 fallback when the live ISS telemetry service is unavailable
- Matrix, satellite-imagery, hologram, Moon, Mars, and solar-system views
- Optional satellite constellations and aircraft layers
- Lunar landing-site labels plus distance and crater-area measurement tools
- Responsive controls and keyboard shortcuts

## Run locally

This is a static site with no build step. Serve the directory through a local web server so browsers can load its assets and remote data safely:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Data sources

The application uses public endpoints from Where the ISS at?, CelesTrak, Open Notify, ADS-B One, and public map/texture providers. Live layers gracefully fall back or report their unavailable state when a provider cannot be reached.

## License

MIT
