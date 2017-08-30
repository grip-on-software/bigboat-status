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
    let data = response.data;
    console.log(data);

    // Application logic...

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
