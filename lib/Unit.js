/**
 * Unit conversions for graph domains.
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
