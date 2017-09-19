import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import spinner from './spinner';
import graph from './graph';

const loadingSpinner = new spinner({
    width: d3.select('#container').node().clientWidth,
    height: 100,
    startAngle: 220,
    container: '#container',
    id: 'loading-spinner'
});
loadingSpinner.start();

// Parser for the time format used
const parseTime = d3.timeParse('%Y-%m-%d %H:%M:%S');

let addGraphs = function(project) {
    d3.select('#project-name')
        .text(project);

    let dispatch = d3.dispatch('zoom');

    // Update a graph to the given domain, if it is not the graph that sent this event
    const coordinateZoom = (graphElement) => {
        dispatch.on(`zoom.${graphElement.config.index}`, function (index, domain) {
            if (graphElement.config.index !== index) {
                graphElement.x.domain(domain);
                graphElement.zoom();
            }
        });
    }

    axios.all([
        axios.get(`data/bigboat_status/${project}.json`),
        axios.get('data/bigboat_status/fields.json')
    ]).then(axios.spread((project, fields) => {
        // Create an array of components, with for each component the measures of that component
        let data = d3.nest()
            .key(d => d.name)
            .entries(project.data);
        
        // When this projects data was last updated, assuming dates are ordered
        const lastChecked = data[0].values[[data[0].values.length - 1]].checked_date;

        // Show when the status was last checked, and show when it was > 24hrs ago
        d3.select('#last-checked')
            .text(lastChecked)
            .classed('has-text-danger has-text-weight-bold', (new Date() - new Date(lastChecked)) > 86400000);

        // Parse the fields to the necessary format
        _.forEach(data, component => {
            _.forEach(component.values, item => {
                item.checked_date = parseTime(item.checked_date);
                item.ok = item.ok ? 1 : 0;
            })
        });
        
        // Average reliability per measure moment
        let averageReliabilityData = [];
        // Total number of items (moments at which a measure was conducted) in the dataset
        const totalItems = data[0].values.length;
        // Total number of components
        const totalComponents = data.length;

        // Calculate the average reliability per measure moment
        // Loop over all individual items
        for(let i = 0; i < totalItems; i++) {
            let total = 0;
            let componentStatus = {};

            // Add for each different component the OK status to the total
            for(let j = 0; j < totalComponents; j++) {
                const value = data[j].values[i].ok;
                total += value;
                
                // If the status is not "OK", add this component to the list
                if (value !== 1) {
                    componentStatus[data[j].key] = value;
                }
            }

            // Add the time and average reliability to the array
            averageReliabilityData.push({
                checked_date: data[0].values[i].checked_date,
                ok: total / totalComponents,
                componentStatus
            });
        }

        // Create the graph for average reliability
        const averageReliabilityGraph = new graph(averageReliabilityData, dispatch, {
            element: d3.select('svg#average-reliability'),
            index: 'average',
        });

        coordinateZoom(averageReliabilityGraph);

        // Create a graph for each component
        _.forEach(data, function (componentData, index) {
            // Create the component container
            const component = d3.select('#components')
                .append('div')
                .classed('component column is-6', true);

            // Add the component title
            component.append('h3')
                .classed('title is-5 has-no-margin', true)
                .text(componentData.key);

            component.append('p')
                .classed('description', true)
                .text(fields.data[componentData.key].description);

            // Add the SVG element
            const svg = component.append('svg')
                .attr('width', '480')
                .attr('height', '250');

            // Create the graph for this component
            const componentGraph = new graph(componentData.values, dispatch, {
                element: svg,
                index,
                preciseYAxis: false,
                valueUnit: fields.data[componentData.key].unit
            });

            coordinateZoom(componentGraph);
        });

        // Display the graph and stop the loading spinner
        d3.select('#content').classed('is-hidden', false);

        loadingSpinner.stop();
    }))
    .catch(function (error) {
        console.log(error);
        loadingSpinner.stop();
        d3.select('#error-message')
            .classed('is-hidden', false)
            .text('Could not load data: ' + error);
    });
}

axios.get('data/bigboat_status/projects.json').then(response => {
    const projects = response.data.sort();

    let currentProject = projects[0];

    // Create project navigation
    d3.select('#navigation ul')
        .selectAll('li')
        .data(projects)
        .enter()
        .append('li')
        .on("click", (project, element, buttons) => {
            // Don't do anything when clicking the same project twice
            if (project != currentProject) {
                d3.select('#content').classed('is-hidden', true);
                loadingSpinner.start();

                // Set this project as active
                d3.select("#navigation .is-active").classed('is-active', false);
                d3.select(buttons[element]).classed('is-active', true);

                currentProject = project;

                // Remove the current graphs
                d3.selectAll('#components div').remove();
                d3.select('svg#average-reliability').html('');

                // Add the graphs for the new selected project
                addGraphs(currentProject);

                // Hide the previous error message
                d3.select('#error-message')
                    .classed('is-hidden', true);
            }
        })
        .classed('is-active', d => d === currentProject)
        .append('a')
        .text(d => d)

    addGraphs(currentProject);
})
.catch(function (error) {
    console.log(error);
    loadingSpinner.stop();
    d3.select('#error-message')
        .classed('is-hidden', false)
        .text('Could not load projects: ' + error);
});

