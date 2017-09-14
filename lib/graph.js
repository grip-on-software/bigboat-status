import * as d3 from 'd3';

const defaultConfiguration = {
    element: d3.select('svg#graph'),
};

class graph {
    // Initialize a new graph instance with the given configuration
    constructor(data = {}, configuration = {}) {
        this.data = data;
        this.config = Object.assign({}, defaultConfiguration, configuration);

        this.create();
    }

    // Create the graph
    create() {
        const margin = { top: 20, right: 30, bottom: 30, left: 30 },
            width = +this.config.element.attr('width') - margin.left - margin.right,
            height = +this.config.element.attr('height') - margin.top - margin.bottom,
            g = this.config.element.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        const x = d3.scaleTime()
            .rangeRound([0, width]);

        const y0 = d3.scaleLinear()
            .rangeRound([height, 0]);

        const y1 = d3.scaleLinear()
            .rangeRound([height, 0]);
        
        // Initialize the lines
        const okStatusLine = d3.line()
            .x(d => x(d.checked_date))
            .y(d => y0(d.ok));

        const realValueLine = d3.line()
            .x(d => x(d.checked_date))
            .y(d => y1(d.value))
            .defined(d => d.value);

        // Determine the domains for x and y axis
        x.domain(d3.extent(this.data, d => d.checked_date));
        y0.domain([0, 1]);
        y1.domain([0, d3.max(this.data, d => d.max ? d.max : d.value)]);

        // Create the x axis
        g.append('g')
            .attr('transform', 'translate(0,' + height + ')')
            .call(d3.axisBottom(x))
            .select('.domain')
            .remove();

        // Create the left y axis
        g.append('g')
            .call(d3.axisLeft(y0));
        
        // Create the right y axis, only if this component has values to display
        if (this.data[this.data.length-1].value) {
            g.append('g')
                .attr('transform', `translate(${width},0)`)
                .call(d3.axisRight(y1));
        }

        // Create the lines
        this.createLine(g, okStatusLine, 'rgb(0, 114, 178)')
        this.createLine(g, realValueLine, 'rgb(230, 159, 0)')
    }

    // Add a dataline to the given element
    createLine(element, line, color = 'steelblue') {
        element.append('path')
            .datum(this.data)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-linejoin', 'round')
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', 1.5)
            .attr('d', line);
    }
}

export default graph
