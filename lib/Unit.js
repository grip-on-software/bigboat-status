/**
 * Unit conversions for graph domains.
 */
import * as d3 from 'd3';

/**
 * A configured unit conversion class.
 */
class Unit {
    /**
     * Initialize the unit conversion to provide a formatter and locale key.
     */
    constructor(config) {
        this.config = config;
        if (this.config.valueUnit === 'seconds') {
            this.format = seconds => {
                return d3.format('.1f')(seconds / 60 / 60 / 24);
            };

            this.key = 'days';
        } else if (this.config.valueUnit === 'bytes') {
            this.format = bytes => {
                return Math.round(bytes / 1024 / 1024 / 1024);
            };

            this.key = 'gigabytes';
        } else {
            this.format = (value) => value;
            this.key = '';
        }
    }
}

export default Unit;
