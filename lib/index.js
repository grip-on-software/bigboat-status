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
    axios.get(`data/bigboat_status/${project}.json`).then(response => {
        // Parse the data to an array with for each separate component an array
        // consisting of all checks
        let componentsData = _.reduce(response.data, function (result, item) {
            if (!result[item.name]) {
                result[item.name] = [];
            }

            result[item.name].push({
                time: parseTime(item.checked_date),
                value: item.ok ? 1 : 0
            });
            return result;
        }, {});

        // Create a graph for each component
        _.forEach(componentsData, function (data, key) {
            // Create the component container
            const component = d3.select('#components')
                .append('div')
                .classed('column is-6', true);

            // Add the component title
            component.append('h3')
                .classed('title is-5 has-no-margin', true)
                .text(key);

            // Add the SVG element
            const svg = component.append('svg')
                .attr('width', '500')
                .attr('height', '250');

            // Create the graph for this component
            const componentGraph = new graph({
                element: svg
            });
            componentGraph.create(data);
        });

        // Display the graph and stop the loading spinner
        d3.select('#content').classed('is-hidden', false);

        loadingSpinner.stop();
    })
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

    let currentProject = projects[7];

    // Create project navigation
    d3.select('#navigation ul')
        .selectAll('li')
        .data(projects)
        .enter()
        .append('li')
        .on("click", (project, element, buttons) => {
            // Don't do anything when clicking the same project twice
            if (project != currentProject) {
                loadingSpinner.start();

                // Set this project as active
                d3.select("#navigation .is-active").classed('is-active', false);
                d3.select(buttons[element]).classed('is-active', true);

                currentProject = project;

                // Remove the current graphs
                d3.selectAll('#components div').remove();

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

