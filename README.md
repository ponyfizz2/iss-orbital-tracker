# ISS Orbital Tracker

An interactive browser-based tracker for the International Space Station, Earth satellites, aircraft, the Moon, Mars, and a compact solar-system view.

## Features

- Live ISS position, altitude, speed, ground track, footprint, and country/ocean readout
- TLE/SGP4 fallback when the live ISS telemetry service is unavailable
- Matrix, satellite-imagery, hologram, coloured lunar-geology, Mars, and live solar-system views
- Date-driven positions for all eight planets using JPL approximate Keplerian elements
- Optional satellite constellations with visible live/cache/model feed status
- Zoom-aware military and civilian aircraft layers that reveal more traffic as the camera moves closer
- Lunar landing-site labels plus distance and crater-area measurement tools
- Responsive controls and keyboard shortcuts

## Run locally

This is a static site with no build step. Serve the directory through a local web server so browsers can load its assets and remote data safely:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Data sources

The application uses public endpoints from Where the ISS at?, the TLE API, CelesTrak, Open Notify, Airplanes.live, and public map/texture providers. Live layers gracefully fall back to cached elements or an explicit orbital model when a provider cannot be reached.

Solar positions use the [JPL approximate planetary-position method](https://ssd.jpl.nasa.gov/planets/approx_pos.html), valid for 1800–2050. The coloured Moon surface is derived from the CC0 [USGS Unified Geologic Map of the Moon, 1:5M](https://astrogeology.usgs.gov/search/map/Moon/Geology/Unified_Geologic_Map_of_the_Moon_GIS_v2/) by Corey M. Fortezzo, Paul D. Spudis, and Shannon L. Harrel (2020).

Critical browser libraries are vendored in `vendor/` so a third-party CDN outage cannot prevent the tracker from starting. Their upstream MIT licenses are included alongside the files.

## License

MIT
