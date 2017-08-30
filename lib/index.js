import _ from 'lodash';
import * as d3 from 'd3';
import axios from 'axios';
import spinner from './spinner';

const loadingSpinner = new spinner({
    width: d3.select('#container').node().clientWidth,
    height: 100,
    startAngle: 220,
    container: '#container',
    id: 'loading-spinner'
});
loadingSpinner.start();

axios.get('data/data_status.json').then(response => {
    const svg = d3.select("svg"),
        margin = { top: 20, right: 20, bottom: 30, left: 30 },
        width = +svg.attr("width") - margin.left - margin.right,
        height = +svg.attr("height") - margin.top - margin.bottom,
        g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    const parseTime = d3.timeParse("%Y-%m-%d %H:%M:%S");

    const x = d3.scaleTime()
        .rangeRound([0, width]);

    const y = d3.scaleLinear()
        .rangeRound([height, 0]);

    // Parse the data to an array with objects consisting of
    // time and average value for each measurement
    let data = _.reduce(response.data, function(result, value) {
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

    // Initialize the line
    const line = d3.line()
        .x(d => x(d.time))
        .y(d => y(d.value));

    // Determine the domains for x and y axis
    x.domain(d3.extent(data, d => d.time));
    y.domain([0, 1]);

    // Create the x axis
    g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
        .select(".domain")
        .remove();

    // Create the y axis with label
    g.append("g")
        .call(d3.axisLeft(y))
        .append("text")
        .attr("fill", "#000")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "0.71em")
        .attr("text-anchor", "end")
        .text("Status");

    // Create the line
    g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 1.5)
        .attr("d", line);

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
