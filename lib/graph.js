import * as d3 from 'd3';

const defaultConfiguration = {
    element: d3.select('svg#graph'), // The svg element which will contain the graph
    index: '0', // Has to be unique for each svg to be able to create unique id's
    preciseYAxis: true, // Whether to have a precise left y axis
};

class graph {
    // Initialize a new graph instance with the given configuration
    constructor(data = {}, dispatch, configuration = {}) {
        this.data = data;
        this.dispatch = dispatch;
        this.config = Object.assign({}, defaultConfiguration, configuration);

        this.create();
    }

    // Create the graph
    create() {
        let svg = this.config.element;

        const margin = { top: 20, right: 30, bottom: 30, left: 30 },
            width = +svg.attr('width') - margin.left - margin.right,
            height = +svg.attr('height') - margin.top - margin.bottom,
            g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        // Clips an element to the graph dimensions, to prevent overflowing
        svg.append('defs')
            .append('clipPath')
            .attr('id', `graph-clipper-${this.config.index}`)
            .append('rect')
            .attr('width', width)
            .attr('height', height);

        // Axis dimensions
        this.x = d3.scaleTime()
            .rangeRound([0, width]);

        const y0 = d3.scaleLinear()
            .rangeRound([height, 0]);

        const y1 = d3.scaleLinear()
            .rangeRound([height, 0]);
        
        // Initialize the lines
        this.okStatusLine = d3.line()
            .x(d => this.x(d.checked_date))
            .y(d => y0(d.ok));

        this.realValueLine = d3.line()
            .x(d => this.x(d.checked_date))
            .y(d => y1(d.value))
            .defined(d => d.value);

        // Determine the domains for x and y axis
        const xStartDomain = d3.extent(this.data, d => d.checked_date);

        this.x.domain(xStartDomain);
        y0.domain([0, 1]);
        y1.domain([0, d3.max(this.data, d => d.max ? d.max : d.value)]);

        // Create the x axis
        this.xAxis = d3.axisBottom(this.x);

        g.append('g')
            .classed('x-axis', true)
            .attr('transform', 'translate(0,' + height + ')')
            .call(this.xAxis);

        // create the left y axis
        let yAxis = d3.axisLeft(y0);

        // Whether this compontent has values to display
        this.componentHasValues = !! this.data[this.data.length - 1].value;

        // Only show 0 and 1 for a component graph
        if (! this.config.preciseYAxis) {
            yAxis.tickValues([0, 1]);
        }

        g.append('g')
            .call(yAxis);

        // Will be created when the user has moved recently and is not idle
        let idleTimeout = null;
        // The default delay after which the user is considered idle
        let idleDelay = 350;

        // Create the "OK status" line
        this.createLine(g, this.okStatusLine, 'ok-status-line', 'rgb(0, 114, 178)');            
        
        // Create the right y axis and "real value" line, only if this component has values to display
        if (this.componentHasValues) {
            g.append('g')
                .attr('transform', `translate(${width},0)`)
                .call(d3.axisRight(y1));
            
            this.createLine(g, this.realValueLine, 'real-value-line', 'rgb(230, 159, 0)');                
        }

        // The user has been idle for long enough
        let idled = () => {
            idleTimeout = null;
        }

        // Callback invoked when a user selects an area to zoom
        let brushed = () => {
            let selection = d3.event.selection;

            if (selection) {
                // Set the domain of the x axis to the selection
                this.x.domain(selection.map(this.x.invert));

                // Remove the brush since the SVG is now zoomed in
                svg.select(".brush").call(brush.move, null);
            } else {
                // Set a timeout so that the above null brush move doesn't invoke this
                if (!idleTimeout) return idleTimeout = setTimeout(idled, idleDelay);
                // Set x back to the start domain
                this.x.domain(xStartDomain);
            }

            // Zoom to the new domain
            this.zoom();
            
            // Notify other graphs of the new zoom level
            this.dispatch.call('zoom', this, this.config.index, this.x.domain());
        }

        let brush = d3.brushX()
            .extent([[0, 0], [width, height + margin.top]])
            .on("end", brushed);
        
        // The visible brush element, showed when drawing
        svg.append("g")
            .attr("class", "brush")
            .attr('transform', `translate(${margin.left},${margin.top})`)
            .call(brush);
    }

    // Add a dataline to the given element
    createLine(element, line, classes = '', color = 'steelblue') {
        element.append('path')
            .attr('clip-path', `url(#graph-clipper-${this.config.index})`)
            .classed(`line ${classes}`, true)
            .datum(this.data)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-linejoin', 'round')
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', 1.5)
            .attr('d', line);
    }

    // Zoom the graph to the current x domain
    zoom() {
        // Update the x axis and the data line with a transition
        let transition = this.config.element.transition().duration(750);

        // Update the x axis with the new domain
        this.config.element.select(".x-axis").transition(transition).call(this.xAxis);

        // Update the line to the new domain
        this.config.element.select(".line.ok-status-line")
            .transition(transition)
            .attr("d", this.okStatusLine(this.data));

        // If there is a value line, update that as well
        if (this.componentHasValues) {
            this.config.element.select(".line.real-value-line")
                .transition(transition)
                .attr("d", this.realValueLine(this.data));
        }
    }
}

export default graph
