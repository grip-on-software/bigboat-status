/**
 * Main entry point for the reliability status graphs.
 *
 * Copyright 2017-2020 ICTU
 * Copyright 2017-2022 Leiden University
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import moment from 'moment';
import spec from './locales.json';
import config from 'config.json';
import {Locale, Navigation, Navbar, Spinner} from '@gros/visualization-ui';
import Graph from './Graph';

const locales = new Locale(spec);
const searchParams = new URLSearchParams(window.location.search);
locales.select(searchParams.get("lang"));

const loadingSpinner = new Spinner({
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

const updateRange = (duration, hasDuration) => {
    // Convert duration slug using default locale in moment and create domain
    if (averageReliabilityGraph) {
        averageReliabilityGraph.setDomain(duration.includes('-') ?
            moment.duration(...duration.split('-').map(part => isNaN(Number(part)) ? part : Number(part))) : undefined
        );
    }
    return hasDuration;
};
const durationNavigation = new Navigation({
    container: '#range',
    prefix: 'range_',
    setCurrentItem: updateRange,
    addElement: (element) => {
        element.text(d => locales.attribute('durations', d.includes('-') ? d.split('-').reverse()[0] : d));
    }
});

const setError = (error, message='data-error') => {
    d3.select('#error-message')
        .classed('is-hidden', error === null)
        .text(locales.message(message, [error]));
};

const getAverageReliabilityData = function(dates) {
    const averageReliabilityData = [];

    // Calculate the average reliability per measure moment
    // Loop over all individual items
    dates.forEach((date, checked_date) => {
        let total = 0;
        const componentStatus = {};

        // Add for each different component the OK status to the total
        date.forEach((metric) => {
            total += metric.ok;

            // If the status is not "OK", add this component to the list
            if (metric.ok !== 1) {
                componentStatus[metric.name] = metric.ok;
            }
        });

        // Add the time and average reliability to the array
        averageReliabilityData.push({
            checked_date: checked_date,
            ok: total / date.length,
            componentStatus
        });
    });

    return averageReliabilityData;
};

const addGraphs = function(project, displayName, source) {
    d3.select('#project-name')
        .text(displayName);
    d3.select('#source-url')
        .classed('is-hidden', !source)
        .attr('aria-label', locales.message('source-url-label', [displayName]))
        .attr('href', source ? source.bigboat_url : null);

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
        const data = d3.group(project.data, d => d.name);

        // When this projects data was last updated, assuming dates are ordered
        const lastChecked = project.data[project.data.length - 1].checked_date;

        // Show when the status was last checked, and show when it was > 24hrs ago
        d3.select('#last-checked')
            .text(lastChecked)
            .classed('has-text-danger has-text-weight-bold', (new Date() - new Date(lastChecked)) > 86400000);

        // Parse the fields to the necessary format
        data.forEach(component => {
            _.forEach(component, item => {
                item.checked_date = parseTime(item.checked_date);
                item.ok = item.ok ? 1 : 0;
            });
        });

        // Average reliability per measure moment
        const averageReliabilityData = getAverageReliabilityData(
            d3.group(project.data, d => d.checked_date)
        );

        // Create the graph for average reliability
        averageReliabilityGraph = new Graph(averageReliabilityData, dispatch, {
            element: d3.select('svg#average-reliability'),
            index: 'average',
        }, locales);

        coordinateDispatch(averageReliabilityGraph);

        // Create a graph for each component
        let index = 0;
        data.forEach(function (values, key) {
            // Create the component container
            const component = d3.select('#components')
                .append('div')
                .classed('component column is-6', true);

            // Add the component title
            component.append('h3')
                .classed('title is-5 has-no-margin', true)
                .text(locales.retrieve(fields.data[key].titles, null, key));

            component.append('p')
                .classed('description', true)
                .text(locales.retrieve(fields.data[key].descriptions));

            // Add the SVG element
            const svg = component.append('svg')
                .attr('width', '480')
                .attr('height', '250');

            // Create the graph for this component
            const componentGraph = new Graph(values, dispatch, {
                element: svg,
                index,
                preciseYAxis: false,
                valueUnit: fields.data[key].unit,
            }, locales);

            coordinateDispatch(componentGraph);
            index++;
        });

        durationNavigation.setCurrentItem(durationNavigation.currentItem);

        // Display the graph and stop the loading spinner
        d3.select('#content').classed('is-hidden', false);

        loadingSpinner.stop();
    }))
    .catch(function (error) {
        loadingSpinner.stop();
        setError(error);
        throw error;
    });
};

axios.all([
    axios.get('data/bigboat_status/projects.json'),
    axios.get('data/projects_meta.json'),
    axios.get('data/projects_sources.json')
]).then(axios.spread((projects, meta, urls) => {
    const projectData = _.intersectionWith(meta.data, projects.data,
        (metadata, project) => metadata.name === project
    );
    const projectNames = _.fromPairs(_.map(projectData,
        d => [d.name, d.quality_display_name || d.name]
    ));
    const projectUrls = urls.data;

    let currentProject = projectData[0].name;

    // Create project navigation
    const projectNavigation = new Navigation({
        container: '#navigation',
        prefix: 'project_',
        setCurrentItem: (project, hasProject) => {
            // Don't do anything when clicking the same project twice
            if (hasProject && project !== currentProject) {
                // Hide the previous error message
                setError(null);

                d3.select('#content').classed('is-hidden', true);
                loadingSpinner.start();

                currentProject = project;

                // Remove the current graphs
                d3.selectAll('#components div').remove();
                d3.select('svg#average-reliability').html('');

                // Add the graphs for the new selected project
                addGraphs(currentProject, projectNames[currentProject],
                    projectUrls[currentProject]
                );
            }
            return hasProject;
        },
        key: d => d.name,
        addElement: (element) => {
            element.text(d => d.name)
                .attr('title', d => locales.message("project-title",
                    [d.quality_display_name || d.name]
                ));
        }
    });

    projectNavigation.start(projectData);
    durationNavigation.start(['full', '1-month', '1-week']);
    // If the project is not immediately changed, show the default one.
    if (currentProject === projectData[0].name) {
        addGraphs(currentProject, projectNames[currentProject],
            projectUrls[currentProject]
        );
    }
}))
.catch(function (error) {
    loadingSpinner.stop();
    setError(error, 'projects-error');
    throw error;
});

locales.updateMessages();

if (typeof window.buildNavigation === "function") {
    window.buildNavigation(Navbar, locales, config);
}
