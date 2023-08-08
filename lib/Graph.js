/**
 * Interactive status graph display.
 *
 * Copyright 2017-2020 ICTU
 * Copyright 2017-2022 Leiden University
 * Copyright 2017-2023 Leon Helwerda
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
import moment from 'moment';
import {vsprintf} from 'sprintf-js';
import * as d3 from 'd3';
import Unit from './Unit';

const defaultConfiguration = {
    element: d3.select('svg#graph'), // The svg element which will contain the graph
    index: '0', // Has to be unique for each svg to be able to create unique id's
    preciseYAxis: true, // Whether to have a precise left y axis,
    valueUnit: undefined, // The unit for the right y
};

/**
 * An interactive status and reliability graph.
 */
class Graph {
    /**
     * Initialize a new graph instance with the given configuration
     */
    constructor(data, duration, dispatch, configuration = {}, locales=null) {
        this.data = data;
        this.duration = duration;
        this.dispatch = dispatch;
        this.config = Object.assign({}, defaultConfiguration, configuration);
        this.locales = locales;

        this.create();
    }

    /**
     * Create the axes and lines with the correct dimensions and domains.
     */
    createLineDomains() {
        // Axis dimensions
        this.x = d3.scaleTime()
            .rangeRound([0, this.width]);

        this.yOk = d3.scaleLinear()
            .rangeRound([this.height, 0]);

        this.yValue = d3.scaleLinear()
            .rangeRound([this.height, 0]);

        // Initialize the lines
        this.okStatusLine = d3.line()
            .x(d => this.x(d.checked_date))
            .y(d => this.yOk(d.ok))
            .curve(d3.curveStepAfter);

        this.realValueLine = d3.line()
            .x(d => this.x(d.checked_date))
            .y(d => this.yValue(d.value))
            .defined(d => d.value);

        this.bisectDate = d3.bisector(d => d.checked_date).left;

        // Determine the domains for x and y axis
        this.xStartDomain = d3.extent(this.data, d => d.checked_date);
        this.yValueStartDomain = [0, d3.max(this.data, d => d.max ? d.max : d.value)];

        this.x.domain(this.xStartDomain);
        this.yOk.domain([0, 1]);
        this.yValue.domain(this.yValueStartDomain);
    }

