import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import moment from 'moment';
import naturalSort from 'javascript-natural-sort';
import spec from './locales.json';
import config from 'config.json';
import {locale, navigation, navbar, spinner} from '@gros/visualization-ui';
import graph from './graph';

const locales = new locale(spec);
const searchParams = new URLSearchParams(window.location.search);
locales.select(searchParams.get("lang"));

const loadingSpinner = new spinner({
    width: d3.select('#container').node().clientWidth,
    height: 100,
    startAngle: 220,
    container: '#container',
    id: 'loading-spinner'
});
loadingSpinner.start();

const dispatch = d3.dispatch('zoom', 'focus');

// Parser for the time format used in the data
const parseTime = d3.timeParse('%Y-%m-%d %H:%M:%S');

let averageReliabilityGraph = null;

let updateRange = (duration, hasDuration) => {
    // Convert duration slug using default locale in moment and create domain
    if (averageReliabilityGraph) {
        averageReliabilityGraph.setDomain(duration.includes('-') ?
            moment.duration(...duration.split('-').map(part => isNaN(Number(part)) ? part : Number(part))) : undefined
        );
    }
    return hasDuration;
};
const durationNavigation = new navigation({
    container: '#range',
    prefix: 'range_',
    setCurrentItem: updateRange,
    addElement: (element) => {
        element.text(d => locales.attribute('durations', d.includes('-') ? d.split('-').reverse()[0] : d));
    }
});

let addGraphs = function(project, source) {
    d3.select('#project-name')
        .text(project);
    d3.select('#source-url')
        .attr('href', source);

    // Register a graph to dispatch events from other graphs.
    // - zoom: Update a graph to the given domain
    // - focus: Update the focus line
    const coordinateDispatch = (graphElement) => {
        dispatch.on(`zoom.${graphElement.config.index}`, function (index, domain) {
            if (graphElement.config.index !== index) {
                graphElement.x.domain(domain);
                graphElement.zoom();
            }
        });
        dispatch.on(`focus.${graphElement.config.index}`, function(index, x0) {
            if (graphElement.config.index !== index) {
                graphElement.updateFocus(x0);
            }
        });
    };

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
            });
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
        averageReliabilityGraph = new graph(averageReliabilityData, dispatch, {
            element: d3.select('svg#average-reliability'),
            index: 'average',
        }, locales);

        coordinateDispatch(averageReliabilityGraph);

        // Create a graph for each component
        _.forEach(data, function (componentData, index) {
            // Create the component container
            const component = d3.select('#components')
                .append('div')
                .classed('component column is-6', true);

            // Add the component title
            component.append('h3')
                .classed('title is-5 has-no-margin', true)
                .text(locales.retrieve(fields.data[componentData.key].titles, null, componentData.key));

            component.append('p')
                .classed('description', true)
                .text(locales.retrieve(fields.data[componentData.key].descriptions));

            // Add the SVG element
            const svg = component.append('svg')
                .attr('width', '480')
                .attr('height', '250');

            // Create the graph for this component
            const componentGraph = new graph(componentData.values, dispatch, {
                element: svg,
                index,
                preciseYAxis: false,
                valueUnit: fields.data[componentData.key].unit,
            }, locales);

            coordinateDispatch(componentGraph);
        });

        durationNavigation.setCurrentItem(durationNavigation.currentItem);

        // Display the graph and stop the loading spinner
        d3.select('#content').classed('is-hidden', false);

        loadingSpinner.stop();
    }))
    .catch(function (error) {
        console.log(error);
        loadingSpinner.stop();
        d3.select('#error-message')
            .classed('is-hidden', false)
            .text(locales.message('data-error', [error]));
    });
};

axios.all([
    axios.get('data/bigboat_status/projects.json'),
    axios.get('data/bigboat_status/urls.json')
]).then(axios.spread((projects, urls) => {
    const projectKeys = projects.data.sort(naturalSort);
    const projectUrls = urls.data;

    let currentProject = projectKeys[0];

    // Create project navigation
    const projectNavigation = new navigation({
        container: '#navigation',
        prefix: 'project_',
        setCurrentItem: (project, hasProject) => {
            // Don't do anything when clicking the same project twice
            if (project != currentProject) {
                d3.select('#content').classed('is-hidden', true);
                loadingSpinner.start();

                currentProject = project;

                // Remove the current graphs
                d3.selectAll('#components div').remove();
                d3.select('svg#average-reliability').html('');

                // Add the graphs for the new selected project
                addGraphs(currentProject, projectUrls[currentProject]);

                // Hide the previous error message
                d3.select('#error-message')
                    .classed('is-hidden', true);
            }
            return hasProject;
        }
    });

    projectNavigation.start(projectKeys);
    durationNavigation.start(['full', '1-month', '1-week']);
    addGraphs(currentProject, projectUrls[currentProject]);
}))
.catch(function (error) {
    console.log(error);
    loadingSpinner.stop();
    d3.select('#error-message')
        .classed('is-hidden', false)
        .text(locales.message('projects-error', [error]));
});

locales.updateMessages();

window.buildNavigation(navbar, locales, config);
