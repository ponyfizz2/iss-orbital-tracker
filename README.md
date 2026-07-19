# ISS Orbital Tracker

An interactive browser-based tracker for the International Space Station, Earth satellites, aircraft, the Moon, Mars, and a compact solar-system view.

## Features

- Live ISS position, altitude, speed, ground track, footprint, and country/ocean readout
- TLE/SGP4 fallback when the live ISS telemetry service is unavailable
- Matrix, satellite-imagery, hologram, coloured lunar-geology, dedicated views for every planet, and a live solar-system view
- Selectable Moon Natural, Topography, and Geology layers plus Mars Natural, Elevation, Thermal IR, and Orbital layers
- Observational Mercury, Venus, and Jupiter maps plus NASA-imagery-derived representative cloud maps for Saturn, Uranus, and Neptune
- Live 2D NASA SDO solar viewer with white-light sunspots, magnetogram, coronal, prominence, and flare filters
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

Additional lunar layers use NASA SVS's LROC CGI Moon Kit and the USGS LROC WAC GLD100 colour-shaded topography. Mars layers use MOLA colour elevation, Mars Odyssey THEMIS daytime infrared, and the MGS MOC orbital atlas exported from Arizona State University's Mars WMS. The external CTX viewer links to Caltech's 5 m/pixel Global CTX Mosaic.

Mercury uses the USGS MESSENGER MDIS global colour mosaic, Venus uses the USGS Magellan synthetic-colour radar mosaic, and Jupiter uses NASA/ESA Hubble OPAL global observations. Saturn, Uranus, and Neptune use [Solar System Scope textures](https://www.solarsystemscope.com/textures/) by INOVE, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) and derived from NASA elevation and imagery data; because the giant planets have no visible solid surface and their atmospheres change, these are explicitly labelled representative cloud maps. Live solar images come from NASA's Solar Dynamics Observatory latest-image feed and refresh every five minutes while the viewer is open.

Critical browser libraries are vendored in `vendor/` so a third-party CDN outage cannot prevent the tracker from starting. Their upstream MIT licenses are included alongside the files.

## License

MIT