    /**
     * Create the graph.
     */
    create() {
        const svg = this.config.element;

        const margin = { top: 20, right: 30, bottom: 30, left: 30 },
            g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        this.width = +svg.attr('width') - margin.left - margin.right;
        this.height = +svg.attr('height') - margin.top - margin.bottom;

        // Clips an element to the graph dimensions, to prevent overflowing
        svg.append('defs')
            .append('clipPath')
            .attr('id', `graph-clipper-${this.config.index}`)
            .append('rect')
            .attr('width', this.width)
            .attr('height', this.height);

        d3.timeFormatDefaultLocale(this.locales.selectedLocale);

        this.createLineDomains();

        // Create the x axis
        this.xAxis = d3.axisBottom(this.x);

        g.append('g')
            .classed('axis x-axis', true)
            .attr('transform', `translate(0,${this.height})`)
            .call(this.xAxis);

        // create the left y axis
        const yOkAxis = d3.axisLeft(this.yOk);

        // Whether this compontent has values to display
        this.componentHasValues = !! this.data[this.data.length - 1].value;

        // Only show 0 and 1 for a component graph
        if (! this.config.preciseYAxis) {
            yOkAxis.tickValues([0, 1]);
            yOkAxis.tickFormat((d) => this.locales.message(`ok-${d ? 'yes' : 'no'}`));
        }

        g.append('g')
            .classed('axis y-axis-left', true)
            .call(yOkAxis);

        // Will be created when the user has moved recently and is not idle
        this.idleTimeout = null;
        // The default delay after which the user is considered idle
        this.idleDelay = 350;

        // Create the "OK status" line
        this.createLine(g, this.okStatusLine, 'ok-status-line', 'rgb(0, 114, 178)');

        // Create the right y axis and "real value" line, only if this component has values to display
        this.valueUnit = new Unit(this.config);
        if (this.componentHasValues) {
            this.yValueAxis = d3.axisRight(this.yValue);

            // Set right y axis in right format
            this.yValueAxis.tickFormat(this.valueUnit.format);

            g.append('g')
                .attr('transform', `translate(${this.width},0)`)
                .classed('axis y-axis-right', true)
                .call(this.yValueAxis)
                .append('text')
                .classed('has-text-weight-bold', true)
                .attr('style', 'text-align: right')
                .attr('fill', '#000')
                .attr('y', -10)
                .attr('x', 20)
                .attr('dy', '0.71em')
                .attr('text-anchor', 'end')
                .text(this.locales.attribute('axes', this.valueUnit.key));

            this.createLine(g, this.realValueLine, 'real-value-line', 'rgb(230, 159, 0)');
        }
        else {
            this.yValueAxis = null;
        }

        this.focused = false;
        this.focusData = null;
        this.brush = d3.brushX()
            .extent([[0, 0], [this.width, this.height + margin.top]])
            .on("start", () => { this.focused = !this.focused; })
            .on("end", (event) => { this.brushed(event); });

        // The visible brush element, showed when drawing
        svg.append("g")
            .attr("class", "brush")
            .attr('transform', `translate(${margin.left},${margin.top})`)
            .call(this.brush);

        // Create the focus element, displayed when a data point is hovered
        this.focus = g.append("g")
            .classed('focus', true)
            .style("display", "none");

        // Display a circle as focus element
        this.focus.append("circle")
            .attr("r", 4);

        const tooltip = this.focus.append('g')
            .classed('tooltip', true);

        tooltip.append('rect')
            .attr('fill', 'rgb(0,0,0,0.8)')
            .attr('width', 150);

        // The text element which holds the actual tooltip
        tooltip.append("text")
            .attr("x", 15)
            .attr("y", 5)
            .attr("dy", ".31em");

        // Create the 'hover line' which displays a line to the x axis
        // when hovering over a data point
        this.focus.append("line")
            .attr("class", "hover-line")
            .attr("y1", 5)
            .attr("y2", this.height);

        // Display the tooltip when hovering over the graph
        svg.select('.overlay')
            .on("focusout", () => { this.focused = false; })
            .on("mouseover", () => this.focus.style("display", null))
            .on("mouseout", () => {
                if (!this.focused) {
                    // Remove the focus line
                    this.focus.style("display", "none");
                    this.dispatch.call('focus', this, this.config.index, null);
                }
                else {
                    this.focused = false;
                }
            })
            .on("mousemove", (event) => { this.mousemove(event); });
    }

    /**
     * Callback invoked when a user selects an area to zoom.
     */
    brushed(event) {
        const selection = event.selection;
        const svg = this.config.element;

        if (selection) {
            // Set the domain of the x axis to the selection
            this.x.domain(selection.map(this.x.invert));

            // Remove the brush since the SVG is now zoomed in
            if (this.brush) {
                svg.select(".brush").call(this.brush.move, null);
            }

            // Let the focus line move freely
            this.focused = false;
        } else {
            // Set a timeout so that the above null brush move doesn't invoke this
            if (!this.idleTimeout) {
                this.idleTimeout = setTimeout(() => {
                    this.idleTimeout = null;
                }, this.idleDelay);
                return;
            }

            // Set x back to the start domain
            this.x.domain(this.xStartDomain);
            this.yValue.domain(this.yValueStartDomain);
        }

        // Zoom to the new domain
        this.zoom();

        // Notify other graphs of the new zoom level
        this.dispatch.call('zoom', this, this.config.index, this.x.domain());
    }

