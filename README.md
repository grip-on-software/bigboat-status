# BigBoat platform status

This visualization produces reliability graph for project ecosystems running on 
[BigBoat](https://github.com/ICTU/docker-dashboard).

## Configuration

Copy the file `lib/config.json` to `config.json` and adjust environmental 
settings in that file. The following configuration items are known:

- `visualization_url`: The URL to the visualization hub. This may include 
  a protocol and domain name, but does not need to in case all the 
  visualizations and the BigBoat status are hosted on the same domain (for 
  example in a development environment). The remainder is a path to the root of 
  the visualizations, where the dashboard is found and every other 
  visualization has sub-paths below it.
- `path`: The relative path at which the BigBoat status is made available on 
  the server. This can remain the default `.` to work just fine.

## Data

The data for the BigBoat status can be collected, analyzed and output through 
runs of the `data-gathering` and `data-analysis` repositories. The 
documentation for those repositories may provide more details on how to deploy 
the collection scripts, but as a summary the gathering scripts 
`scraper/bigboat_to_json.py` and either `controller/auth/status.py` (as part of 
a control server) or `import_bigboat_status.py`, as well as the 
`bigboat_status` analysis report, may be part of the data pipeline. The entire 
data collection must be placed in the `public/data` directory.

## Running

The visualization can be built using Node.js and `npm` by running `npm install` 
and then either `npm run watch` to start a development server that also 
refreshes browsers upon code changes, or `npm run production` to create 
a minimized bundle. The resulting HTML, CSS and JavaScript is made available in 
the `public` directory.
