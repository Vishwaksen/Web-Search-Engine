/// <reference path="jquery-1.10.1.min.js" />

(function() {
    var geocoder = new google.maps.Geocoder();

    var showResults = function(jqxhr) {
        var response = jqxhr.response,
            $rPanel = $('.r-panel'),
            source = $("#response-template").html(),
            template = Handlebars.compile(source),
            templateHTML = template(response);
        // Flush old results
        $('.facet-bar').show();
        $rPanel.find('.panel-heading').show();
        $rPanel.find('tbody').remove();
        $rPanel.find('table').append(templateHTML);
        // Handle Sort
        if (response.numFound < 2) {
            forSingleOrNoResults();
        }
        else {
            forMultipleResults(jqxhr['facet_counts']['facet_fields']);
        }
        $('.spinner').hide();
        $('.summary-holder').show();

    },

    flushFacets = function() {
        var $facetContainer = $('#facet-container');
        $facetContainer.children().off();
        $facetContainer.empty();
        $('#chart').remove();
        $('#chart-container').append($('<div>', {
            id: 'chart'
        }));
        return $facetContainer;
    },

    flushSummary = function() {
        $('.summary-holder').empty();
    },

    populateSummary = function(result) {

        var $summaryHolder = $('.summary-holder'),
            source = $("#summary-template").html(),
            template = Handlebars.compile(source),
            templateData = {
                subject: result[0],
                summary: result[2][0],
                'source-link': result[3][0]
            };
        flushSummary();
        $summaryHolder.append(template(templateData));

    },

    forSingleOrNoResults = function() {
        disableSortRadios();
        // Hide Facet Block
        flushFacets();
        $('.results-section').removeClass('col-md-8 col-md-14').addClass('col-md-10');
        //$('.chart-map').removeClass('col-md-4').addClass('col-md-2');
    },

    forMultipleResults = function(facetFields) {
        enableSortRadios();
        $('.chart-map').removeClass('col-md-2').addClass('col-md-4');
        $('.results-section').removeClass('col-md-10 col-md-14').addClass('col-md-6');
        // Show Facet Block
        populateFacets(facetFields);
        addFacetListeners();
    },

    onQuerySuccess = function(jqxhr) {
        var response = jqxhr.response,
            facetData = jqxhr['facet_counts'];

        console.log(response);
        showResults(jqxhr);

    },

    onQueryError = function() {
        console.error('Error in processing query, error object is :: ', arguments);
        forSingleOrNoResults();
    },

    fireQuery = function(data) {
        var $q = $('.q'),
            q = $q.val(),
            querParams = {
                q: q,
                wt: 'json',
                indent: true,
                facet: true,
                rows: 10000
                //facet=true&facet.field=lang&facet.field=result_type&facet.field=location
            },
            //allParams = $.extend(querParams, data),
            ajaxOptions = {
                beforeSend: function(readyState, jqXhr) {
                    if (data.sort) {
                        jqXhr.url = jqXhr.url + '&sort=' + data.sort + '&facet.field=lang&facet.field=Person&facet.field=City&facet.field=Organization&facet.field=Country&facet.field=Product&facet.field=location&facet.field=sentiment'
                    }
                    else {
                        jqXhr.url = jqXhr.url + '&facet.field=lang&facet.field=Person&facet.field=City&facet.field=Organization&facet.field=Country&facet.field=Product&facet.field=location&facet.field=sentiment'
                    }
                },
                type: "GET",
                dataType: "jsonp",
                jsonp: 'json.wrf',
                url: 'http://sauti.koding.io:8983/solr/sauti2/select',
                data: querParams,
                success: onQuerySuccess,
                error: onQueryError,
                //timeout:1000
            }

        $.ajax({
            url: 'https://en.wikipedia.org/w/api.php',
            type: 'GET',
            dataType: "jsonp",
            //jsonp: 'json.wrf',
            data: {
                action: 'opensearch',
                search: q,
                format: 'json',
                //callback:'spellcheck',
                prop: 'extracts'
            },
            error: function() {
            },
            success: populateSummary
        });
        return $.ajax(ajaxOptions);

    },

    getSortData = function() {
        if ($('#newest').is(':checked')) {
            return 'created_at+desc';
        }
        else if ($('#popular').is(':checked')) {
            return 'favourites_count+desc';
        }
        else if ($('#followed').is(':checked')) {
            return 'followers_count+desc';
        }
        return null;
    },

    execReq = function() {
        $('.summary-holder').hide();
        $('.spinner').show();
        var sortBy = getSortData();
        var queryData = {};
        if (sortBy) {
            queryData.sort = sortBy
        }
        jqxhr = fireQuery(queryData);
        // Async tasks after query execution
    },

    populateFacets = function(facet) {
        var $facetContainer = flushFacets();
        var templateData = {};
        // Flush old facets

        if (facet.lang) {
            var languages = [];
            var langData = null;
            facet.lang.forEach(function(element, index) {
                if (index % 2 === 0) {
                    langData = {};
                    langData.name = element;
                }
                else {
                    langData.y = element;
                    languages.push(langData);
                }
            });
            templateData.lang = languages;
        }

        if (facet.Organization) {
            var organizations = [];
            var data = null;
            facet.Organization.forEach(function(element, index) {
                if (index % 2 === 0) {
                    data = {};
                    data.name = element;
                }
                else {
                    data.y = element;
                    organizations.push(data);
                }
            });
            //templateData.organizations = organizations;
        }


        if (facet.sentiment) {
            var orgs = [];
            var data = null;

            facet.sentiment.forEach(function(element, index) {
                if (index % 2 === 0) {
                    data = {};
                    data.name = element;
                }
                else {
                    data.y = element;
                    orgs.push(data);
                }
            });
            templateData.orgs = orgs;
        }

        if (facet.location) {

            var locations = [];
            var MAX_LOCATIONS = 9;
            if (facet.location.length > MAX_LOCATIONS) {
                facet.location = facet.location.splice(0, MAX_LOCATIONS);
            }

            var locData = null;
            var nullFound = false;
            var element = null;
            for (index = 0; index < facet.location.length; index += 1) {
                element = facet.location[index];
                if (index % 2 === 0) {
                    locData = {};
                    locData.loc = element || 'Unknown';
                }
                else {
                    locData.count = element;
                    locations.push(locData);
                }
            }

            templateData.location = locations;
        }


        var source = $("#facet-template").html(),
            template = Handlebars.compile(source);
        $facetContainer.append(template(templateData));
        showPie(organizations);
        showMap(locations);
    },

    addFacetListeners = function() {
        var $facetCheckBoxes = $('.facet-checkbox');
        $facetCheckBoxes.on({
            'click': function() {
                facetClick($facetCheckBoxes);
            }
        });
    },

    facetClick = function($elements) {
        var $results = $('.r-panel tbody tr').hide();
        var countSelected = 0;
        $elements.each(function(index, element) {
            var $element = $(element);
            var param = null;
            if ($element.hasClass('facet-lang')) {
                param = 'lang'
            }
            else {
                if ($element.hasClass('facet-loc')) {
                    param = 'loc'
                }
                else {
                    param = 'orgs'
                }
            }

            if (index === 0) {
                countSelected = 0;
            }
            if ($element.is(':checked')) {
                $('.r-panel tbody tr[check-' + param + '="' + $element.attr('check-' + param) + '"]').show();
                countSelected += 1;
            }
            if (index === ($elements.length - 1) && countSelected === 0) {
                $('.r-panel tbody tr').show();
            }
        });
    },

    setupElements = function() {
        var $fireQuery = $('.btn.query'),
            $radioContainer = $('ul.sort .iradio_flat');

        $radioContainer.addClass('disabled').find('input[type=radio]').attr('disabled', true);

        $fireQuery.on({
            'click': execReq
        });
        // Reset
        disableSortRadios();
        addEnterKeyPerk();
        addSortListeners();
        flushSummary();
    },

    addSortListeners = function() {
        $('.sort-options').on({
            'click': function() {
                if ($(this).is(':checked')) {
                    execReq();
                }
            }
        })
    },

    disableSortRadios = function() {
        $('.sort-options').attr('disabled', true);
    },

    enableSortRadios = function() {
        $('.sort-options').removeAttr('disabled');
    },

    addEnterKeyPerk = function() {
        var $input = $('.q');
        $input.on({
            'keyup': function(e) {
                var keyCode = e.keyCode || e.which;
                if (keyCode + '' == '13') {
                    execReq();
                }
            }
        });
    },

    showPie = function(languages) {
        highOptions = {
            chart: {
                plotBackgroundColor: null,
                plotBorderWidth: null,
                plotShadow: false,
                type: 'pie'
            },
            title: {
                text: 'Organizations Mentioned'
            },
            tooltip: {
                pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
            },
            plotOptions: {
                pie: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    dataLabels: {
                        enabled: true,
                        format: '<b>{point.name}</b>: {point.percentage:.1f} %',
                        style: {
                            color: (Highcharts.theme && Highcharts.theme.contrastTextColor) || 'black'
                        }
                    }
                }
            },
            series: [{
                name: 'Languages',
                colorByPoint: true,
                data: languages
            }]
        };
        $('#chart').highcharts(highOptions);

    },

    showMap = function(locations) {
        var $map = $('#map');
        var $heading = $('.map-loc-heading').show();
        var mapProp = {
            center: new google.maps.LatLng(51.508742, -0.120850),
            zoom: 4,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        var map = new google.maps.Map($map.get(0), mapProp);
        showCities(locations, map);

    },

    showCities = function(locations, map) {
        if (!locations) {
            return false;
        }
        locations.forEach(function(location) {

            geocoder.geocode({ 'address': location.loc }, function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    var result = results[0]
                    if (!result) {
                        return false;
                    }
                    var _center = {
                        lat: result.geometry.location.lat(),
                        lng: result.geometry.location.lng()
                    },
                    marker = new google.maps.Marker({
                        position: _center,
                        map: map,
                        title: result.formatted_address
                    });
                    map.panTo(marker.getPosition());
                }
                else {
                    return null
                }
            });
        });
    },

    plotCity = function(city) {
        var center = null;

        return center;
    };

    onPageLoad = function() {

        //Handlebars.registerHelper('pickURLs', function(options) {
        //    return new Handlebars.SafeString(options.fn(URI.withinString(this, function(url) {
        //        return "<a>" + url + "</a>";
        //    })))
        //    //debugger
        //    //return options.fn(this);
        //});

        setupElements();
    }

    $(document).ready(onPageLoad);
})();