    /**
     * Callback invoked when the mouse is moved.
     */
    mousemove(event) {
        if (this.focused) {
            return;
        }
        // Get the data for the current date point and calculate the correct coordinates
        const x0 = this.x.invert(d3.pointer(event)[0]);
        this.updateFocus(x0);

        const tooltip = this.focus.select('.tooltip');
        const tooltipText = tooltip.select('text');

        // Clear current tooltip
        tooltipText.html('');
        tooltip.style('display', null);

        tooltipText.append('tspan')
            .attr('x', 15)
            .attr('dy', '1.2em')
            .attr('style', 'font-size: 0.8em')
            .text(() => {
                let text = d3.timeFormat('%d %b %H:%M')(this.focusData.checked_date);

                if (!this.focusData.componentStatus) {
                    text = this.locales.message('status-component-tooltip', [
                        text, this.locales.message(`ok-${this.focusData.ok ? 'yes' : 'no'}`)
                    ]);
                }
                else if (_.size(this.focusData.componentStatus) === 0) {
                    text = this.locales.message('status-tooltip', [text]);
                }

                return text;
            });

        // Show each component that isn't "OK"
        _.forEach(this.focusData.componentStatus, function (value, key) {
            tooltipText.append('tspan')
                .attr('x', 15)
                .attr('dy', '1.2em')
                .text(key);
        });
        if (this.focusData.value) {
            const unit = this.valueUnit.key !== '' ?
                vsprintf(this.locales.attribute('units', this.valueUnit.key), [
                    this.valueUnit.format(this.focusData.value)
                ]) : this.valueUnit.format(this.focusData.value);
            tooltipText.append('tspan')
                .attr('x', 15)
                .attr('dy', '1.2em')
                .text(unit);
        }

        const tooltipTextLength = tooltipText.selectAll('tspan').size();

        // Add the tooltip background with the right height
        tooltip.select('rect').attr('height', 19.2 * tooltipTextLength + 15);

        this.dispatch.call('focus', this, this.config.index, x0);
    }

    /**
     * Update the display of the tooltip and the focus line and circle after
     * a mouse move or during  zoom transition.
     */
    updateFocus(x0) {
        this.focus.select(".tooltip").style("display", "none");

        if (x0 === null) {
            this.focus.style("display", "none");
            this.focusData = null;
            return;
        }
        this.focus.style("display", null);

        const transition = typeof x0.transition === "function" ? x0 : null;

        if (transition === null) {
            const i = this.bisectDate(this.data, x0, 1),
                d0 = this.data[i - 1],
                d1 = this.data[i] || this.data[i - 1];
            this.focusData = x0 - d0.checked_date > d1.checked_date - x0 ? d1 : d0;
        }
        else if (this.focusData === null) {
            return;
        }

        const y = this.focusData.value ? this.realValueLine.y() : this.okStatusLine.y();

        // Set the coordinates for the focus line and circle
        const element = transition ? transition : this.focus;
        element.attr("transform", `translate(${this.x(this.focusData.checked_date)},${y(this.focusData)})`);

        // Set the height of the hover line so it always ends at the x axis
        this.focus.select(".hover-line").attr("y2", this.height - y(this.focusData));
    }

    /**
     * Add a dataline to the given element.
     */
    createLine(element, line, classes = '', color = 'steelblue') {
        element.append('path')
            .attr('clip-path', `url(#graph-clipper-${this.config.index})`)
            .classed(`line ${classes}`, true)
            .datum(this.data)
            .attr('fill', 'none')
            .attr('stroke', color)
            .attr('stroke-linejoin', 'round')
            .attr('stroke-linecap', 'round')
            .attr('stroke-width', 2)
            .attr('d', line);
    }

    /**
     * Zoom the graph to hold the values within the interval designated by
     * a moment duration.
     */
    setDomain(duration) {
        if (moment.isDuration(duration)) {
            const maxDate = d3.max(this.data, d => d.checked_date);
            this.x.domain([moment(maxDate).subtract(duration).toDate(), maxDate]);
        }
        else {
            this.x.domain(d3.extent(this.data, d => d.checked_date));
        }

        // Zoom to the new domain
        this.zoom();

        // Notify other graphs of the new zoom level
        this.dispatch.call('zoom', this, this.config.index, this.x.domain());
    }

    /**
     * Zoom the graph to the current x domain.
     */
    zoom() {
        // Update the x axis and the data line with a transition
        const transition = this.config.element.transition().duration(750);

        // Update the x axis with the new domain
        this.config.element.select(".x-axis").transition(transition).call(this.xAxis);

        if (this.yValueAxis) {
            const xDomain = this.x.domain();
            const yValueDomain = [0, d3.max(this.data, d => d.checked_date >= xDomain[0] && d.checked_date <= xDomain[1] ? (d.max || d.value) : 0)];
            this.yValue.domain(yValueDomain);

            // Update the y value axis with the new domain
            this.config.element.select(".y-axis-right").transition(transition).call(this.yValueAxis);
        }

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

        // Update the focus element to the new domain
        this.updateFocus(this.focus.transition(transition));
    }
}

export default Graph;
