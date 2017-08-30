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

axios.get('data/data_status.json').then(response => {
    // Parser for the time format used
    const parseTime = d3.timeParse('%Y-%m-%d %H:%M:%S');

    // Parse the data to an array with objects consisting of
    // time and average value for each measurement
    let data = _.reduce(response.data, function (result, value) {
        let total = 0;
        _.forEach(value, item => {
            total += Number(item.ok);
        });

        result.push({
            time: parseTime(value[0].checked_time),
            value: total / value.length,
        });

        return result;
    }, []);

    // Create the graph for average reliability
    const averageReliabilityGraph = new graph({
        element: 'svg#average-reliability'
    });

    averageReliabilityGraph.create(data);

    // Display the graph and stop the loading spinner
    d3.select('#content').style('display', 'block');

    loadingSpinner.stop();
})
.catch(function (error) {
    console.log(error);
    loadingSpinner.stop();
    d3.select('#error-message')
        .style('display', 'block')
        .text('Could not load data: ' + error);
});
