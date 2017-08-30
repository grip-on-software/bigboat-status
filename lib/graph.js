import * as d3 from 'd3';

const defaultConfiguration = {
    element: d3.select('svg#graph'),
};

class graph {
    // Initialize a new graph instance with the given configuration
    constructor(configuration = {}) {
        this.config = Object.assign({}, defaultConfiguration, configuration);
    }

    // Create the graph
    create(data) {
        const margin = { top: 20, right: 20, bottom: 30, left: 30 },
            width = +this.config.element.attr('width') - margin.left - margin.right,
            height = +this.config.element.attr('height') - margin.top - margin.bottom,
            g = this.config.element.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        const x = d3.scaleTime()
            .rangeRound([0, width]);

        const y = d3.scaleLinear()
            .rangeRound([height, 0]);
        
        // Initialize the line
        const line = d3.line()
            .x(d => x(d.time))
            .y(d => y(d.value));

        // Determine the domains for x and y axis
        x.domain(d3.extent(data, d => d.time));
        y.domain([0, 1]);

        // Create the x axis
        g.append('g')
            .attr('transform', 'translate(0,' + height + ')')
            .call(d3.axisBottom(x))
            .select('.domain')
            .remove();

        // Create the y axis
        g.append('g')
            .call(d3.axisLeft(y));

        // Create the line
        g.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-linejoin', 'round')
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', 1.5)
            .attr('d', line);
    }
}

export default graph
