$(function() {
    const modal = document.querySelector('.modal');
    const modalInstance = M.Modal.init(modal);
    
    // set current date
    //var currentDate = new Date();
    $('#current-date').text(moment().format('yyyy-MM-DD'));

    // global data
    var baseCurrency = 'USD';
    var exchangeCurrencies = 'EUR,GBP,JPY';
    var supportedCurrencies = {};
    var timeSeriesCurrency = exchangeCurrencies.split(',')[0];
    var historyMonths = 1;

    function produceCurrencyCard(code, desc, rate) {
        return `
            <div class="card grey lighten-3 currency-card" data-code="${code}">
                <div class="card-content">
                    <div class="flag currency-flag currency-flag-${code.toLowerCase()} left"></div>
                    <div>
                        <span class="currency-code">${code}</span>
                        <span class="currency-rate right">${rate.toFixed(3)}</span>
                    </div>
                    <div class="currency-description">
                        <span>${desc}</span>
                    </div> 
                </div>
            </div>
        `;
    }

    // get the supported symbols in drop down
    (function getSupportedSymbols() {        
        var requestURL = `https://api.exchangerate.host/symbols`
        var request = new XMLHttpRequest();
        request.open('GET', requestURL);
        request.responseType = 'json';
        request.send();
        
        request.onload = function() {
            var response = request.response;
            var symbols = response.symbols;
            var selectTag = $('select#base-symbol');
            var multiselectRates = $('div#mutliselect-currencies');

            // Build the options using string 
            var optionsHTML = '';
            var multiSelectHTML = '';
            for (code in symbols) {
                optionsHTML += `<option value="${code}" class="right">${code} (${symbols[code].description})</option>`;
                multiSelectHTML += `
                    <p>
                        <label>
                            <input type="checkbox" value="${code}" ${exchangeCurrencies.split(',').includes(code) ? 'checked="checked"' : '' }" />
                            <span>${code} (${symbols[code].description})</span>
                        </label>
                    </p>
                `;
                supportedCurrencies[code] = symbols[code].description;
            }
            
            selectTag.html(optionsHTML);
            selectTag.val('USD');
            selectTag.formSelect();

            multiselectRates.html(multiSelectHTML);
        }
    })();

    $('select#base-symbol').on('change', function(e) {
        baseCurrency = e.target.value;
        updateRates();
    });

    function updateRates() {
        getLatestRates(baseCurrency, exchangeCurrencies);
        drawTimeSeries();
    }

    function getLatestRates(base, symbols) {
        queryParams = $.param({
            base,
            symbols,
        });
        
        var requestURL = `https://api.exchangerate.host/latest?${queryParams}`
        var request = new XMLHttpRequest();
        request.open('GET', requestURL);
        request.responseType = 'json';
        request.send();
        
        request.onload = function() {
            $('.currency-card').remove();
            var rates = request.response.rates;

            currencyCardsHTML = '';
            for (code in rates) {
                currencyCardsHTML += produceCurrencyCard(code, supportedCurrencies[code], rates[code]);
            }
            $('#currency-control').append(currencyCardsHTML);

            $('.currency-card').on('click', function() {
                $('.currency-card').removeClass('timeseries yellow accent-4');
                $(this).removeClass('grey lighten-3');
                $(this).addClass('timeseries yellow accent-4');
                timeSeriesCurrency = $(this).data('code');
                drawTimeSeries();
            });

            $('.currency-card').each(function() {
                if($(this).data('code') === timeSeriesCurrency) {
                    $(this).removeClass('grey lighten-3');
                    $(this).addClass('timeseries yellow accent-4');
                }
            })
        }
    }

    $('#currency-selection-form').on('submit', function(e) {
        e.preventDefault();
        selectedCurrencies = [];
        $('input[type="checkbox"]:checked').each(function () {      
            selectedCurrencies.push($(this).val());
        });
        exchangeCurrencies = selectedCurrencies.join();
        updateRates();
        modalInstance.close();
    });

    $('input[type="radio"]').on('change', function() {
        historyMonths = $(this).data('month');
        drawTimeSeries();
    });

    function drawTimeSeries() {
        queryParams = $.param({
            start_date: moment().subtract(historyMonths, 'months').format('yyyy-MM-DD'),
            end_date: moment().format('yyyy-MM-DD'),
            base: baseCurrency,
            symbols: timeSeriesCurrency
        });
        
        var requestURL = `https://api.exchangerate.host/timeseries?${queryParams}`
        var request = new XMLHttpRequest();
        request.open('GET', requestURL);
        request.responseType = 'json';
        request.send();

        request.onload = function() {
            var rates = request.response.rates;

            var data = []
            for (date in rates) {
                data.push({
                    date,
                    amount: rates[date][timeSeriesCurrency]
                });
            }

            $('.currency-title').text(`${baseCurrency} to ${timeSeriesCurrency}`)

            $('svg').remove();

            const margin = {top: 40, right: 20, bottom: 50, left: 100};
            const graphWidth = 700 - margin.left - margin.right;
            const graphHeight = 500 - margin.top - margin.bottom;

            const svg = d3.select('.canvas')
                .append('svg')
                .attr('width', graphWidth + margin.left + margin.right)
                .attr('height', graphHeight + margin.top + margin.bottom);

            const graph = svg.append('g')
                .attr('width', graphWidth)
                .attr('height', graphHeight)
                .attr('transform', `translate(${margin.left}, ${margin.top})`);
            
            // scales
            const x = d3.scaleTime().range([0, graphWidth]);
            const y = d3.scaleLinear().range([graphHeight, 0]);

            // Axex groups
            const xAxisGroup = graph.append('g')
                .attr('class', 'x-axis')
                .attr('transform', `translate(0, ${graphHeight})`);

            const yAxisGroup = graph.append('g')
                .attr('class', 'y-axis');

            // d3 line path generator
            const line = d3.line()
                .x(d => x(new Date(d.date)))
                .y(d => y(d.amount));

            const path = graph.append('path');

            // created dotted line group and append to graph
            const dottedLines = graph.append('g')
                                    .attr('class', 'lines')
                                    .style('opacity', 0);
            
            // create x dotted line and append to dotted line group
            const xDottedLine = dottedLines.append('line')
                                    .attr('stroke', '#aaa')
                                    .attr('stroke-width', 1)
                                    .attr('stroke-dasharray', 4)
            
            // create y dotted line and append to dotted line group
            const yDottedLine = dottedLines.append('line')
                                    .attr('stroke', '#aaa')
                                    .attr('stroke-width', 1)
                                    .attr('stroke-dasharray', 4);

            const dataRange = d3.max(data, d => d.amount) - d3.min(data, d => d.amount);
            x.domain(d3.extent(data, d => new Date(d.date)));
            y.domain([d3.min(data, d => d.amount) - 0.25 * dataRange , d3.max(data, d => d.amount) + 0.1 * dataRange ]);

                // create axes
            const xAxis = d3.axisBottom(x);
            const yAxis = d3.axisLeft(y);

            // call axes
            xAxisGroup.call(xAxis);
            yAxisGroup.call(yAxis);

            // rotate axis text
            xAxisGroup.selectAll('text')
                        .attr('transform', 'rotate(-45)')
                        .attr('text-anchor', 'end');

            const tip = d3.tip()
                .attr("class", "tip card")
                .html(d => {
                    return (
                        `<div > <span style="font-weight:bold">Date:</span> ${d.date} </div>` +
                        `<div > <span style="font-weight:bold">${baseCurrency} to ${timeSeriesCurrency}:</span> ${d.amount} </div>`
                    );
                });

            // update path data
            path.data([data])
                .attr('fill', 'none')
                .attr('stroke', '#5c6bc0')
                .attr('stroke-width', 2)
                .attr('d', line);

            // create circles for objects
            const circles = graph.selectAll('circle').data(data);

            // update current points
            circles.attr('cx', d => x(new Date(d.date)))
                    .attr('cy', d => y(d.amount));

            // Enter selection
            circles.enter().append('circle')
                            .attr('r', 8)
                            .attr('cx', d => x(new Date(d.date)))
                            .attr('cy', d => y(d.amount))
                            //.attr('fill', '#5c6bc0');
                            .attr('fill', 'white')
                            .attr('opacity', 0);

            graph.call(tip);

            graph.selectAll('circle')
                    .on('mouseover', (d, i, n) => {

                        tip.show(d, n[i]);
            
                        // set x dottled line coords (x1, x2, y1, y2)
                        xDottedLine
                            .attr('x1', x(new Date(d.date)))
                            .attr('x2', x(new Date(d.date)))
                            .attr('y1', graphHeight)
                            .attr('y2', y(d.amount));
            
                        yDottedLine
                            .attr('x1', 0)
                            .attr('x2', x(new Date(d.date)))
                            .attr('y1', y(d.amount))
                            .attr('y2', y(d.amount));
            
            
                        dottedLines.style('opacity', 100);
                    }).on('mouseout', (d, i, n) => {

                        tip.hide();
            
                        // hide the dotted line group (.style, opacity)
                        dottedLines.style('opacity', 0);
                    });
        }
    }

    // App start up function calls
    getLatestRates(baseCurrency, exchangeCurrencies);
    drawTimeSeries();
});

